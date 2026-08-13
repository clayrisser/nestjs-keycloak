import type { INestApplication } from '@nestjs/common';
import { Controller, Get, Module, Req, Res } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import session from 'express-session';
import type { Request, Response } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import KeycloakModule from '../../src';
import { createAuthState } from '../../src/authState';
import { AuthorizationCallback, Public } from '../../src/decorators';
import type { KeycloakRequest } from '../../src/types';
import { CookieJar, login } from './browser';
import { adminPassword, adminUsername, baseUrl, clientId, clientSecret, realm, users } from './config';

let appUrl = '';

@Controller()
class LoginController {
  // starts the flow the way a consumer would: mint a state, bind it to this
  // browser, and hand the browser off to keycloak
  @Public()
  @Get('login')
  startLogin(@Req() req: KeycloakRequest<Request>, @Res() res: Response) {
    const state = createAuthState(req, res, { secret: clientSecret });
    const redirectUri = `${appUrl}/auth/callback?destination_uri=${encodeURIComponent('/done')}`;
    const url = `${baseUrl}/realms/${realm}/protocol/openid-connect/auth?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid',
      state,
    }).toString()}`;
    res.json({ url, state });
  }

  @Public()
  @AuthorizationCallback({ destinationUri: '/done' })
  @Get('auth/callback')
  authCallback() {
    return { route: 'callback' };
  }

  @Public()
  @Get('done')
  done() {
    return { route: 'done' };
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
    }),
  ],
  controllers: [LoginController],
})
class AppModule {}

describe('authorization code flow', () => {
  let app: INestApplication;

  async function startLogin() {
    const jar = new CookieJar();
    const res = await jar.fetch(`${appUrl}/login`);
    const { url, state } = (await res.json()) as { url: string; state: string };
    return { jar, url, state };
  }

  // runs a real login at keycloak and returns the untouched callback url
  async function authorize(jar: CookieJar, url: string) {
    return login(jar, url, users.alice.username, users.alice.password);
  }

  function callbackUrl(callback: URL, overrides: Record<string, string | null> = {}) {
    const target = new URL(`${appUrl}${callback.pathname}${callback.search}`);
    Object.entries(overrides).forEach(([key, value]) => {
      if (value === null) target.searchParams.delete(key);
      else target.searchParams.set(key, value);
    });
    return target.toString();
  }

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: process.env.DEBUG_APP ? undefined : false });
    app.use(
      session({
        secret: 'integration-session-secret',
        resave: false,
        saveUninitialized: true,
      }),
    );
    await app.listen(0);
    appUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  });

  afterAll(async () => {
    await app?.close();
  });

  it('issues a high entropy state and binds it to the browser', async () => {
    const { state } = await startLogin();
    expect(Buffer.from(state, 'base64url').length).toBeGreaterThanOrEqual(16);
  });

  it('accepts a callback carrying the state it issued', async () => {
    const { jar, url, state } = await startLogin();
    const callback = await authorize(jar, url);
    expect(callback.searchParams.get('state')).toBe(state);
    const res = await jar.fetch(callbackUrl(callback));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/done');
  });

  it('does not permanently cache the post login redirect', async () => {
    const { jar, url } = await startLogin();
    const callback = await authorize(jar, url);
    const res = await jar.fetch(callbackUrl(callback));
    expect(res.status).not.toBe(301);
  });

  it('rejects a callback with no state parameter', async () => {
    const { jar, url } = await startLogin();
    const callback = await authorize(jar, url);
    const res = await jar.fetch(callbackUrl(callback, { state: null }));
    expect(res.status).toBe(403);
    expect(await res.text()).toContain('missing');
  });

  it('rejects a callback with the wrong state', async () => {
    const { jar, url } = await startLogin();
    const callback = await authorize(jar, url);
    const res = await jar.fetch(callbackUrl(callback, { state: 'attacker-chosen-state' }));
    expect(res.status).toBe(403);
  });

  it('rejects a replayed callback url', async () => {
    const { jar, url } = await startLogin();
    const callback = await authorize(jar, url);
    const first = await jar.fetch(callbackUrl(callback));
    expect(first.status).toBe(302);
    const replay = await jar.fetch(callbackUrl(callback));
    expect(replay.status).toBe(403);
  });

  it('rejects a login started in another browser', async () => {
    // the classic login csrf: the attacker runs the flow, then feeds their
    // callback url to the victim so the victim ends up in the attacker's account
    const attacker = await startLogin();
    const attackerCallback = await authorize(attacker.jar, attacker.url);
    const victim = await startLogin();
    const res = await victim.jar.fetch(callbackUrl(attackerCallback));
    expect(res.status).toBe(403);
  });

  it('never sends the browser off origin when destination_uri is tampered with', async () => {
    const { jar, url } = await startLogin();
    const callback = await authorize(jar, url);
    const res = await jar.fetch(callbackUrl(callback, { destination_uri: 'https://evil.example.net/steal' }));
    expect(res.headers.get('location') || '').not.toContain('evil.example.net');
    expect(await res.text()).not.toContain('evil.example.net');
  });

  it('never sends the browser off origin when the login was started with a hostile destination', async () => {
    // the attack that survives the state check: the attacker influences the
    // destination the application itself puts into the authorization request
    const jar = new CookieJar();
    const started = await jar.fetch(`${appUrl}/login?destination=${encodeURIComponent('https://evil.example.net')}`);
    const { url } = (await started.json()) as { url: string };
    const hostile = new URL(url);
    hostile.searchParams.set(
      'redirect_uri',
      `${appUrl}/auth/callback?destination_uri=${encodeURIComponent('https://evil.example.net/steal')}`,
    );
    const callback = await authorize(jar, hostile.toString());
    const res = await jar.fetch(callbackUrl(callback));
    expect(res.headers.get('location') || '').not.toContain('evil.example.net');
  });

  it('does not leak the client secret when the code exchange fails', async () => {
    const { jar, url } = await startLogin();
    const callback = await authorize(jar, url);
    const res = await jar.fetch(callbackUrl(callback, { code: 'not-a-real-code' }));
    const body = await res.text();
    expect(body).not.toContain(clientSecret);
    expect(body).not.toContain('client_secret');
  });
});
