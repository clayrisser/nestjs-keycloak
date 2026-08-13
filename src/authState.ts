/**
 * File: /src/authState.ts
 * Project: nestjs-keycloak
 * Author: Clay Risser <email@clayrisser.com>
 * -----
 * Risser Labs LLC (c) Copyright 2021
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { Request, Response } from 'express';
import type { KeycloakRequest } from './types';

export const AUTH_STATE_COOKIE = 'kc_auth_state';

// 256 bits of entropy, url safe so it survives a query string round trip
const STATE_BYTES = 32;

// several login flows can be in flight at once (multiple tabs), but the list is
// capped so a hostile client cannot grow the session record without bound
const MAX_PENDING_STATES = 10;

export const DEFAULT_AUTH_STATE_TTL = 10 * 60 * 1000;

export type AuthStateRejection = 'missing' | 'unknown' | 'expired' | 'mismatch';

export interface AuthStateResult {
  valid: boolean;
  reason?: AuthStateRejection;
}

export interface AuthStateOptions {
  // hmac key for the cookie fallback, so the cookie cannot be forged from a
  // sibling subdomain; the keycloak client secret is used when available
  secret?: string;
  ttl?: number;
  secure?: boolean;
}

interface PendingAuthState {
  value: string;
  expiresAt: number;
}

/**
 * Compares two strings in constant time.
 *
 * Both sides are hashed first so that `timingSafeEqual` never sees buffers of
 * differing length, which would otherwise throw and leak the length of the
 * expected value through the error path.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  const digestA = createHash('sha256').update(a, 'utf8').digest();
  const digestB = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(digestA, digestB);
}

function now() {
  return Date.now();
}

function signCookie(value: string, expiresAt: number, secret?: string) {
  const payload = `${value}.${expiresAt}`;
  if (!secret) return payload;
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
}

function parseCookie(cookie: string, secret?: string): PendingAuthState | undefined {
  const parts = cookie.split('.');
  const [value, rawExpiresAt, signature] = parts;
  if (!value || !rawExpiresAt) return undefined;
  if (secret) {
    if (!signature) return undefined;
    const expected = createHmac('sha256', secret).update(`${value}.${rawExpiresAt}`).digest('base64url');
    if (!timingSafeEqualString(signature, expected)) return undefined;
  }
  const expiresAt = Number.parseInt(rawExpiresAt, 10);
  if (!Number.isFinite(expiresAt)) return undefined;
  return { value, expiresAt };
}

function getPendingStates(req: KeycloakRequest<Request>): PendingAuthState[] {
  const states = req.session?.kauth?.authStates;
  if (!Array.isArray(states)) return [];
  return states.filter(
    (state): state is PendingAuthState =>
      !!state && typeof state.value === 'string' && typeof state.expiresAt === 'number',
  );
}

function setPendingStates(req: KeycloakRequest<Request>, states: PendingAuthState[]) {
  if (!req.session) return false;
  if (!req.session.kauth) req.session.kauth = {};
  req.session.kauth.authStates = states;
  return true;
}

function cookieOptions(expiresAt: number, options: AuthStateOptions = {}) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: options.secure ?? false,
    path: '/',
    maxAge: Math.max(expiresAt - now(), 0),
  };
}

/**
 * Generates a cryptographically random `state` value and binds it to the
 * caller's session (or, when no session store is installed, to a signed
 * http-only cookie) so that it can be verified at the authorization callback.
 */
export function createAuthState(req: KeycloakRequest<Request>, res?: Response, options: AuthStateOptions = {}): string {
  const value = randomBytes(STATE_BYTES).toString('base64url');
  const expiresAt = now() + (options.ttl ?? DEFAULT_AUTH_STATE_TTL);
  const pending = [...getPendingStates(req).filter((state) => state.expiresAt > now()), { value, expiresAt }];
  const persistedToSession = setPendingStates(req, pending.slice(-MAX_PENDING_STATES));
  // the cookie is only a fallback for apps with no session store. it is never
  // written alongside a session, because a cookie the browser keeps resending
  // would resurrect a state that the session already burned
  if (!persistedToSession) {
    if (!res?.cookie) {
      throw new Error(
        'cannot bind an oauth state parameter without either express-session or a response to set a cookie on',
      );
    }
    res.cookie(AUTH_STATE_COOKIE, signCookie(value, expiresAt, options.secret), cookieOptions(expiresAt, options));
  }
  return value;
}

/**
 * Verifies a `state` value returned by the authorization server against the
 * value bound to this browser, then invalidates it so that a captured callback
 * url cannot be replayed.
 */
export function consumeAuthState(
  req: KeycloakRequest<Request>,
  res?: Response,
  state?: string,
  options: AuthStateOptions = {},
): AuthStateResult {
  const clearCookie = () => {
    if (res?.clearCookie) res.clearCookie(AUTH_STATE_COOKIE, { path: '/' });
  };
  const pending = getPendingStates(req);
  // the session is authoritative whenever one exists, so that removing the
  // entry is genuinely single use. the cookie is consulted only when the
  // application installed no session store at all
  const rawCookie = req.session
    ? undefined
    : (req as unknown as { cookies?: Record<string, string> }).cookies?.[AUTH_STATE_COOKIE];
  const cookieState = typeof rawCookie === 'string' ? parseCookie(rawCookie, options.secret) : undefined;
  const candidates = [...pending, ...(cookieState ? [cookieState] : [])];
  if (!state) {
    // the callback was reached without a state parameter at all, which is the
    // shape of a cross site request forgery against the login flow
    return { valid: false, reason: 'missing' };
  }
  if (!candidates.length) return { valid: false, reason: 'unknown' };
  const matched = candidates.find((candidate) => timingSafeEqualString(candidate.value, state));
  if (!matched) {
    // no match means either forgery or a replay of an already consumed state
    return { valid: false, reason: 'mismatch' };
  }
  // single use: burn every copy of the matched value before reporting success
  setPendingStates(
    req,
    pending.filter((candidate) => candidate.value !== matched.value),
  );
  clearCookie();
  if (matched.expiresAt <= now()) return { valid: false, reason: 'expired' };
  return { valid: true };
}

/**
 * Drops any pending state values, for example after a completed login.
 */
export function clearAuthState(req: KeycloakRequest<Request>, res?: Response) {
  setPendingStates(req, []);
  if (res?.clearCookie) res.clearCookie(AUTH_STATE_COOKIE, { path: '/' });
}
