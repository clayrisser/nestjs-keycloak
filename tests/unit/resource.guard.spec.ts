import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { RESOURCE } from '../../src/decorators/resource.decorator';
import { SCOPES } from '../../src/decorators/scopes.decorator';
import { ResourceGuard } from '../../src/guards/resource.guard';
import type { KeycloakOptions } from '../../src/types';
import { clientId, makeContext, makeToken } from './helpers';

interface CreateGuardOptions {
  deny?: boolean;
}

function createGuard({ deny = false }: CreateGuardOptions = {}) {
  const options: KeycloakOptions = {
    baseUrl: 'http://keycloak.example.com',
    clientId,
    clientSecret: 'test-secret',
    realm: 'test',
  };
  const enforce = vi.fn((_permissions: string[]) => (req: any, _res: any, next: () => void) => {
    req.resourceDenied = deny;
    next();
  });
  const keycloak = {
    grantManager: {
      clientId,
      isGrantRefreshable: () => false,
      validateGrant: vi.fn(async (grant: any) => grant),
    },
    enforcer: enforce,
  };
  const guard = new ResourceGuard(options, keycloak as any, { axiosRef: { post: vi.fn() } } as any, new Reflector());
  return { guard, enforce };
}

function createResourceContext({ scopes }: { scopes?: string[] } = {}) {
  const grant = { access_token: makeToken({ preferred_username: 'alice' }) };
  return makeContext({
    classMetadata: { [RESOURCE]: 'cats' },
    handlerMetadata: scopes ? { [SCOPES]: scopes } : {},
    req: { headers: {}, kauth: { grant } },
  });
}

describe('ResourceGuard', () => {
  it('allows routes without a resource', async () => {
    const { guard, enforce } = createGuard();
    expect(await guard.canActivate(makeContext({ req: { headers: {} } }))).toBe(true);
    expect(enforce).not.toHaveBeenCalled();
  });

  it('allows resources without scopes', async () => {
    const { guard, enforce } = createGuard();
    expect(await guard.canActivate(createResourceContext())).toBe(true);
    expect(enforce).not.toHaveBeenCalled();
  });

  it('grants scoped resources when the enforcer allows', async () => {
    const { guard, enforce } = createGuard();
    expect(await guard.canActivate(createResourceContext({ scopes: ['read', 'write'] }))).toBe(true);
    expect(enforce).toHaveBeenCalledWith(['cats:read', 'cats:write']);
  });

  it('denies scoped resources when the enforcer denies', async () => {
    const { guard } = createGuard({ deny: true });
    expect(await guard.canActivate(createResourceContext({ scopes: ['read'] }))).toBe(false);
  });

  it('denies scoped resources without an authenticated user', async () => {
    const { guard, enforce } = createGuard();
    const context = makeContext({
      classMetadata: { [RESOURCE]: 'cats' },
      handlerMetadata: { [SCOPES]: ['read'] },
      req: { headers: {} },
    });
    expect(await guard.canActivate(context)).toBe(false);
    expect(enforce).not.toHaveBeenCalled();
  });
});
