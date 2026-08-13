import { describe, expect, it, vi } from 'vitest';
import {
  AUTH_STATE_COOKIE,
  clearAuthState,
  consumeAuthState,
  createAuthState,
  timingSafeEqualString,
} from '../../src/authState';

const secret = 'test-client-secret';

function makeReq(overrides: Record<string, any> = {}) {
  return { session: { kauth: {} }, cookies: {}, ...overrides } as any;
}

function makeRes() {
  const cookies: Record<string, { value: string; options: any }> = {};
  return {
    cookies,
    cookie: vi.fn((name: string, value: string, options: any) => {
      cookies[name] = { value, options };
    }),
    clearCookie: vi.fn((name: string) => {
      delete cookies[name];
    }),
  } as any;
}

// mirrors the browser handing the cookie back on the callback request
function withCookies(req: any, res: any) {
  req.cookies = Object.entries(res.cookies).reduce((cookies: Record<string, string>, [name, cookie]: [string, any]) => {
    cookies[name] = cookie.value;
    return cookies;
  }, {});
  return req;
}

describe('oauth state', () => {
  describe('createAuthState', () => {
    it('generates at least 128 bits of entropy', () => {
      const req = makeReq();
      const state = createAuthState(req, makeRes(), { secret });
      expect(Buffer.from(state, 'base64url').length).toBeGreaterThanOrEqual(16);
    });

    it('never repeats a value', () => {
      const states = new Set(Array.from({ length: 50 }, () => createAuthState(makeReq(), makeRes(), { secret })));
      expect(states.size).toBe(50);
    });

    it('binds the state to the session', () => {
      const req = makeReq();
      const state = createAuthState(req, makeRes(), { secret });
      expect(req.session.kauth.authStates.map((entry: any) => entry.value)).toEqual([state]);
    });

    it('binds the state to an http only same site cookie when there is no session', () => {
      const req = makeReq({ session: undefined });
      const res = makeRes();
      createAuthState(req, res, { secret, secure: true });
      const [, , options] = res.cookie.mock.calls[0];
      expect(options).toMatchObject({ httpOnly: true, sameSite: 'lax', secure: true });
    });

    it('does not write a cookie when a session store is available', () => {
      const res = makeRes();
      createAuthState(makeReq(), res, { secret });
      expect(res.cookie).not.toHaveBeenCalled();
    });

    it('refuses to start a flow it cannot bind', () => {
      expect(() => createAuthState(makeReq({ session: undefined }), undefined, { secret })).toThrow(/express-session/);
    });

    it('caps the number of pending states', () => {
      const req = makeReq();
      const res = makeRes();
      Array.from({ length: 25 }, () => createAuthState(req, res, { secret }));
      expect(req.session.kauth.authStates.length).toBeLessThanOrEqual(10);
    });
  });

  describe('consumeAuthState', () => {
    it('accepts the state it issued', () => {
      const req = makeReq();
      const res = makeRes();
      const state = createAuthState(req, res, { secret });
      expect(consumeAuthState(req, res, state, { secret })).toEqual({ valid: true });
    });

    it('rejects a missing state', () => {
      const req = makeReq();
      const res = makeRes();
      createAuthState(req, res, { secret });
      expect(consumeAuthState(req, res, undefined, { secret })).toEqual({ valid: false, reason: 'missing' });
    });

    it('rejects an empty state', () => {
      const req = makeReq();
      const res = makeRes();
      createAuthState(req, res, { secret });
      expect(consumeAuthState(req, res, '', { secret })).toEqual({ valid: false, reason: 'missing' });
    });

    it('rejects a state this browser never received', () => {
      const req = makeReq();
      const res = makeRes();
      createAuthState(req, res, { secret });
      expect(consumeAuthState(req, res, 'attacker-chosen-state', { secret })).toEqual({
        valid: false,
        reason: 'mismatch',
      });
    });

    it('rejects a state issued to a different browser', () => {
      const victim = makeReq();
      const attacker = makeReq();
      createAuthState(victim, makeRes(), { secret });
      const attackerState = createAuthState(attacker, makeRes(), { secret });
      expect(consumeAuthState(victim, makeRes(), attackerState, { secret })).toEqual({
        valid: false,
        reason: 'mismatch',
      });
    });

    it('rejects a replayed state', () => {
      const req = makeReq();
      const res = makeRes();
      const state = createAuthState(req, res, { secret });
      expect(consumeAuthState(withCookies(req, res), res, state, { secret })).toEqual({ valid: true });
      expect(consumeAuthState(withCookies(req, res), res, state, { secret })).toEqual({
        valid: false,
        reason: 'unknown',
      });
    });

    it('does not let a cookie resurrect a state the session already burned', () => {
      const req = makeReq({ session: undefined });
      const res = makeRes();
      const state = createAuthState(req, res, { secret });
      const cookieValue = res.cookies[AUTH_STATE_COOKIE].value;
      // the same browser later gains a session store; the stale cookie must be
      // ignored rather than acting as a second, unburnable copy of the state
      const withSession = makeReq({ cookies: { [AUTH_STATE_COOKIE]: cookieValue } });
      expect(consumeAuthState(withSession, res, state, { secret })).toEqual({ valid: false, reason: 'unknown' });
    });

    it('rejects when nothing is pending', () => {
      expect(consumeAuthState(makeReq(), makeRes(), 'anything', { secret })).toEqual({
        valid: false,
        reason: 'unknown',
      });
    });

    it('rejects an expired state', () => {
      const req = makeReq();
      const res = makeRes();
      const state = createAuthState(req, res, { secret, ttl: -1 });
      expect(consumeAuthState(req, res, state, { secret })).toEqual({ valid: false, reason: 'expired' });
    });

    it('accepts a cookie bound state when there is no session', () => {
      const req = makeReq({ session: undefined });
      const res = makeRes();
      const state = createAuthState(req, res, { secret });
      expect(consumeAuthState(withCookies(req, res), res, state, { secret })).toEqual({ valid: true });
    });

    it('rejects a forged cookie', () => {
      const req = makeReq({ session: undefined, cookies: { [AUTH_STATE_COOKIE]: `forged.${Date.now() + 10000}.xx` } });
      expect(consumeAuthState(req, makeRes(), 'forged', { secret })).toEqual({ valid: false, reason: 'unknown' });
    });

    it('rejects a cookie whose signature was made with another secret', () => {
      const req = makeReq({ session: undefined });
      const res = makeRes();
      const state = createAuthState(req, res, { secret: 'other-secret' });
      expect(consumeAuthState(withCookies(req, res), res, state, { secret })).toEqual({
        valid: false,
        reason: 'unknown',
      });
    });

    it('keeps other pending flows alive when one completes', () => {
      const req = makeReq();
      const res = makeRes();
      const first = createAuthState(req, res, { secret });
      const second = createAuthState(req, res, { secret });
      expect(consumeAuthState(req, res, first, { secret })).toEqual({ valid: true });
      expect(consumeAuthState(req, res, second, { secret })).toEqual({ valid: true });
    });
  });

  describe('clearAuthState', () => {
    it('drops every pending state', () => {
      const req = makeReq();
      const res = makeRes();
      const state = createAuthState(req, res, { secret });
      clearAuthState(req, res);
      expect(consumeAuthState(req, res, state, { secret })).toEqual({ valid: false, reason: 'unknown' });
    });
  });

  describe('timingSafeEqualString', () => {
    it('matches equal strings', () => {
      expect(timingSafeEqualString('abc', 'abc')).toBe(true);
    });

    it('does not throw on different lengths', () => {
      expect(timingSafeEqualString('a', 'abcdefghijklmnop')).toBe(false);
    });
  });
});
