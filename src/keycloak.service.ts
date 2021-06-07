import Token from 'keycloak-connect/middleware/auth-utils/token';
import qs from 'qs';
import { AxiosResponse } from 'axios';
import { Injectable, Inject, Scope, HttpService } from '@nestjs/common';
import { Grant, Keycloak } from 'keycloak-connect';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { Options, KeycloakRequest, UserInfo } from '~/types';
import { KEYCLOAK, KEYCLOAK_OPTIONS } from '~/index';

@Injectable({ scope: Scope.REQUEST })
export default class KeycloakService {
  constructor(
    @Inject(KEYCLOAK_OPTIONS) public options: Options,
    @Inject(KEYCLOAK) private keycloak: Keycloak,
    @Inject(REQUEST) private readonly req: KeycloakRequest<Request>,
    private readonly httpService: HttpService
  ) {}

  private logger = console;

  private _bearerToken: Token | undefined;

  private _refreshToken: Token | undefined;

  private _accessToken: Token | undefined;

  private _userInfo: UserInfo | undefined;

  private _initialized = false;

  get bearerToken(): Token | undefined {
    if (this._bearerToken) return this._bearerToken;
    const { clientId, strict } = this.options;
    const { authorization } = this.req.headers;
    if (typeof authorization === 'undefined') return;
    if (authorization?.indexOf(' ') <= -1) {
      if (strict) return;
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
    return;
  }

  get refreshToken(): Token | undefined {
    const { clientId } = this.options;
    if (this._refreshToken) return this._refreshToken;
    this._refreshToken = this.req.session?.kauth?.refreshToken
      ? new Token(this.req.session?.kauth.refreshToken, clientId)
      : undefined;
    return this._refreshToken;
  }

  get grant(): Grant | undefined {
    return this.req.kauth?.grant;
  }

  async getAccessToken(): Promise<Token | undefined> {
    if (this._accessToken) return this._accessToken;
    if (this.bearerToken) {
      this._accessToken = this.bearerToken;
      return this._accessToken;
    }
    const { clientId } = this.options;
    let accessToken = this.req.kauth?.grant?.access_token as Token | undefined;
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
          return;
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
    let scopeArr = [
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
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const {
        access_token,
        scope,
        refresh_token,
        expires_in,
        refresh_expires_in,
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

  private async reqSessionSetUserInfo() {
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

  private async reqSetGrant() {
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

  async init() {
    if (this._initialized) return;
    await this.reqSetGrant();
    await this.reqSessionSetUserInfo();
    this._initialized = true;
  }

  async isAuthorizedByRole(roles: string[]) {
    await this.init();
    for (const role of roles) {
      if (await this.hasRole(role)) return true;
    }
    return false;
  }

  async isAuthenticated(): Promise<boolean> {
    await this.init();
    const accessToken = await this.getAccessToken();
    return !!accessToken && !accessToken?.isExpired();
  }

  async hasRole(role: string): Promise<boolean> {
    await this.init();
    const accessToken = await this.getAccessToken();
    return this.isAuthenticated() && !!accessToken?.hasRole(role);
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
    delete this._accessToken;
    delete this._bearerToken;
    delete this._refreshToken;
    delete this._userInfo;
    delete this.req.kauth;
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
