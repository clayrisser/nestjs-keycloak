import type { INestApplication } from '@nestjs/common';
import { Controller, Get, Inject, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import session from 'express-session';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import KeycloakModule from '../../src';
import { Authorized, Public } from '../../src/decorators';
import KeycloakService from '../../src/keycloak.service';
import { adminGet, adminRequest, getAdminToken, passwordGrantTokens, refreshGrant } from './admin';
import {
  adminPassword,
  adminUsername,
  baseUrl,
  clientId,
  clientSecret,
  otherClientId,
  otherClientSecret,
  realm,
  users,
} from './config';

@Controller()
class ProbeController {
  constructor(@Inject(KeycloakService) private readonly keycloakService: KeycloakService) {}

  @Authorized()
  @Get('protected')
  getProtected() {
    return { route: 'protected' };
  }

  @Public()
  @Get('session-login')
  async sessionLogin() {
    const grant = await this.keycloakService.directGrant({
      username: users.bob.username,
      password: users.bob.password,
    });
    return { refreshToken: (grant?.refresh_token as any)?.token };
  }

  @Public()
  @Get('session-logout')
  async sessionLogout() {
    return this.keycloakService.logout('http://127.0.0.1:1/bye');
  }
}

function makeModule(verifyTokenAudience: boolean) {
  @Module({
    imports: [
      KeycloakModule.register({
        baseUrl,
        realm,
        clientId,
        clientSecret,
        adminUsername,
        adminPassword,
        verifyTokenAudience,
      }),
    ],
    controllers: [ProbeController],
  })
  class AppModule {}
  return AppModule;
}

async function boot(verifyTokenAudience: boolean) {
  const app = await NestFactory.create(makeModule(verifyTokenAudience), { logger: false });
  app.use(session({ secret: 'integration-session-secret', resave: false, saveUninitialized: true }));
  await app.listen(0);
  return { app, url: (await app.getUrl()).replace('[::1]', '127.0.0.1') };
}

describe('token validation', () => {
  let lenient: { app: INestApplication; url: string };
  let strict: { app: INestApplication; url: string };
  let ownToken: string;
  let foreignToken: string;

  async function request(url: string, path: string, token?: string) {
    return fetch(`${url}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  }

  beforeAll(async () => {
    // an audience mapper is what makes `aud` contain this client id at all; the
    // verifyTokenAudience option is useless without it, which is exactly why it
    // cannot be turned on by default
    const adminToken = await getAdminToken();
    const [client] = await adminGet<{ id: string }[]>(adminToken, `/realms/${realm}/clients?clientId=${clientId}`);
    await adminRequest(adminToken, 'POST', `/realms/${realm}/clients/${client.id}/protocol-mappers/models`, {
      name: 'audience',
      protocol: 'openid-connect',
      protocolMapper: 'oidc-audience-mapper',
      config: { 'included.client.audience': clientId, 'access.token.claim': 'true' },
    });
    ownToken = (await passwordGrantTokens(users.carol.username, users.carol.password)).access_token;
    foreignToken = (
      await passwordGrantTokens(users.carol.username, users.carol.password, otherClientId, otherClientSecret)
    ).access_token;
    lenient = await boot(false);
    strict = await boot(true);
  });

  function claims(token: string) {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as {
      aud: string | string[];
      azp: string;
    };
  }

  afterAll(async () => {
    await lenient?.app?.close();
    await strict?.app?.close();
  });

  describe('audience', () => {
    it('sets up the two tokens the audience check is meant to tell apart', () => {
      expect(claims(ownToken).azp).toBe(clientId);
      expect(claims(ownToken).aud).toContain(clientId);
      expect(claims(foreignToken).azp).toBe(otherClientId);
      // keycloak's audience resolve mapper would add `nestjs` here if carol
      // held any role on that client, which is why she deliberately holds none
      expect([claims(foreignToken).aud].flat()).not.toContain(clientId);
    });

    it('accepts this client’s own token', async () => {
      expect((await request(strict.url, '/protected', ownToken)).status).toBe(200);
      expect((await request(lenient.url, '/protected', ownToken)).status).toBe(200);
    });

    it('rejects a token minted for another client when verifyTokenAudience is on', async () => {
      expect((await request(strict.url, '/protected', foreignToken)).status).toBe(401);
    });

    it('documents that the default configuration accepts a sibling client’s token', async () => {
      // this is upstream keycloak-connect behaviour, kept as the default so the
      // option does not silently break realms without an audience mapper
      expect((await request(lenient.url, '/protected', foreignToken)).status).toBe(200);
    });
  });

  describe('logout', () => {
    it('revokes the refresh token at keycloak instead of only clearing the cookie', async () => {
      const cookieJar: string[] = [];
      const loginRes = await fetch(`${lenient.url}/session-login`);
      const setCookie = loginRes.headers.getSetCookie();
      cookieJar.push(...setCookie.map((raw) => raw.split(';')[0]));
      const { refreshToken } = (await loginRes.json()) as { refreshToken: string };
      expect(refreshToken).toBeTruthy();
      // the refresh token works before logout
      expect((await refreshGrant(refreshToken)).status).toBe(200);
      const logoutRes = await fetch(`${lenient.url}/session-logout`, { headers: { cookie: cookieJar.join('; ') } });
      expect(logoutRes.status).toBe(200);
      // and is dead afterwards, without the caller having followed the redirect
      const afterLogout = await refreshGrant(refreshToken);
      expect(afterLogout.status).toBe(400);
    });

    it('keeps the post logout redirect uri', async () => {
      const logoutRes = await fetch(`${lenient.url}/session-logout`);
      const { redirect } = (await logoutRes.json()) as { redirect: string };
      const url = new URL(redirect);
      expect(url.pathname).toBe(`/realms/${realm}/protocol/openid-connect/logout`);
      expect(url.searchParams.get('post_logout_redirect_uri')).toBe('http://127.0.0.1:1/bye');
    });
  });
});
