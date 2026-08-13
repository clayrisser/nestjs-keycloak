/**
 * File: /src/security.ts
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

import type { Request } from 'express';
import type { KeycloakRequest } from './types';

// hostname[:port] or [ipv6][:port] and nothing else, so a header cannot inject
// a path, query, credentials or a second url into a redirect we build
const HOST_PATTERN =
  /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*|\[[0-9a-fA-F:.]+\])(?::\d{1,5})?$/;

/**
 * Reports whether express has been configured to trust the proxy that sent
 * this request. `x-forwarded-*` headers are attacker controlled unless a
 * trusted reverse proxy is known to overwrite them.
 */
export function trustsProxy(req: KeycloakRequest<Request> | Request): boolean {
  const trust = (req as any)?.app?.get?.('trust proxy fn');
  if (typeof trust !== 'function') return false;
  try {
    const remoteAddress = (req as any).socket?.remoteAddress ?? (req as any).connection?.remoteAddress;
    return !!trust(remoteAddress, 0);
  } catch {
    return false;
  }
}

function firstHeaderValue(value?: string | string[]): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.split(',')[0]?.trim() || undefined;
}

/**
 * Resolves the externally reachable base url of the application.
 *
 * An explicitly configured `appBaseUrl` always wins. Otherwise the `Host`
 * header is used, and `x-forwarded-*` headers are only honoured when express
 * `trust proxy` is enabled, because an untrusted client can set them freely and
 * would otherwise control the `redirect_uri` sent to keycloak.
 */
export function getBaseUrl(req: KeycloakRequest<Request> | Request, appBaseUrl?: string): string {
  if (appBaseUrl) return appBaseUrl.replace(/\/+$/, '');
  const trusted = trustsProxy(req);
  const forwardedHost = trusted ? firstHeaderValue(req.get?.('x-forwarded-host')) : undefined;
  const forwardedPort = trusted ? firstHeaderValue(req.get?.('x-forwarded-port')) : undefined;
  const host =
    forwardedHost ||
    firstHeaderValue(req.get?.('host')) ||
    (req.hostname ? `${req.hostname}${forwardedPort ? `:${forwardedPort}` : ''}` : undefined);
  if (!host || !HOST_PATTERN.test(host)) return '';
  const forwardedProto = trusted ? firstHeaderValue(req.get?.('x-forwarded-proto')) : undefined;
  const protocol = forwardedProto === 'https' || forwardedProto === 'http' ? forwardedProto : req.protocol || 'http';
  return `${protocol}://${host}`;
}

function normalizeOrigin(value: string): string | undefined {
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

/**
 * Reports whether a redirect target is safe to send a browser to.
 *
 * Same origin relative paths are always allowed. Absolute urls are allowed only
 * when their origin matches the application's own origin or an explicitly
 * configured allow list, which is what stops `?destination_uri=https://evil`
 * from turning the authorization callback into an open redirect.
 */
export function isSafeRedirect(target: string, baseUrl?: string, allowedOrigins: string[] = []): boolean {
  if (!target || typeof target !== 'string') return false;
  // control characters and whitespace can split headers or confuse url parsers
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\s]/.test(target)) return false;
  // backslashes are normalized to slashes by some browsers, so `/\evil.com`
  // and `https:/\evil.com` must not be treated as relative
  if (target.includes('\\')) return false;
  if (target.startsWith('/')) {
    // `//host` is protocol relative and leaves the origin
    return !target.startsWith('//');
  }
  const targetOrigin = normalizeOrigin(target);
  if (!targetOrigin) return false;
  const protocol = new URL(target).protocol;
  if (protocol !== 'http:' && protocol !== 'https:') return false;
  const allowed = [...(baseUrl ? [baseUrl] : []), ...allowedOrigins]
    .map(normalizeOrigin)
    .filter((origin): origin is string => !!origin);
  return allowed.includes(targetOrigin);
}

const SENSITIVE_KEYS = [
  'access_token',
  'authorization',
  'client_secret',
  'code',
  'code_verifier',
  'id_token',
  'password',
  'refresh_token',
  'secret',
  'token',
];

/**
 * Strips credentials out of a string that may contain a form encoded request
 * body or a query string.
 */
export function redactSecrets(value: string): string {
  return SENSITIVE_KEYS.reduce(
    (redacted, key) => redacted.replace(new RegExp(`([?&;]|^)(${key})=[^&;\\s]*`, 'gi'), '$1$2=[REDACTED]'),
    value,
  );
}

/**
 * Renders an error as a single log safe line.
 *
 * Axios errors carry the full request config, including the form body of a
 * token request, so logging the raw error object leaks client secrets,
 * passwords, refresh tokens and authorization codes.
 */
export function describeError(err: unknown): string {
  const error = err as
    | (Error & {
        config?: { method?: string; url?: string };
        response?: { status?: number; statusText?: string };
      })
    | undefined;
  if (!error) return 'unknown error';
  const parts: string[] = [];
  if (error.config?.method || error.config?.url) {
    parts.push(`${(error.config.method || 'get').toUpperCase()} ${redactSecrets(error.config.url || '')}`);
  }
  if (error.response?.status) parts.push(`status ${error.response.status}`);
  parts.push(redactSecrets(error.message || String(err)));
  return parts.join(' - ');
}

/**
 * Replaces an error with one that carries no request or response payload, so
 * that credentials cannot escape through a consumer's exception filter.
 */
export function sanitizeError(err: unknown, message?: string): Error {
  const status = (err as { response?: { status?: number } })?.response?.status;
  const sanitized = new Error(message || describeError(err)) as Error & { status?: number };
  if (status) sanitized.status = status;
  return sanitized;
}
