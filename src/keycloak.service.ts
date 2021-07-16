/**
 * File: /src/keycloak.service.ts
 * Project: nestjs-keycloak
 * File Created: 14-07-2021 11:43:59
 * Author: Clay Risser <email@clayrisser.com>
 * -----
 * Last Modified: 15-07-2021 21:54:13
 * Modified By: Clay Risser <email@clayrisser.com>
 * -----
 * Silicon Hills LLC (c) Copyright 2021
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
import { AxiosResponse } from 'axios';
import { Grant, Keycloak } from 'keycloak-connect';
import { HttpService } from '@nestjs/axios';
import { Injectable, Inject, Scope, ExecutionContext } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request, NextFunction } from 'express';
import {
  KeycloakOptions,
  KeycloakRequest,
  UserInfo,
  KEYCLOAK_OPTIONS
} from './types';
import { KEYCLOAK } from './keycloak.provider';
import { getReq, GraphqlContext } from './util';

@Injectable({ scope: Scope.REQUEST })
export default class KeycloakService {
  constructor(
    @Inject(KEYCLOAK_OPTIONS) private readonly options: KeycloakOptions,
    @Inject(KEYCLOAK) private readonly keycloak: Keycloak,
    private readonly httpService: HttpService,
    @Inject(REQUEST)
    reqOrExecutionContext:
      | KeycloakRequest<Request>
      | ExecutionContext
      | GraphqlContext
  ) {
    this.req = getReq(reqOrExecutionContext);
  }

  req: KeycloakRequest<Request>;

  private logger = console;

  private _bearerToken: Token | null = null;

  private _refreshToken: Token | null = null;

  private _accessToken: Token | null = null;

  private _userInfo: UserInfo | null = null;

  private _initialized = false;

  get bearerToken(): Token | null {
    if (this._bearerToken) return this._bearerToken;
    const { clientId, strict } = this.options;
    const { authorization } = this.req.headers;
    if (typeof authorization === 'undefined') return null;
    if (authorization?.indexOf(' ') <= -1) {
      if (strict) return null;
      this._bearerToken = new Token(authorization, clientId);
      return this._bearerToken;
    }
    const authorizationArr = authorization?.split(' ');
    if (
      authorizationArr &&
      authorizationArr[0] &&
      authorizationArr[0].toLowerCase() === 'bearer'
    ) {
      this._bearerToken = new Token(authorizationArr[1], clientId);
      return this._bearerToken;
    }
    return null;
  }

  get refreshToken(): Token | null {
    const { clientId } = this.options;
    if (this._refreshToken) return this._refreshToken;
    this._refreshToken = this.req.session?.kauth?.refreshToken
      ? new Token(this.req.session?.kauth.refreshToken, clientId)
      : null;
    return this._refreshToken;
  }

  get grant(): Grant | null {
    return this.req.kauth?.grant || null;
  }

  async getAccessToken(): Promise<Token | null> {
    if (this._accessToken) return this._accessToken;
    if (this.bearerToken) {
      this._accessToken = this.bearerToken;
      return this._accessToken;
    }
    const { clientId } = this.options;
    let accessToken = (this.req.kauth?.grant?.access_token as Token) || null;
    if (!accessToken && this.req.session?.kauth?.accessToken) {
      accessToken = new Token(this.req.session?.kauth?.accessToken, clientId);
    }
    if ((!accessToken || accessToken.isExpired()) && this.refreshToken) {
      try {
        const tokens = await this.grantTokens({
          refreshToken: this.refreshToken.token
        });
        this.sessionSetTokens(tokens.accessToken, tokens.refreshToken);
        if (tokens.accessToken) accessToken = tokens.accessToken;
      } catch (err) {
        if (err.statusCode && err.statusCode < 500) {
          this.logger.error(
            `${err.statusCode}:`,
            ...[err.message ? [err.message] : []],
            ...[err.payload ? [JSON.stringify(err.payload)] : []]
          );
          return null;
        }
        throw err;
      }
    }
    this._accessToken = accessToken;
    return this._accessToken;
  }

  async getUserInfo(): Promise<UserInfo> {
    if (this._userInfo) return this._userInfo;
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
      (await this.keycloak.grantManager.userInfo<
        Token | string,
        {
          email_verified: boolean;
          preferred_username: string;
          sub: string;
          [key: string]: any;
        }
      >(accessToken));
    const result = {
      ...{
        emailVerified: userInfo?.email_verified,
        preferredUsername: userInfo?.preferred_username
      },
      ...userInfo
    } as UserInfo;
    delete result?.email_verified;
    delete result?.preferred_username;
    this._userInfo = result;
    return this._userInfo;
  }

  async grantTokens({
    password,
    refreshToken,
    scope,
    username
  }: GrantTokensOptions): Promise<RefreshTokenGrant> {
    const { clientId, clientSecret } = this.options;
    const scopeArr = [
      'openid',
      ...(Array.isArray(scope) ? scope : (scope || 'profile').split(' '))
    ];
    let data: string;
    if (refreshToken?.length) {
      data = qs.stringify({
        ...(clientSecret ? { client_secret: clientSecret } : {}),
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      });
    } else {
      if (!username) throw new Error('missing username or refreshToken');
      data = qs.stringify({
        ...(clientSecret ? { client_secret: clientSecret } : {}),
        client_id: clientId,
        grant_type: 'password',
        password: password || '',
        scope: scopeArr.join(' '),
        username
      });
    }
    try {
      const res = (await this.httpService
        .post(
          `/auth/realms/${this.options.realm}/protocol/openid-connect/token`,
          data,
          {
            baseURL: this.options.baseUrl,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
          }
        )
        .toPromise()) as AxiosResponse<TokenResponseData>;
      const {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        access_token,
        scope,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        refresh_token,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        expires_in,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        refresh_expires_in,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        token_type
      } = res.data;
      return {
        ...(access_token
          ? { accessToken: new Token(access_token, clientId) }
          : {}),
        ...(expires_in ? { expiresIn: expires_in } : {}),
        ...(refresh_expires_in ? { refreshExpiresIn: refresh_expires_in } : {}),
        ...(refresh_token
          ? { refreshToken: new Token(refresh_token, clientId) }
          : {}),
        ...(token_type ? { tokenType: token_type } : {}),
        message: 'authentication successful',
        scope
      };
    } catch (err) {
      if (err.response?.data && err.response?.status) {
        const { data } = err.response;
        err.statusCode = err.response.status;
        err.payload = {
          error: data.error,
          message: data.error_description || '',
          statusCode: err.statusCode
        };
      }
      throw err;
    }
  }

  private sessionSetTokens(accessToken?: Token, refreshToken?: Token) {
    if (this.req.session) {
      if (!this.req.session.kauth) this.req.session.kauth = {};
      if (refreshToken) {
        this.req.session.kauth.refreshToken = refreshToken.token;
      }
      if (accessToken) {
        this.req.session.kauth.accessToken = accessToken.token;
        this.req.session.token = accessToken.token;
      }
    }
  }

  async init() {
    if (this._initialized) return;
    await this.setGrant();
    await this.setUserInfo();
    this._initialized = true;
  }

  async isAuthorizedByRoles(roles: (string | string[])[]): Promise<boolean> {
    await this.init();
    const accessToken = await this.getAccessToken();
    if (!(await this.isAuthenticated())) return false;
    const rolesArr = Array.isArray(roles) ? roles : [roles];
    if (!rolesArr.length) return true;
    return rolesArr.some((role: string | string[]) =>
      Array.isArray(role)
        ? role.every((innerRole: string) => accessToken?.hasRole(innerRole))
        : accessToken?.hasRole(role)
    );
  }

  async isAuthenticated(): Promise<boolean> {
    await this.init();
    const accessToken = await this.getAccessToken();
    return !this.grant?.isExpired() && !accessToken?.isExpired();
  }

  async authenticate(
    options: GrantTokensOptions
  ): Promise<RefreshTokenGrant | null> {
    const tokens = await this.grantTokens(options);
    this.sessionSetTokens(tokens.accessToken, tokens.refreshToken);
    if (tokens.accessToken) this._accessToken = tokens.accessToken;
    await this.init();
    return tokens;
  }

  async logout() {
    this._accessToken = null;
    this._bearerToken = null;
    this._refreshToken = null;
    this._userInfo = null;
    delete this.req.kauth;
    this._initialized = false;
    if (!this.req.session) return;
    delete this.req.session.kauth;
    delete this.req.session.token;
    await new Promise<void>((resolve, reject) => {
      if (!this.req.session?.destroy) return resolve();
      this.req.session?.destroy((err: Error) => {
        if (err) return reject(err);
        return resolve();
      });
      return null;
    });
  }

  private async setUserInfo() {
    const userInfo = await this.getUserInfo();
    if (!this.req.kauth) this.req.kauth = {};
    if (userInfo) {
      this.req.kauth.userInfo = userInfo;
      if (this.req.session) {
        if (!this.req.session?.kauth) this.req.session.kauth = {};
        this.req.session.kauth.userInfo = userInfo;
      }
    }
  }

  private async setGrant() {
    const accessToken = await this.getAccessToken();
    if (!this.req.kauth) this.req.kauth = {};
    if (!accessToken) return;
    const grant = await this.keycloak.grantManager.createGrant({
      // access_token is actually a string but due to a bug in keycloak-connect
      // we pretend it is a Token
      access_token: accessToken
    });
    if (grant) this.req.kauth.grant = grant;
  }

  async enforce(permissions: string[]) {
    await this.init();
    return new Promise<boolean>((resolve) => {
      return this.keycloak.enforcer(permissions)(
        this.req,
        {},
        (req: KeycloakRequest<Request>, _res: {}, _next: NextFunction) => {
          if (req.resourceDenied) return resolve(false);
          return resolve(true);
        }
      );
    });
  }
}

export interface GrantTokensOptions {
  password?: string;
  refreshToken?: string;
  scope?: string | string[];
  username?: string;
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

export interface RefreshTokenGrant {
  accessToken?: Token;
  expiresIn?: number;
  message: string;
  refreshExpiresIn?: number;
  refreshToken?: Token;
  scope?: string;
  tokenType?: string;
}
