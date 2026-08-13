import { ForbiddenException, HttpException } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { createAuthState } from '../../src/authState';
import {
  AUTHORIZATION_CALLBACK,
  AuthorizationCallbackInterceptor,
} from '../../src/decorators/authorizationCallback.decorator';
import { makeContext } from './helpers';

const clientSecret = 'test-client-secret';
const appBaseUrl = 'https://app.example.com';

function makeRes() {
  const res: any = {
    statusCode: undefined,
    redirected: undefined,
    cookies: {} as Record<string, any>,
  };
  res.cookie = vi.fn((name: string, value: string, options: any) => {
    res.cookies[name] = { value, options };
  });
  res.clearCookie = vi.fn((name: string) => {
    delete res.cookies[name];
  });
  res.status = vi.fn((status: number) => {
    res.statusCode = status;
    return res;
  });
  res.redirect = vi.fn((url: string) => {
    res.redirected = url;
  });
  return res;
}

function makeKeycloakService(overrides: Record<string, any> = {}) {
  return {
    appBaseUrl,
    allowedRedirectOrigins: [],
    requireAuthorizationState: true,
    authStateOptions: { secret: clientSecret },
    authorizationCodeGrant: vi.fn(async () => ({ access_token: { token: 'access' } })),
    ...overrides,
  } as any;
}

interface RunOptions {
  query: string;
  keycloakService?: Record<string, any>;
  callback?: Record<string, any>;
  session?: any;
  seedState?: boolean;
}

function run({ query, keycloakService = {}, callback = {}, session = { kauth: {} }, seedState = false }: RunOptions) {
  const service = makeKeycloakService(keycloakService);
  const res = makeRes();
  const req: any = { session, cookies: {}, originalUrl: '' };
  // seeding happens first so that a test can send a state other than the one
  // that was actually issued to this browser
  const state = seedState ? createAuthState(req, res, service.authStateOptions) : undefined;
  req.originalUrl = `/auth/callback?${query.includes('state=') ? query : [query, state && `state=${encodeURIComponent(state)}`].filter(Boolean).join('&')}`;
  const context = makeContext({
    req,
    res,
    handlerMetadata: {
      [AUTHORIZATION_CALLBACK]: { destinationUriFromQuery: true, ...callback },
      [PATH_METADATA]: 'callback',
    },
    classMetadata: { [PATH_METADATA]: 'auth' },
  });
  const interceptor = new AuthorizationCallbackInterceptor(service, new Reflector());
  return {
    service,
    req,
    res,
    state,
    intercept: () => interceptor.intercept(context, { handle: () => of(null) }),
  };
}

describe('AuthorizationCallbackInterceptor', () => {
  describe('oauth state verification', () => {
    it('accepts a callback carrying the state it issued', async () => {
      const { intercept, res, service } = run({
        query: `code=abc&destination_uri=${encodeURIComponent('/dashboard')}`,
        seedState: true,
      });
      await intercept();
      expect(service.authorizationCodeGrant).toHaveBeenCalled();
      expect(res.redirected).toBe('/dashboard');
    });

    it('rejects a callback with no state at all', async () => {
      const { intercept, service } = run({
        query: `code=abc&destination_uri=${encodeURIComponent('/dashboard')}`,
      });
      await expect(intercept()).rejects.toBeInstanceOf(ForbiddenException);
      expect(service.authorizationCodeGrant).not.toHaveBeenCalled();
    });

    it('rejects a callback with an attacker chosen state', async () => {
      const { intercept, service } = run({
        query: `code=abc&state=attacker&destination_uri=${encodeURIComponent('/dashboard')}`,
        seedState: true,
      });
      await expect(intercept()).rejects.toSatisfy(
        (err: HttpException) => err instanceof ForbiddenException && /mismatch/.test(err.message),
      );
      expect(service.authorizationCodeGrant).not.toHaveBeenCalled();
    });

    it('rejects a callback whose state was never issued by this app', async () => {
      const { intercept, service } = run({
        query: `code=abc&state=never-issued&destination_uri=${encodeURIComponent('/dashboard')}`,
      });
      await expect(intercept()).rejects.toSatisfy(
        (err: HttpException) => err instanceof ForbiddenException && /unknown/.test(err.message),
      );
      expect(service.authorizationCodeGrant).not.toHaveBeenCalled();
    });

    it('rejects a state that belongs to a different browser', async () => {
      const attackerReq: any = { session: { kauth: {} }, cookies: {} };
      const attackerState = createAuthState(attackerReq, makeRes(), { secret: clientSecret });
      const { intercept, service } = run({
        query: `code=abc&state=${encodeURIComponent(attackerState)}&destination_uri=${encodeURIComponent('/x')}`,
      });
      await expect(intercept()).rejects.toBeInstanceOf(ForbiddenException);
      expect(service.authorizationCodeGrant).not.toHaveBeenCalled();
    });

    it('rejects a replayed callback url', async () => {
      const { intercept, service } = run({
        query: `code=abc&destination_uri=${encodeURIComponent('/dashboard')}`,
        seedState: true,
      });
      await intercept();
      expect(service.authorizationCodeGrant).toHaveBeenCalledTimes(1);
      await expect(intercept()).rejects.toBeInstanceOf(ForbiddenException);
      expect(service.authorizationCodeGrant).toHaveBeenCalledTimes(1);
    });

    it('rejects an expired state', async () => {
      const { intercept } = run({
        query: `code=abc&destination_uri=${encodeURIComponent('/dashboard')}`,
        keycloakService: { authStateOptions: { secret: clientSecret, ttl: -1 } },
        seedState: true,
      });
      await expect(intercept()).rejects.toSatisfy((err: HttpException) => /expired/.test(err.message));
    });

    it('verifies the state before spending the authorization code', async () => {
      const { intercept, service } = run({ query: 'code=abc&state=wrong' });
      await expect(intercept()).rejects.toBeInstanceOf(ForbiddenException);
      expect(service.authorizationCodeGrant).not.toHaveBeenCalled();
    });

    it('can be opted out of per callback', async () => {
      const { intercept, service } = run({
        query: `code=abc&destination_uri=${encodeURIComponent('/dashboard')}`,
        callback: { requireState: false },
      });
      await intercept();
      expect(service.authorizationCodeGrant).toHaveBeenCalled();
    });

    it('can be opted out of module wide', async () => {
      const { intercept, service } = run({
        query: `code=abc&destination_uri=${encodeURIComponent('/dashboard')}`,
        keycloakService: { requireAuthorizationState: false },
      });
      await intercept();
      expect(service.authorizationCodeGrant).toHaveBeenCalled();
    });
  });

  describe('destination uri', () => {
    it('refuses to redirect off origin', async () => {
      const { intercept, res } = run({
        query: `code=abc&destination_uri=${encodeURIComponent('https://evil.example.net/steal')}`,
        callback: { destinationUri: '/home' },
        seedState: true,
      });
      await intercept();
      expect(res.redirected).toBe('/home');
    });

    it('rejects an off origin destination with no safe fallback', async () => {
      const { intercept } = run({
        query: `code=abc&destination_uri=${encodeURIComponent('https://evil.example.net/steal')}`,
        seedState: true,
      });
      await expect(intercept()).rejects.toSatisfy((err: HttpException) => err.getStatus() === 400);
    });

    it('rejects a protocol relative destination', async () => {
      const { intercept } = run({
        query: `code=abc&destination_uri=${encodeURIComponent('//evil.example.net/steal')}`,
        seedState: true,
      });
      await expect(intercept()).rejects.toSatisfy((err: HttpException) => err.getStatus() === 400);
    });

    it('allows a same origin absolute destination', async () => {
      const { intercept, res } = run({
        query: `code=abc&destination_uri=${encodeURIComponent(`${appBaseUrl}/dashboard`)}`,
        seedState: true,
      });
      await intercept();
      expect(res.redirected).toBe(`${appBaseUrl}/dashboard`);
    });

    it('allows an explicitly allow listed origin', async () => {
      const { intercept, res } = run({
        query: `code=abc&destination_uri=${encodeURIComponent('https://other.example.com/next')}`,
        keycloakService: { allowedRedirectOrigins: ['https://other.example.com'] },
        seedState: true,
      });
      await intercept();
      expect(res.redirected).toBe('https://other.example.com/next');
    });
  });

  describe('callback hygiene', () => {
    it('answers a missing authorization code with a 400 rather than a 500', async () => {
      const { intercept } = run({ query: 'error=access_denied', seedState: true });
      await expect(intercept()).rejects.toSatisfy((err: HttpException) => err.getStatus() === 400);
    });

    it('marks the redirect_from cookie http only', async () => {
      const { intercept, res } = run({
        query: `code=abc&destination_uri=${encodeURIComponent('/dashboard')}`,
        seedState: true,
      });
      await intercept();
      expect(res.cookies.redirect_from.options).toMatchObject({ httpOnly: true, sameSite: 'lax', secure: true });
    });
  });
});
