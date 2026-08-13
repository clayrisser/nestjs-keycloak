import { describe, expect, it, vi } from 'vitest';
import KeycloakService from '../../src/keycloak.service';
import type { KeycloakOptions } from '../../src/types';
import { clientId, makeJwt, makeToken } from './helpers';

interface CreateServiceOptions {
  options?: Partial<KeycloakOptions>;
  req?: any;
  grantManager?: Record<string, any>;
  keycloak?: Record<string, any>;
  httpService?: any;
}

function createService({
  options = {},
  req = {},
  grantManager = {},
  keycloak = {},
  httpService,
}: CreateServiceOptions = {}) {
  const resolvedOptions: KeycloakOptions = {
    baseUrl: 'http://keycloak.example.com',
    clientId,
    clientSecret: 'test-secret',
    realm: 'test',
    ...options,
  };
  const resolvedGrantManager = {
    clientId,
    isGrantRefreshable: () => false,
    validateGrant: vi.fn(async (grant: any) => grant),
    createGrant: vi.fn(),
    ...grantManager,
  };
  const resolvedKeycloak = { grantManager: resolvedGrantManager, ...keycloak };
  const resolvedHttpService = httpService || { axiosRef: { post: vi.fn() } };
  const resolvedReq = { headers: {}, ...req };
  const service = new KeycloakService(
    resolvedOptions,
    resolvedKeycloak as any,
    resolvedHttpService,
    resolvedReq,
    undefined,
  );
  return { service, req: resolvedReq, grantManager: resolvedGrantManager, httpService: resolvedHttpService };
}

describe('bearerToken', () => {
  it('parses a bearer authorization header', () => {
    const jwt = makeJwt({ preferred_username: 'alice' });
    const { service } = createService({ req: { headers: { authorization: `Bearer ${jwt}` } } });
    expect(service.bearerToken?.token).toBe(jwt);
    expect(service.bearerToken?.content?.preferred_username).toBe('alice');
  });

  it('parses a raw token when not strict', () => {
    const jwt = makeJwt({});
    const { service } = createService({ req: { headers: { authorization: jwt } } });
    expect(service.bearerToken?.token).toBe(jwt);
  });

  it('rejects a raw token when strict', () => {
    const jwt = makeJwt({});
    const { service } = createService({
      options: { strict: true },
      req: { headers: { authorization: jwt } },
    });
    expect(service.bearerToken).toBeUndefined();
  });

  it('returns undefined without an authorization header', () => {
    const { service } = createService();
    expect(service.bearerToken).toBeUndefined();
  });
});

describe('accessToken', () => {
  it('prefers the bearer token', () => {
    const jwt = makeJwt({});
    const { service } = createService({ req: { headers: { authorization: `Bearer ${jwt}` } } });
    expect(service.accessToken?.token).toBe(jwt);
  });

  it('falls back to the session token', () => {
    const jwt = makeJwt({});
    const { service } = createService({ req: { session: { kauth: { accessToken: jwt } } } });
    expect(service.accessToken?.token).toBe(jwt);
  });
});

describe('getGrant', () => {
  it('validates an existing grant on the request', async () => {
    const accessToken = makeToken({ preferred_username: 'alice' });
    const grant = { access_token: accessToken };
    const { service, grantManager } = createService({ req: { kauth: { grant } } });
    expect(await service.getGrant()).toBe(grant);
    expect(grantManager.validateGrant).toHaveBeenCalledWith(grant);
  });

  it('creates a grant from the bearer token', async () => {
    const jwt = makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600, typ: 'Bearer' });
    const grant = { access_token: makeToken({}) };
    const { service, grantManager, req } = createService({
      req: { headers: { authorization: `Bearer ${jwt}` } },
      grantManager: { createGrant: vi.fn(async () => grant) },
    });
    expect(await service.getGrant()).toBe(grant);
    expect(grantManager.createGrant).toHaveBeenCalledWith(
      expect.objectContaining({ access_token: jwt, token_type: 'Bearer' }),
    );
    expect((req as any).kauth.grant).toBe(grant);
  });

  it('returns undefined without credentials', async () => {
    const { service } = createService();
    expect(await service.getGrant()).toBeUndefined();
  });

  it('clears the grant when validation fails', async () => {
    const grant = { access_token: makeToken({}) };
    const { service, req } = createService({
      req: { kauth: { grant }, user: { roles: ['stale'] } },
      grantManager: {
        validateGrant: vi.fn(async () => {
          throw new Error('invalid token');
        }),
      },
    });
    await expect(service.getGrant()).rejects.toThrow('invalid token');
    expect((req as any).kauth).toBeUndefined();
    expect((req as any).user.roles).toBeUndefined();
  });
});

describe('roles and scopes', () => {
  const payload = {
    realm_access: { roles: ['admin'] },
    resource_access: { [clientId]: { roles: ['editor'] } },
    scope: 'openid profile',
    sub: 'user-id',
    preferred_username: 'alice',
  };

  function createServiceWithGrant() {
    const grant = { access_token: makeToken(payload) };
    return createService({ req: { kauth: { grant } } });
  }

  it('prefixes realm roles and merges client roles', async () => {
    const { service } = createServiceWithGrant();
    expect(await service.getRoles()).toEqual(['realm:admin', 'editor']);
  });

  it('strips the realm prefix for acl roles', async () => {
    const { service } = createServiceWithGrant();
    expect(await service.getACLRoles()).toEqual(['admin', 'editor']);
  });

  it('splits scopes', async () => {
    const { service } = createServiceWithGrant();
    expect(await service.getScopes()).toEqual(['openid', 'profile']);
  });

  it('resolves the user id and username', async () => {
    const { service } = createServiceWithGrant();
    expect(await service.getUserId()).toBe('user-id');
    expect(await service.getUsername()).toBe('alice');
  });
});

describe('isAuthorizedByRoles', () => {
  const payload = {
    realm_access: { roles: ['admin'] },
    resource_access: { [clientId]: { roles: ['one', 'two'] } },
  };

  function createServiceWithGrant() {
    const grant = { access_token: makeToken(payload) };
    return createService({ req: { kauth: { grant } } }).service;
  }

  it('always authorizes an empty role list', async () => {
    expect(await createServiceWithGrant().isAuthorizedByRoles([])).toBe(true);
  });

  it('authorizes a matching client role', async () => {
    expect(await createServiceWithGrant().isAuthorizedByRoles(['one'])).toBe(true);
  });

  it('authorizes a matching realm role', async () => {
    expect(await createServiceWithGrant().isAuthorizedByRoles(['realm:admin'])).toBe(true);
  });

  it('rejects a missing role', async () => {
    expect(await createServiceWithGrant().isAuthorizedByRoles(['three'])).toBe(false);
  });

  it('requires every role of an intersection', async () => {
    expect(await createServiceWithGrant().isAuthorizedByRoles([['one', 'two']])).toBe(true);
    expect(await createServiceWithGrant().isAuthorizedByRoles([['one', 'three']])).toBe(false);
  });

  it('requires any role of a union', async () => {
    expect(await createServiceWithGrant().isAuthorizedByRoles(['three', ['one', 'two']])).toBe(true);
    expect(await createServiceWithGrant().isAuthorizedByRoles(['three', ['one', 'four']])).toBe(false);
  });

  it('denies when there is no access token at all', async () => {
    expect(await createService().service.isAuthorizedByRoles(['one'])).toBe(false);
  });

  it('does not treat a non array argument as an empty role list', async () => {
    // reading `.length` off a bare string used to short circuit into an allow
    expect(await createServiceWithGrant().isAuthorizedByRoles('three' as any)).toBe(false);
    expect(await createServiceWithGrant().isAuthorizedByRoles('one' as any)).toBe(true);
  });

  it('does not treat an empty intersection as satisfied', async () => {
    expect(await createServiceWithGrant().isAuthorizedByRoles([[]])).toBe(false);
  });
});

describe('getUserInfo', () => {
  it('normalizes user info from the grant manager', async () => {
    const accessToken = makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 });
    const grant = { access_token: accessToken };
    const userInfo = vi.fn(async () => ({
      email_verified: true,
      family_name: 'Liddell',
      given_name: 'Alice',
      preferred_username: 'alice',
      sub: 'user-id',
    }));
    const { service } = createService({ req: { kauth: { grant } }, grantManager: { userInfo } });
    expect(await service.getUserInfo()).toEqual({
      emailVerified: true,
      familyName: 'Liddell',
      givenName: 'Alice',
      preferredUsername: 'alice',
      sub: 'user-id',
    });
  });

  it('prefers user info cached on the session', async () => {
    const sessionUserInfo = { emailVerified: true, preferredUsername: 'alice', sub: 'user-id' };
    const { service } = createService({ req: { session: { kauth: { userInfo: sessionUserInfo } } } });
    expect(await service.getUserInfo()).toBe(sessionUserInfo);
  });
});

describe('directGrant', () => {
  it('posts a password grant and persists the session', async () => {
    const accessToken = makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 });
    const refreshToken = makeToken({});
    const grant = { access_token: accessToken, refresh_token: refreshToken };
    const post = vi.fn(async () => ({ data: { access_token: accessToken.token } }));
    const { service, req } = createService({
      req: { session: {} },
      grantManager: { createGrant: vi.fn(async () => grant) },
      httpService: { axiosRef: { post } },
    });
    expect(await service.directGrant({ username: 'alice', password: 'password', clientId })).toBe(grant);
    const [url, body] = post.mock.calls[0] as any;
    expect(url).toBe('http://keycloak.example.com/realms/test/protocol/openid-connect/token');
    const params = new URLSearchParams(body);
    expect(params.get('grant_type')).toBe('password');
    expect(params.get('username')).toBe('alice');
    expect(params.get('scope')).toBe('openid profile');
    expect((req as any).session.kauth.accessToken).toBe(accessToken.token);
    expect((req as any).session.kauth.refreshToken).toBe(refreshToken.token);
  });
});

describe('logout', () => {
  function createLogoutService(kauth: Record<string, any> = { accessToken: 'token', refreshToken: 'refresh' }) {
    const destroy = vi.fn((callback: (err?: Error) => void) => callback());
    const post = vi.fn(async () => ({ data: {} }));
    return {
      post,
      destroy,
      ...createService({
        req: { session: { kauth, token: 'token', destroy } },
        httpService: { axiosRef: { post } },
      }),
    };
  }

  it('clears the session', async () => {
    const { service, req, destroy } = createLogoutService();
    await service.logout('http://app.example.com');
    expect(destroy).toHaveBeenCalled();
    expect((req as any).session.kauth).toBeUndefined();
  });

  it('revokes the refresh token at keycloak over the back channel', async () => {
    const { service, post } = createLogoutService();
    await service.logout('http://app.example.com');
    const [url, body] = post.mock.calls[0] as any;
    expect(url).toBe('http://keycloak.example.com/realms/test/protocol/openid-connect/logout');
    const params = new URLSearchParams(body);
    expect(params.get('refresh_token')).toBe('refresh');
    expect(params.get('client_id')).toBe(clientId);
    expect(params.get('client_secret')).toBe('test-secret');
  });

  it('still tears down the local session when revocation fails', async () => {
    const post = vi.fn(async () => {
      throw Object.assign(new Error('Request failed with status code 400'), {
        config: { method: 'post', url: 'http://keycloak.example.com/logout', data: 'client_secret=test-secret' },
        response: { status: 400 },
      });
    });
    const destroy = vi.fn((callback: (err?: Error) => void) => callback());
    const { service, req } = createService({
      req: { session: { kauth: { refreshToken: 'refresh' }, destroy } },
      httpService: { axiosRef: { post } },
    });
    await expect(service.logout('http://app.example.com')).resolves.toMatchObject({ redirect: expect.any(String) });
    expect((req as any).session.kauth).toBeUndefined();
  });

  it('keeps the post logout redirect that keycloak-connect would have dropped', async () => {
    const { service } = createLogoutService();
    const { redirect } = await service.logout('http://app.example.com/bye');
    const url = new URL(redirect!);
    expect(url.pathname).toBe('/realms/test/protocol/openid-connect/logout');
    expect(url.searchParams.get('post_logout_redirect_uri')).toBe('http://app.example.com/bye');
    expect(url.searchParams.get('client_id')).toBe(clientId);
  });

  it('prefers an id token hint when one was stored', async () => {
    const { service } = createLogoutService({ refreshToken: 'refresh', idToken: 'id-token' });
    const { redirect } = await service.logout('http://app.example.com/bye');
    const url = new URL(redirect!);
    expect(url.searchParams.get('id_token_hint')).toBe('id-token');
    expect(url.searchParams.get('post_logout_redirect_uri')).toBe('http://app.example.com/bye');
  });
});

describe('credential hygiene', () => {
  it('does not let the token request body escape through a failed grant', async () => {
    const post = vi.fn(async () => {
      throw Object.assign(new Error('Request failed with status code 401'), {
        config: {
          method: 'post',
          url: 'http://keycloak.example.com/realms/test/protocol/openid-connect/token',
          data: 'client_id=test-client&username=alice&password=hunter2&grant_type=password',
          headers: { Authorization: 'Basic dGVzdDpodW50ZXIy' },
        },
        response: { status: 401, data: { error: 'invalid_grant' } },
      });
    });
    const { service } = createService({ httpService: { axiosRef: { post } } });
    const err = await service.directGrant({ username: 'alice', password: 'hunter2', clientId }).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as any).config).toBeUndefined();
    expect((err as any).response).toBeUndefined();
    const serialized = `${err.message}${err.stack}${JSON.stringify(err)}`;
    expect(serialized).not.toContain('hunter2');
    expect(err.message).toContain('401');
  });
});
