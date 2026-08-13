import { describe, expect, it } from 'vitest';
import {
  describeError,
  getBaseUrl,
  isSafeRedirect,
  redactSecrets,
  sanitizeError,
  trustsProxy,
} from '../../src/security';

function makeReq(headers: Record<string, string> = {}, overrides: Record<string, any> = {}) {
  return {
    protocol: 'http',
    hostname: 'app.example.com',
    get: (name: string) => headers[name.toLowerCase()],
    ...overrides,
  } as any;
}

// mimics express storing a compiled `trust proxy fn` on the app
function withTrustProxy(req: any, trusted: boolean) {
  req.app = { get: (key: string) => (key === 'trust proxy fn' ? () => trusted : undefined) };
  req.socket = { remoteAddress: '10.0.0.1' };
  return req;
}

describe('getBaseUrl', () => {
  it('uses the host header', () => {
    expect(getBaseUrl(makeReq({ host: 'app.example.com' }))).toBe('http://app.example.com');
  });

  it('prefers an explicitly configured base url', () => {
    expect(getBaseUrl(makeReq({ host: 'app.example.com' }), 'https://public.example.com/')).toBe(
      'https://public.example.com',
    );
  });

  it('ignores x-forwarded-host when the app does not trust a proxy', () => {
    const req = makeReq({ host: 'app.example.com', 'x-forwarded-host': 'evil.example.net' });
    expect(getBaseUrl(req)).toBe('http://app.example.com');
  });

  it('ignores x-forwarded-proto when the app does not trust a proxy', () => {
    const req = makeReq({ host: 'app.example.com', 'x-forwarded-proto': 'https' });
    expect(getBaseUrl(req)).toBe('http://app.example.com');
  });

  it('honours x-forwarded-host when the app trusts a proxy', () => {
    const req = withTrustProxy(
      makeReq({ host: 'internal:3000', 'x-forwarded-host': 'app.example.com', 'x-forwarded-proto': 'https' }),
      true,
    );
    expect(getBaseUrl(req)).toBe('https://app.example.com');
  });

  it('takes only the first value of a forwarded header chain', () => {
    const req = withTrustProxy(makeReq({ host: 'internal', 'x-forwarded-host': 'app.example.com, evil.net' }), true);
    expect(getBaseUrl(req)).toBe('http://app.example.com');
  });

  it('rejects a host header that is not a bare host', () => {
    expect(getBaseUrl(makeReq({ host: 'app.example.com/evil' }))).toBe('');
    expect(getBaseUrl(makeReq({ host: 'app.example.com:80@evil.net' }))).toBe('');
  });

  it('accepts a host with a port', () => {
    expect(getBaseUrl(makeReq({ host: 'localhost:3000' }))).toBe('http://localhost:3000');
  });

  it('accepts a bracketed ipv6 host', () => {
    expect(getBaseUrl(makeReq({ host: '[::1]:3000' }))).toBe('http://[::1]:3000');
  });

  it('never returns the request url as a base url', () => {
    expect(getBaseUrl(makeReq({}, { hostname: undefined, originalUrl: '/some/path' }))).toBe('');
  });
});

describe('trustsProxy', () => {
  it('is false without an express app', () => {
    expect(trustsProxy(makeReq())).toBe(false);
  });

  it('follows the compiled express trust proxy setting', () => {
    expect(trustsProxy(withTrustProxy(makeReq(), true))).toBe(true);
    expect(trustsProxy(withTrustProxy(makeReq(), false))).toBe(false);
  });
});

describe('isSafeRedirect', () => {
  const baseUrl = 'https://app.example.com';

  it('allows a relative path', () => {
    expect(isSafeRedirect('/dashboard?tab=1', baseUrl)).toBe(true);
  });

  it('allows a same origin absolute url', () => {
    expect(isSafeRedirect('https://app.example.com/dashboard', baseUrl)).toBe(true);
  });

  it('rejects a cross origin url', () => {
    expect(isSafeRedirect('https://evil.example.net/', baseUrl)).toBe(false);
  });

  it('rejects a protocol relative url', () => {
    expect(isSafeRedirect('//evil.example.net/', baseUrl)).toBe(false);
  });

  it('rejects a backslash smuggled host', () => {
    expect(isSafeRedirect('/\\evil.example.net', baseUrl)).toBe(false);
    expect(isSafeRedirect('https:/\\evil.example.net', baseUrl)).toBe(false);
  });

  it('rejects a javascript url', () => {
    expect(isSafeRedirect('javascript:alert(1)', baseUrl)).toBe(false);
  });

  it('rejects a data url', () => {
    expect(isSafeRedirect('data:text/html,<script>alert(1)</script>', baseUrl)).toBe(false);
  });

  it('rejects an embedded newline', () => {
    expect(isSafeRedirect('/ok\nLocation: https://evil.example.net', baseUrl)).toBe(false);
  });

  it('rejects a userinfo confusion url', () => {
    expect(isSafeRedirect('https://app.example.com@evil.example.net/', baseUrl)).toBe(false);
  });

  it('rejects a host that merely starts with the trusted host', () => {
    expect(isSafeRedirect('https://app.example.com.evil.net/', baseUrl)).toBe(false);
  });

  it('rejects a port mismatch', () => {
    expect(isSafeRedirect('https://app.example.com:8443/', baseUrl)).toBe(false);
  });

  it('allows an explicitly allow listed origin', () => {
    expect(isSafeRedirect('https://other.example.com/x', baseUrl, ['https://other.example.com'])).toBe(true);
  });

  it('rejects empty input', () => {
    expect(isSafeRedirect('', baseUrl)).toBe(false);
  });

  it('rejects everything when there is no known base url', () => {
    expect(isSafeRedirect('https://app.example.com/x', '')).toBe(false);
  });
});

describe('redactSecrets', () => {
  it('redacts credentials in a form body', () => {
    const body = 'client_id=nestjs&client_secret=hunter2&username=alice&password=s3cret&grant_type=password';
    const redacted = redactSecrets(body);
    expect(redacted).not.toContain('hunter2');
    expect(redacted).not.toContain('s3cret');
    expect(redacted).toContain('client_id=nestjs');
  });

  it('redacts tokens in a query string', () => {
    const redacted = redactSecrets('https://kc/callback?code=abc123&state=xyz');
    expect(redacted).not.toContain('abc123');
    expect(redacted).toContain('state=xyz');
  });
});

describe('describeError', () => {
  it('never includes the axios request body', () => {
    const err = Object.assign(new Error('Request failed with status code 401'), {
      config: {
        method: 'post',
        url: 'https://kc/realms/x/protocol/openid-connect/token',
        data: 'client_secret=hunter2&password=s3cret',
        headers: { Authorization: 'Basic bmVzdGpzOmh1bnRlcjI=' },
      },
      response: { status: 401, data: { error: 'invalid_client' } },
    });
    const described = describeError(err);
    expect(described).not.toContain('hunter2');
    expect(described).not.toContain('s3cret');
    expect(described).not.toContain('Basic');
    expect(described).toContain('status 401');
  });

  it('handles a plain error', () => {
    expect(describeError(new Error('boom'))).toBe('boom');
  });
});

describe('sanitizeError', () => {
  it('drops the axios config and response', () => {
    const err = Object.assign(new Error('Request failed with status code 400'), {
      config: { method: 'post', url: 'https://kc/token', data: 'client_secret=hunter2' },
      response: { status: 400, data: { error_description: 'bad' } },
    });
    const sanitized = sanitizeError(err, 'keycloak token request failed') as any;
    expect(sanitized.config).toBeUndefined();
    expect(sanitized.response).toBeUndefined();
    expect(sanitized.status).toBe(400);
    expect(JSON.stringify(Object.getOwnPropertyNames(sanitized).map((key) => (sanitized as any)[key]))).not.toContain(
      'hunter2',
    );
  });
});
