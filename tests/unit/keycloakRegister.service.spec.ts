import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { Authorized } from '../../src/decorators/authorized.decorator';
import { Resource } from '../../src/decorators/resource.decorator';
import { Scopes } from '../../src/decorators/scopes.decorator';
import KeycloakRegisterService from '../../src/keycloakRegister.service';
import type { KeycloakOptions } from '../../src/types';

@Resource('cats')
@Authorized('realm:boss')
class CatsController {
  @Authorized('admin', ['editor', 'reviewer'])
  @Scopes('read')
  find() {}

  @Scopes('write')
  create() {}
}

class CatsResolver {
  @Authorized('resolver-role')
  cats() {}
}

class IgnoredProvider {
  ignored() {}
}

function createService(options: Partial<KeycloakOptions> = {}) {
  const resolvedOptions: KeycloakOptions = {
    baseUrl: 'http://keycloak.example.com',
    clientId: 'test-client',
    clientSecret: 'test-secret',
    realm: 'test',
    // admin overlaps with a decorator role to prove roles are deduplicated
    register: { roles: ['extra', 'realm:xtra', 'admin'], resources: { dogs: ['walk'] } },
    ...options,
  };
  const discoveryService = {
    getProviders: () => [
      { name: 'CatsResolver', instance: new CatsResolver(), metatype: CatsResolver },
      { name: 'IgnoredProvider', instance: new IgnoredProvider(), metatype: IgnoredProvider },
      { name: 'ValueProvider', instance: {}, metatype: null },
    ],
    getControllers: () => [{ name: 'CatsController', instance: new CatsController(), metatype: CatsController }],
  };
  const httpService = { axiosRef: { get: vi.fn() } };
  const service = new KeycloakRegisterService(
    resolvedOptions,
    discoveryService as any,
    new Reflector(),
    httpService as any,
  );
  return { service, httpService };
}

describe('KeycloakRegisterService', () => {
  it('collects roles from decorators and register options', () => {
    const { service } = createService();
    expect(new Set((service as any).roles)).toEqual(
      new Set(['admin', 'editor', 'reviewer', 'realm:boss', 'resolver-role', 'extra', 'realm:xtra']),
    );
  });

  it('deduplicates roles declared in both decorators and register options', () => {
    const { service } = createService();
    const roles = (service as any).roles as string[];
    expect(roles.length).toBe(new Set(roles).size);
  });

  it('splits application and realm roles', () => {
    const { service } = createService();
    expect(new Set((service as any).applicationRoles)).toEqual(
      new Set(['admin', 'editor', 'reviewer', 'resolver-role', 'extra']),
    );
    expect(new Set((service as any).realmRoles)).toEqual(new Set(['boss', 'xtra']));
  });

  it('aggregates resources and scopes from decorators and register options', () => {
    const { service } = createService();
    const resources = (service as any).resources;
    expect(new Set(resources.cats)).toEqual(new Set(['read', 'write']));
    expect(resources.dogs).toEqual(['walk']);
  });

  it('skips registration without admin credentials', async () => {
    const { service, httpService } = createService();
    await service.register();
    expect(httpService.axiosRef.get).not.toHaveBeenCalled();
  });

  it('skips registration when register is disabled', async () => {
    const { service, httpService } = createService({
      adminUsername: 'admin',
      adminPassword: 'admin',
      register: false,
    });
    await service.register();
    expect(httpService.axiosRef.get).not.toHaveBeenCalled();
  });
});
