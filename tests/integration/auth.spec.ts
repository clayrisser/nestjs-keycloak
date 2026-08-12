import type { INestApplication } from '@nestjs/common';
import { Controller, Get, Inject, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import KeycloakModule from '../../src';
import { Authorized, Public, Resource, Scopes } from '../../src/decorators';
import KeycloakService from '../../src/keycloak.service';
import { adminGet, adminRequest, getAdminToken, passwordGrant } from './admin';
import { adminPassword, adminUsername, baseUrl, clientId, clientSecret, realm, users } from './config';

@Controller()
class TestController {
  constructor(@Inject(KeycloakService) private readonly keycloakService: KeycloakService) {}

  @Get('open')
  getOpen() {
    return { route: 'open' };
  }

  @Public()
  @Get('explicit-public')
  getExplicitPublic() {
    return { route: 'explicit-public' };
  }

  @Authorized()
  @Get('protected')
  getProtected() {
    return { route: 'protected' };
  }

  @Authorized('editor')
  @Get('editor')
  getEditor() {
    return { route: 'editor' };
  }

  @Authorized('realm:special')
  @Get('special')
  getSpecial() {
    return { route: 'special' };
  }

  @Authorized(['editor', 'realm:special'])
  @Get('intersection')
  getIntersection() {
    return { route: 'intersection' };
  }

  @Authorized()
  @Get('me')
  async getMe() {
    return this.keycloakService.getUserInfo();
  }

  @Authorized()
  @Get('roles')
  async getRoles() {
    return { roles: await this.keycloakService.getRoles() };
  }
}

@Resource('cats')
@Controller('cats')
class CatsController {
  @Scopes('read')
  @Get()
  find() {
    return [];
  }
}

@Module({
  imports: [
    KeycloakModule.register({
      baseUrl,
      realm,
      clientId,
      clientSecret,
      adminUsername,
      adminPassword,
      register: { roles: ['editor'] },
    }),
  ],
  controllers: [TestController, CatsController],
})
class AppModule {}

describe('keycloak auth flow', () => {
  let app: INestApplication;
  let url: string;
  let aliceToken: string;
  let bobToken: string;
  let clientUuid: string;

  async function request(path: string, token?: string) {
    return fetch(`${url}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }

  beforeAll(async () => {
    // boots the nest app, which also registers roles and resources with keycloak
    app = await NestFactory.create(AppModule, { logger: false });
    await app.listen(0);
    url = (await app.getUrl()).replace('[::1]', '127.0.0.1');
    // the editor client role only exists after module registration, so it is
    // assigned to alice here instead of in the suite provisioning
    const adminToken = await getAdminToken();
    const [client] = await adminGet<{ id: string }[]>(adminToken, `/realms/${realm}/clients?clientId=${clientId}`);
    clientUuid = client.id;
    const editorRole = await adminGet<{ id: string; name: string }>(
      adminToken,
      `/realms/${realm}/clients/${clientUuid}/roles/editor`,
    );
    const [alice] = await adminGet<{ id: string }[]>(adminToken, `/realms/${realm}/users?username=alice&exact=true`);
    await adminRequest(adminToken, 'POST', `/realms/${realm}/users/${alice.id}/role-mappings/clients/${clientUuid}`, [
      editorRole,
    ]);
    aliceToken = await passwordGrant(users.alice.username, users.alice.password);
    bobToken = await passwordGrant(users.bob.username, users.bob.password);
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('public routes', () => {
    it('allows anonymous access to undecorated routes', async () => {
      const res = await request('/open');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ route: 'open' });
    });

    it('allows anonymous access to @Public routes', async () => {
      const res = await request('/explicit-public');
      expect(res.status).toBe(200);
    });

    it('treats an invalid token as anonymous on public routes', async () => {
      const res = await request('/open', `${aliceToken.slice(0, -6)}tamper`);
      expect(res.status).toBe(200);
    });
  });

  describe('token validation', () => {
    it('rejects missing tokens with 401', async () => {
      const res = await request('/protected');
      expect(res.status).toBe(401);
    });

    it('rejects tampered tokens with 401', async () => {
      const res = await request('/protected', `${aliceToken.slice(0, -6)}tamper`);
      expect(res.status).toBe(401);
    });

    it('rejects garbage tokens with 401', async () => {
      const res = await request('/protected', 'garbage');
      expect(res.status).toBe(401);
    });

    it('accepts valid tokens', async () => {
      const res = await request('/protected', aliceToken);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ route: 'protected' });
    });
  });

  describe('role checks', () => {
    it('grants client roles', async () => {
      const res = await request('/editor', aliceToken);
      expect(res.status).toBe(200);
    });

    it('denies missing client roles with 403', async () => {
      const res = await request('/editor', bobToken);
      expect(res.status).toBe(403);
    });

    it('grants realm roles', async () => {
      const res = await request('/special', aliceToken);
      expect(res.status).toBe(200);
    });

    it('denies missing realm roles with 403', async () => {
      const res = await request('/special', bobToken);
      expect(res.status).toBe(403);
    });

    it('grants role intersections', async () => {
      const res = await request('/intersection', aliceToken);
      expect(res.status).toBe(200);
    });

    it('denies partial role intersections with 403', async () => {
      const res = await request('/intersection', bobToken);
      expect(res.status).toBe(403);
    });

    it('exposes prefixed roles through the service', async () => {
      const res = await request('/roles', aliceToken);
      expect(res.status).toBe(200);
      const { roles } = (await res.json()) as { roles: string[] };
      expect(roles).toContain('editor');
      expect(roles).toContain('realm:special');
    });
  });

  describe('user info', () => {
    it('resolves user info from the keycloak server', async () => {
      const res = await request('/me', aliceToken);
      expect(res.status).toBe(200);
      const userInfo = (await res.json()) as Record<string, any>;
      expect(userInfo.preferredUsername).toBe('alice');
      expect(userInfo.emailVerified).toBe(true);
      expect(userInfo.sub).toBeTruthy();
    });
  });

  describe('keycloak registration', () => {
    it('creates client roles declared by decorators and options', async () => {
      const adminToken = await getAdminToken();
      const roles = await adminGet<{ name: string }[]>(adminToken, `/realms/${realm}/clients/${clientUuid}/roles`);
      expect(roles.map((role) => role.name)).toContain('editor');
    });

    it('enables authorization services on the client', async () => {
      const adminToken = await getAdminToken();
      const client = await adminGet<{ authorizationServicesEnabled: boolean; serviceAccountsEnabled: boolean }>(
        adminToken,
        `/realms/${realm}/clients/${clientUuid}`,
      );
      expect(client.authorizationServicesEnabled).toBe(true);
      expect(client.serviceAccountsEnabled).toBe(true);
    });

    it('registers scoped resources from decorators', async () => {
      const adminToken = await getAdminToken();
      const resources = await adminGet<{ name: string; scopes?: { name: string }[] }[]>(
        adminToken,
        `/realms/${realm}/clients/${clientUuid}/authz/resource-server/resource`,
      );
      const cats = resources.find((resource) => resource.name === 'cats');
      expect(cats).toBeTruthy();
      const scopes = await adminGet<{ name: string }[]>(
        adminToken,
        `/realms/${realm}/clients/${clientUuid}/authz/resource-server/scope`,
      );
      expect(scopes.map((scope) => scope.name)).toContain('read');
    });
  });
});
