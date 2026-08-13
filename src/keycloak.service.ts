/**
 * File: /src/keycloak.service.ts
 * Project: nestjs-keycloak
 * File Created: 14-07-2021 11:43:59
 * Author: Clay Risser <email@clayrisser.com>
 * -----
 * Last Modified: 17-04-2023 22:42:10
 * Modified By: Clay Risser
 * -----
 * Risser Labs LLC (c) Copyright 2021
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import Token from 'keycloak-connect/middleware/auth-utils/token';
import qs from 'qs';
import type KcAdminClient from '@keycloak/keycloak-admin-client' with { 'resolution-mode': 'import' };
import type UserRepresentation from '@keycloak/keycloak-admin-client/lib/defs/userRepresentation.js' with {
  'resolution-mode': 'import',
};
import type { AxiosError } from 'axios';
import type { ExecutionContext } from '@nestjs/common';
import type { Grant, Keycloak } from 'keycloak-connect';
import type { Request, NextFunction, Response } from 'express';
import { HttpService } from '@nestjs/axios';
import { Injectable, Inject, Scope, Logger } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { CREATE_KEYCLOAK_ADMIN } from './createKeycloakAdmin.provider';
import { KEYCLOAK } from './keycloak.provider';
import { getReq } from './util';
import { describeError, sanitizeError } from './security';
import { DEFAULT_AUTH_STATE_TTL } from './authState';
import type { AuthStateOptions } from './authState';
import type {
  AuthorizationCodeGrantOptions,
  ClientCredentialsGrantOptions,
  SmartGrantOptions,
  GraphqlCtx,
  KeycloakOptions,
  KeycloakRequest,
  DirectGrantOptions,
  RefreshTokenGrantOptions,
  UserInfo,
} from './types';
import { KEYCLOAK_OPTIONS } from './types';

@Injectable({ scope: Scope.REQUEST })
export default class KeycloakService {
  private options: KeycloakOptions;

  private logger = new Logger(KeycloakService.name);

  constructor(
    @Inject(KEYCLOAK_OPTIONS) options: KeycloakOptions,
    @Inject(KEYCLOAK) private readonly keycloak: Keycloak,
    @Inject(HttpService) private readonly httpService: HttpService,
    @Inject(REQUEST)
    reqOrExecutionContext: KeycloakRequest<Request> | ExecutionContext | GraphqlCtx,
    @Inject(CREATE_KEYCLOAK_ADMIN)
    private readonly createKeycloakAdmin?: () => Promise<KcAdminClient | void>,
  ) {
    this.options = {
      ensureFreshness: true,
      ...options,
    };
    this.req = getReq(reqOrExecutionContext);
  }

  req: KeycloakRequest<Request>;

  private _bearerToken: Token | undefined;

  private _refreshToken: Token | undefined;

  private _accessToken: Token | undefined;

  private _userInfo: UserInfo | undefined;

  private _grant: Grant | undefined;

  get clientId(): string {
    return (this.keycloak.grantManager as any).clientId;
  }

  get appBaseUrl(): string | undefined {
    return this.options.appBaseUrl;
  }

  get allowedRedirectOrigins(): string[] {
    return this.options.allowedRedirectOrigins || [];
  }

  get requireAuthorizationState(): boolean {
    return this.options.requireAuthorizationState !== false;
  }

  get authStateOptions(): AuthStateOptions {
    return {
      secret: this.options.clientSecret,
      ttl: this.options.authorizationStateTtl ?? DEFAULT_AUTH_STATE_TTL,
      secure: (this.options.appBaseUrl || '').startsWith('https:') || this.req?.protocol === 'https',
    };
  }

  get bearerToken(): Token | undefined {
    if (this._bearerToken) return this._bearerToken;
    const { strict } = this.options;
    const { authorization } = this.req.headers;
    if (typeof authorization === 'undefined') return undefined;
    if (authorization?.indexOf(' ') <= -1) {
      if (strict) return undefined;
      this._bearerToken = new Token(authorization, this.clientId);
      return this._bearerToken;
    }
    const authorizationArr = authorization?.split(' ');
    if (authorizationArr?.[0] && authorizationArr[0].toLowerCase() === 'bearer') {
      this._bearerToken = new Token(authorizationArr[1], this.clientId);
      return this._bearerToken;
    }
    return undefined;
  }

  get refreshToken(): Token | undefined {
    if (this._refreshToken) return this._refreshToken;
    this._refreshToken = this.req.session?.kauth?.refreshToken
      ? new Token(this.req.session?.kauth.refreshToken, this.clientId)
      : undefined;
    return this._refreshToken;
  }

  get accessToken(): Token | undefined {
    if (this._accessToken) return this._accessToken;
    if (this.bearerToken) {
      this._accessToken = this.bearerToken;
      return this._accessToken;
    }
    let accessToken = this.req.kauth?.grant?.access_token as Token | undefined;
    if (!accessToken && this.req.session?.kauth?.accessToken) {
      accessToken = new Token(this.req.session?.kauth?.accessToken, this.clientId);
    }
    this._accessToken = accessToken;
    return this._accessToken;
  }

  async getGrant(force = false): Promise<Grant | undefined> {
    if (!force && this._grant) return this._grant;
    await this.setOptions();
    if (!this.req.kauth) this.req.kauth = {};
    if (this.req.kauth.grant) {
      try {
        const grant = await this.validateGrant(this.req.kauth.grant);
        await this.afterGrant(grant);
      } catch (err) {
        this.clearGrant();
        throw err;
      }
    } else {
      if (!this.accessToken) {
        this.clearGrant();
        return;
      }
      try {
        const grant = await this.createGrant(this.accessToken, this.refreshToken);
        await this.afterGrant(grant);
      } catch (err) {
        this.clearGrant();
        throw err;
      }
    }
    if (!this._grant) this.clearGrant();
    return this._grant;
  }

  async getAccessToken(): Promise<Token | undefined> {
    return (await this.getGrant())?.access_token as Token;
  }

  async getRefreshToken(): Promise<Token | undefined> {
    return (await this.getGrant())?.refresh_token as Token;
  }

  async getRoles(): Promise<string[] | undefined> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) return;
    return [
      ...(accessToken.content?.realm_access?.roles || []).map((role: string) => `realm:${role}`),
      ...(accessToken.content?.resource_access?.[this.clientId]?.roles || []),
    ];
  }

  async getACLRoles(): Promise<string[] | undefined> {
    const roles = await this.getRoles();
    if (!roles) return;
    return roles.map((role: string) => role.replace(/^realm:/g, ''));
  }

  async getScopes(): Promise<string[] | undefined> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) return;
    return (accessToken.content?.scope || '').split(' ');
  }

  async getUserInfo(force = false): Promise<UserInfo | undefined> {
    await this.getGrant();
    if (this._userInfo && !force) return this._userInfo;
    if (this.req.kauth?.userInfo) {
      this._userInfo = this.req.kauth.userInfo;
      return this._userInfo;
    }
    if (!this.bearerToken && this.req.session?.kauth?.userInfo) {
      this._userInfo = this.req.session.kauth.userInfo;
      return this._userInfo;
    }
    const accessToken = await this.getAccessToken();
    const userInfo =
      accessToken &&
      !accessToken.isExpired() &&
      (await this.keycloak.grantManager.userInfo<
        Token | string,
        {
          email_verified: boolean;
          family_name?: string;
          given_name?: string;
          preferred_username: string;
          sub: string;
          [key: string]: any;
        }
      >(accessToken));
    if (!userInfo) return;
    const result = {
      emailVerified: userInfo?.email_verified,
      familyName: userInfo?.family_name,
      givenName: userInfo?.given_name,
      preferredUsername: userInfo?.preferred_username,
      ...userInfo,
    } as UserInfo;
    delete result?.email_verified;
    delete result?.family_name;
    delete result?.given_name;
    delete result?.preferred_username;
    this._userInfo = result;
    return this._userInfo;
  }

  async getUserId(): Promise<string | undefined> {
    const accessToken = await this.getAccessToken();
    return accessToken?.content?.sub;
  }

  async getUsername(): Promise<string | undefined> {
    const accessToken = await this.getAccessToken();
    return accessToken?.content?.preferred_username;
  }

  async isAuthorizedByRoles(roles: (string | string[])[] = []): Promise<boolean> {
    const accessToken = await this.getAccessToken();
    // normalize before the length check, otherwise a non array argument reads
    // `length` as undefined and short circuits into an unconditional allow
    const rolesArr = Array.isArray(roles) ? roles : [roles];
    if (!rolesArr.length) return true;
    if (!accessToken) return false;
    return rolesArr.some((role: string | string[]) => {
      if (Array.isArray(role)) {
        return role.length > 0 && role.every((innerRole: string) => accessToken.hasRole(innerRole));
      }
      return typeof role === 'string' && accessToken.hasRole(role);
    });
  }

  // username must start with `service-account-`
  async getClientFromServiceAccountUsername(username?: string) {
    if (!this.createKeycloakAdmin) return null;
    if (!username) username = await this.getUsername();
    if (!username) return;
    const clientId = (username.match(/service-account-(.+)/) || [])?.[1];
    if (!clientId) return;
    const keycloakAdmin = await this.createKeycloakAdmin();
    if (!keycloakAdmin) return;
    try {
      return (
        (await keycloakAdmin.clients.findOne({
          clientId,
        } as any)) || undefined
      );
    } catch (err) {
      const error = err as AxiosError;
      if (error.response?.status !== 404) throw sanitizeError(err);
      this.logger.debug(`service account client lookup returned 404: ${describeError(err)}`);
      return;
    }
  }

  async getUser(userId?: string): Promise<UserRepresentation | undefined> {
    if (!this.createKeycloakAdmin) return;
    if (!userId) userId = await this.getUserId();
    if (!userId) return;
    const keycloakAdmin = await this.createKeycloakAdmin();
    if (!keycloakAdmin) return;
    try {
      return (await keycloakAdmin.users.findOne({ id: userId })) || undefined;
    } catch (err) {
      const error = err as AxiosError;
      if (error.response?.status !== 404) throw sanitizeError(err);
      return;
    }
  }

  async smartGrant(options: SmartGrantOptions, persistSession = true): Promise<Grant | undefined> {
    let grant: Grant | undefined;
    if (options.refreshToken) {
      grant = await this.refreshTokenGrant(
        {
          refreshToken: options.refreshToken,
          clientId: options.clientId,
        },
        persistSession,
      );
    } else if (options.code) {
      grant = await this.authorizationCodeGrant(
        {
          code: options.code,
          redirectUri: options.redirectUri,
          clientId: options.clientId,
          sessionHost: options.sessionHost,
          sessionId: options.sessionId,
          codeVerifier: options.codeVerifier,
        },
        persistSession,
      );
    } else if (options.clientSecret) {
      grant = await this.clientCredentialsGrant(
        {
          clientId: options.clientId,
          clientSecret: options.clientSecret,
          scope: options.scope,
        },
        persistSession,
      );
    } else if (options.username && options.password) {
      grant = await this.directGrant(
        {
          username: options.username,
          password: options.password,
          scope: options.scope,
          clientId: options.clientId,
        },
        persistSession,
      );
    }
    return grant;
  }

  async directGrant(
    { username, password, scope, clientId }: DirectGrantOptions,
    persistSession = true,
  ): Promise<Grant | undefined> {
    let grant: Grant | undefined;
    if (clientId) {
      grant = await this.tokenGrant({
        client_id: clientId,
        username,
        password,
        grant_type: 'password',
        scope: this.serializeScope(scope),
      });
    } else {
      grant = await this.keycloak.grantManager.obtainDirectly(
        username,
        password,
        // @ts-ignore missing scope argument
        undefined,
        this.serializeScope(scope),
      );
    }
    if (!grant) return;
    if (persistSession)
      this.sessionSetTokens(grant.access_token as Token, grant.refresh_token as Token, grant.id_token as Token);
    await this.afterGrant(grant);
    return grant;
  }

  async clientCredentialsGrant(
    { clientId, clientSecret, scope }: ClientCredentialsGrantOptions,
    persistSession = true,
  ): Promise<Grant | undefined> {
    if (!clientSecret) clientSecret = this.options.clientSecret;
    let grant: Grant | undefined;
    if (clientId) {
      grant = await this.tokenGrant({
        ...(clientSecret ? { client_secret: clientSecret } : {}),
        client_id: clientId,
        grant_type: 'client_credentials',
        scope: this.serializeScope(scope),
      });
    } else {
      grant = await this.keycloak.grantManager.obtainFromClientCredentials(
        // @ts-ignore missing scope argument
        undefined,
        this.serializeScope(scope),
      );
    }
    if (!grant) return;
    if (persistSession)
      this.sessionSetTokens(grant.access_token as Token, grant.refresh_token as Token, grant.id_token as Token);
    await this.afterGrant(grant);
    return grant;
  }

  async refreshTokenGrant(
    { refreshToken, clientId }: RefreshTokenGrantOptions,
    persistSession = true,
  ): Promise<Grant | undefined> {
    if (!clientId) clientId = this.clientId;
    const grant = await this.tokenGrant({
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    if (!grant) return;
    if (persistSession)
      this.sessionSetTokens(grant.access_token as Token, grant.refresh_token as Token, grant.id_token as Token);
    await this.afterGrant(grant);
    return grant;
  }

  async authorizationCodeGrant(
    { code, redirectUri, clientId, sessionHost, sessionId, codeVerifier }: AuthorizationCodeGrantOptions,
    persistSession = true,
  ): Promise<Grant | undefined> {
    let grant: Grant | undefined;
    if (clientId || redirectUri || codeVerifier) {
      if (!clientId) clientId = this.clientId;
      if (!redirectUri) redirectUri = this.req.session ? this.req.session.auth_redirect_uri : undefined;
      grant = await this.tokenGrant({
        ...(sessionId ? { client_session_state: sessionId } : {}),
        ...(sessionHost ? { client_session_host: sessionHost } : {}),
        ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
        ...(this.options.clientSecret ? { client_secret: this.options.clientSecret } : {}),
        code,
        grant_type: 'authorization_code',
        client_id: clientId,
        redirect_uri: redirectUri,
      });
    } else {
      grant = await this.keycloak.grantManager.obtainFromCode(
        // @ts-ignore first argument is req
        this.req,
        code,
        sessionId,
        sessionHost,
      );
    }
    if (!grant) return undefined;
    if (persistSession)
      this.sessionSetTokens(grant.access_token as Token, grant.refresh_token as Token, grant.id_token as Token);
    await this.afterGrant(grant);
    return grant;
  }

  async enforce(permissions: string[]) {
    await this.getGrant();
    return new Promise<boolean>((resolve) => {
      return this.keycloak.enforcer(permissions)(
        this.req,
        {} as Response,
        ((_: Request, _res: Response, _next: NextFunction) => {
          if (this.req.resourceDenied) return resolve(false);
          return resolve(true);
        }) as NextFunction,
      );
    });
  }

  /**
   * Ends the session locally and at keycloak.
   *
   * The refresh token is revoked over the back channel first, so that a caller
   * which never follows the returned redirect (an api client, a fetch based
   * front end) cannot keep minting access tokens from the old session.
   */
  async logout(redirectUri?: string): Promise<LogoutResult> {
    const refreshToken = this.req.session?.kauth?.refreshToken || (this._grant?.refresh_token as Token)?.token;
    const idToken = this.req.session?.kauth?.idToken || (this._grant?.id_token as Token)?.token;
    await this.revokeSession(refreshToken);
    this.clearGrant();
    await this.clearSession();
    return { redirect: this.buildLogoutUrl(redirectUri, idToken) };
  }

  /**
   * Ends the keycloak side session without waiting for a front channel
   * redirect. Failures are logged and swallowed, because the local session has
   * to be torn down either way.
   */
  private async revokeSession(refreshToken?: string) {
    if (!refreshToken) return;
    try {
      await this.httpService.axiosRef.post(
        `${this.realmUrl}/protocol/openid-connect/logout`,
        qs.stringify({
          client_id: this.clientId,
          ...(this.options.clientSecret ? { client_secret: this.options.clientSecret } : {}),
          refresh_token: refreshToken,
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
    } catch (err) {
      this.logger.warn(`failed to revoke the keycloak session: ${describeError(err)}`);
    }
  }

  /**
   * keycloak-connect's `logoutUrl` silently drops the redirect unless an
   * `id_token_hint` is supplied, so the url is built here instead. keycloak
   * validates `post_logout_redirect_uri` against the client's registered uris.
   */
  private buildLogoutUrl(redirectUri?: string, idToken?: string): string {
    const url = new URL(`${this.realmUrl}/protocol/openid-connect/logout`);
    if (redirectUri) {
      url.searchParams.set('post_logout_redirect_uri', redirectUri);
      if (idToken) {
        url.searchParams.set('id_token_hint', idToken);
      } else {
        url.searchParams.set('client_id', this.clientId);
      }
    }
    return url.toString();
  }

  private get realmUrl(): string {
    return `${(this.options.baseUrl || '').replace(/\/+$/, '')}/realms/${this.options.realm}`;
  }

  /**
   * Exchanges credentials at the token endpoint and builds a validated grant.
   */
  private async tokenGrant(params: Record<string, string | undefined>): Promise<Grant | undefined> {
    const data = await this.postToken(params);
    // keycloak-connect types the raw token response as if it already held Token
    // objects, when the wire format is plain strings
    return this.keycloak.grantManager.createGrant(data as any);
  }

  private async postToken(params: Record<string, string | undefined>): Promise<TokenResponseData> {
    const body = Object.entries(params).reduce((body: Record<string, string>, [key, value]) => {
      if (typeof value !== 'undefined') body[key] = value;
      return body;
    }, {});
    try {
      const res = await this.httpService.axiosRef.post(
        `${this.realmUrl}/protocol/openid-connect/token`,
        qs.stringify(body),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
      return res.data;
    } catch (err) {
      // an axios error carries the request config, and therefore the form body
      // holding the client secret, the user's password, the refresh token or
      // the authorization code. never let that object escape this method
      throw sanitizeError(
        err,
        `keycloak ${body.grant_type || 'token'} request failed${
          (err as AxiosError)?.response?.status ? ` with status ${(err as AxiosError).response!.status}` : ''
        }`,
      );
    }
  }

  private async afterGrant(grant?: Grant) {
    if (!grant) {
      this.clearGrant();
      return;
    }
    this._userInfo = undefined;
    this._grant = grant;
    this._accessToken = grant.access_token as Token;
    if (grant.refresh_token) {
      this._refreshToken = grant.refresh_token as Token;
    }
    if (!this.req.kauth) this.req.kauth = {};
    this.req.kauth.grant = grant;
    this.req.kauth.keycloak = this;
    const aclRoles = await this.getACLRoles();
    if (aclRoles && this.req.user) {
      this.req.user.roles = aclRoles;
    }
  }

  private clearGrant() {
    this._accessToken = undefined;
    this._bearerToken = undefined;
    this._grant = undefined;
    this._refreshToken = undefined;
    this._userInfo = undefined;
    delete this.req.kauth;
    if (this.req.user) {
      delete this.req.user.roles;
    }
  }

  private async clearSession() {
    if (!this.req.session) return;
    delete this.req.session.kauth;
    delete this.req.session.token;
    await new Promise<void>((resolve, reject) => {
      if (!this.req.session?.destroy) return resolve();
      this.req.session?.destroy((err: Error) => {
        if (err) return reject(err);
        return resolve();
      });
    });
    return;
  }

  private sessionSetTokens(accessToken?: Token, refreshToken?: Token, idToken?: Token) {
    if (this.req.session) {
      if (!this.req.session.kauth) this.req.session.kauth = {};
      if (refreshToken) {
        this.req.session.kauth.refreshToken = refreshToken.token;
      }
      if (idToken) {
        // kept only so that logout can send an `id_token_hint`
        this.req.session.kauth.idToken = idToken.token;
      }
      if (accessToken) {
        this.req.session.kauth.accessToken = accessToken.token;
        this.req.session.token = accessToken.token;
      }
    }
  }

  private async setOptions() {
    if (!this.req.kauth) this.req.kauth = {};
    this.req.kauth.options = this.options;
  }

  private async createGrant(accessToken: Token, refreshToken?: Token | null): Promise<Grant | undefined> {
    return (
      this.keycloak.grantManager.createGrant({
        // access_token is actually a string even though keycloak-connect
        // thinks it is a Token
        // @ts-ignore
        access_token: accessToken.token,
        // refresh_token is actually a string even though keycloak-connect
        // thinks it is a Token
        ...(this.options.ensureFreshness && refreshToken ? { refresh_token: refreshToken.token } : {}),
        // refresh_token is actually a number even though keycloak-connect
        // thinks it is a string
        ...(accessToken.content?.exp ? { expires_in: accessToken.content.exp } : {}),
        ...(accessToken.content?.typ ? { token_type: accessToken.content.typ } : {}),
      }) || undefined
    );
  }

  private async validateGrant(grant: Grant): Promise<Grant | undefined> {
    // @ts-ignore isGrantRefreshable is private
    if (this.options.ensureFreshness && this.keycloak.grantManager.isGrantRefreshable(grant)) {
      await this.keycloak.grantManager.ensureFreshness(grant);
    }
    return await this.keycloak.grantManager.validateGrant(grant);
  }

  private serializeScope(scope?: string | string[]) {
    return ['openid', ...(Array.isArray(scope) ? scope : (scope || 'profile').split(' '))].join(' ');
  }
}

export interface TokenResponseData {
  'not-before-policy'?: number;
  access_token?: string;
  expires_in?: number;
  id_token?: string;
  refresh_expires_in?: number;
  refresh_token?: string;
  scope?: string;
  session_state?: string;
  token_type?: string;
}

export interface LogoutResult {
  redirect?: string;
}
