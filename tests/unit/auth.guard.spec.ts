import { HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { AUTHORIZED } from '../../src/decorators/authorized.decorator';
import { PUBLIC } from '../../src/decorators/public.decorator';
import { AuthGuard } from '../../src/guards/auth.guard';
import { makeContext } from './helpers';

function createGuard(keycloakService: Partial<Record<string, any>> = {}) {
  const resolvedKeycloakService = {
    getGrant: vi.fn(async () => ({ access_token: {} })),
    getUsername: vi.fn(async () => 'alice'),
    isAuthorizedByRoles: vi.fn(async () => true),
    ...keycloakService,
  };
  return {
    guard: new AuthGuard(new Reflector(), resolvedKeycloakService as any),
    keycloakService: resolvedKeycloakService,
  };
}

describe('AuthGuard', () => {
  it('allows public routes without touching keycloak', async () => {
    const { guard, keycloakService } = createGuard();
    const context = makeContext({ handlerMetadata: { [PUBLIC]: true, [AUTHORIZED]: ['admin'] } });
    expect(await guard.canActivate(context)).toBe(true);
    expect(keycloakService.getGrant).not.toHaveBeenCalled();
  });

  it('allows routes without authorization metadata', async () => {
    const { guard, keycloakService } = createGuard();
    expect(await guard.canActivate(makeContext())).toBe(true);
    expect(keycloakService.getGrant).not.toHaveBeenCalled();
  });

  it('throws 401 when no grant can be resolved', async () => {
    const { guard } = createGuard({ getGrant: vi.fn(async () => undefined) });
    const context = makeContext({ handlerMetadata: { [AUTHORIZED]: [] } });
    await expect(guard.canActivate(context)).rejects.toSatisfy(
      (err: HttpException) => err instanceof HttpException && err.getStatus() === 401,
    );
  });

  it('throws 401 when the grant is invalid instead of leaking a server error', async () => {
    const { guard } = createGuard({
      getGrant: vi.fn(async () => {
        throw new Error('invalid token (wrong ISS)');
      }),
    });
    const context = makeContext({ handlerMetadata: { [AUTHORIZED]: [] } });
    await expect(guard.canActivate(context)).rejects.toSatisfy(
      (err: HttpException) => err instanceof HttpException && err.getStatus() === 401,
    );
  });

  it('grants access when roles match', async () => {
    const { guard, keycloakService } = createGuard();
    const context = makeContext({ handlerMetadata: { [AUTHORIZED]: ['admin'] } });
    expect(await guard.canActivate(context)).toBe(true);
    expect(keycloakService.isAuthorizedByRoles).toHaveBeenCalledWith(['admin']);
  });

  it('denies access when roles do not match', async () => {
    const { guard } = createGuard({ isAuthorizedByRoles: vi.fn(async () => false) });
    const context = makeContext({ handlerMetadata: { [AUTHORIZED]: ['admin'] } });
    expect(await guard.canActivate(context)).toBe(false);
  });

  it('denies access when the username cannot be resolved', async () => {
    const { guard } = createGuard({ getUsername: vi.fn(async () => undefined) });
    const context = makeContext({ handlerMetadata: { [AUTHORIZED]: [] } });
    expect(await guard.canActivate(context)).toBe(false);
  });

  it('merges class and handler roles', async () => {
    const { guard, keycloakService } = createGuard();
    const context = makeContext({
      handlerMetadata: { [AUTHORIZED]: ['editor'] },
      classMetadata: { [AUTHORIZED]: ['admin'] },
    });
    expect(await guard.canActivate(context)).toBe(true);
    expect(keycloakService.isAuthorizedByRoles).toHaveBeenCalledWith(['editor', 'admin']);
  });

  it('enforces class level roles on undecorated handlers', async () => {
    const { guard, keycloakService } = createGuard({ getGrant: vi.fn(async () => undefined) });
    const context = makeContext({ classMetadata: { [AUTHORIZED]: ['admin'] } });
    await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
    expect(keycloakService.getGrant).toHaveBeenCalled();
  });
});
