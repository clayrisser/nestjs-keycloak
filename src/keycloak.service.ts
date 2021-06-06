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

  async init() {
    await this._ensureTokens();
    await this._ensureGrant();
    await this._ensureUserInfo();
  }

  async isAuthorizedByRole(roles: string[]) {
    await this._ensureTokens();
    for (const role of roles) {
      if (await this.hasRole(role)) return true;
    }
    return false;
  }

  async isAuthenticated(): Promise<boolean> {
    await this._ensureTokens();
    return !!this._accessToken && !this._accessToken?.isExpired();
  }

  async hasRole(role: string): Promise<boolean> {
    await this._ensureTokens();
    return this.isAuthenticated() && !!this._accessToken?.hasRole(role);
  }

  async getAccessToken(): Promise<Token | null> {
    const { clientId } = this.options;
    const accessToken = this.bearerToken?.token || this.req.session?.token;
    let token: Token | null =
      (this.req.kauth?.grant?.access_token as Token) || null;
    if (!token && accessToken) token = new Token(accessToken, clientId);
    if (!token || token.isExpired()) {
      const refreshToken = this.refreshToken?.token;
      if (refreshToken) {
        try {
          const tokens = await this._grantTokens({ refreshToken });
          if (this.req.session) {
            if (tokens.refreshToken) {
              this.req.session.refreshToken = tokens.refreshToken.token;
            }
            if (tokens.accessToken) {
              this.req.session.token = tokens.accessToken.token;
            }
          }
          if (tokens.accessToken) {
            token = tokens.accessToken;
          }
        } catch (err) {
          if (err.statusCode && err.statusCode < 500) {
            const message = err.message || err.payload?.message;
            this.logger.error(
              `${err.statusCode}:`,
              ...[message ? [message] : []],
              ...[err.payload ? [JSON.stringify(err.payload)] : []]
            );
            return null;
          }
          throw err;
        }
      }
    }
    return token;
  }

  async authenticate(
    options: GrantTokensOptions
  ): Promise<RefreshTokenGrant | null> {
    const tokens = await this._grantTokens(options);
    if (this.req.session) {
      if (tokens.refreshToken) {
        this.req.session.refreshToken = tokens.refreshToken.token;
      }
      if (tokens.accessToken) {
        this.req.session.token = tokens.accessToken.token;
      }
    }
    if (tokens.accessToken) this._accessToken = tokens.accessToken;
    await this.init();
    return tokens;
  }

  async logout() {
    this._accessToken = null;
    delete this.req.kauth;
    if (!this.req.session) return;
    delete this.req.session.refreshToken;
    delete this.req.session.token;
    delete this.req.session.userInfo;
    await new Promise<void>((resolve, reject) => {
      if (!this.req.session?.destroy) return resolve();
      this.req.session?.destroy((err: Error) => {
        if (err) return reject(err);
        return resolve();
      });
    });
  }

  get bearerToken(): Token | null {
    const { clientId } = this.options;
    const { authorization } = this.req.headers;
    if (typeof authorization === 'undefined') return null;
    if (authorization?.indexOf(' ') <= -1) {
      return new Token(authorization, clientId);
    }
    const auth = authorization?.split(' ');
    if (auth && auth[0] && auth[0].toLowerCase() === 'bearer') {
      return new Token(auth[1], clientId);
    }
    return null;
  }

  get refreshToken(): Token | null {
    const { clientId } = this.options;
    return this.req.session?.refreshToken
      ? new Token(this.req.session?.refreshToken, clientId)
      : null;
  }

  get userInfo(): UserInfo | null {
    return this.req.kauth?.userInfo || null;
  }

  get grant(): Grant | null {
    return this.req.kauth?.grant || null;
  }

  private async _grantTokens({
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
      data = qs.stringify({
        ...(clientSecret ? { client_secret: clientSecret } : {}),
        client_id: clientId,
        grant_type: 'password',
        password,
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

  private logger = console;

  private _accessToken: Token | null = null;

  private async _getUserInfo(): Promise<UserInfo> {
    if (this.req.session.userInfo) return this.req.session.userInfo;
    this._ensureTokens();
    const userinfo =
      this._accessToken &&
      (await this.keycloak.grantManager.userInfo<
        Token | string,
        {
          email_verified: boolean;
          preferred_username: string;
          sub: string;
          [key: string]: any;
        }
      >(this._accessToken));
    const userInfo = {
      ...{
        emailVerified: userinfo?.email_verified,
        preferredUsername: userinfo?.preferred_username
      },
      ...userinfo
    } as UserInfo;
    delete userInfo?.email_verified;
    delete userInfo?.preferred_username;
    return userInfo;
  }

  private async _ensureTokens() {
    if (!this._accessToken) await this._setTokens();
  }

  private async _setTokens() {
    const accessToken = await this.getAccessToken();
    if (accessToken) this._accessToken = accessToken;
  }

  private async _ensureGrant() {
    if (!this.req.kauth?.grant) await this._setGrant();
  }

  private async _setGrant() {
    this._ensureTokens();
    if (!this.req.kauth) this.req.kauth = {};
    if (!this._accessToken) return;
    const grant = await this.keycloak.grantManager.createGrant({
      // access_token is actually a string but due to a bug in keycloak-connect
      // we pretend it is a Token
      access_token: this._accessToken?.token as unknown as Token
    });
    if (grant) this.req.kauth.grant = grant;
  }

  private async _ensureUserInfo() {
    if (!this.req.kauth?.userInfo) await this._setUserInfo();
  }

  private async _setUserInfo() {
    const userInfo = await this._getUserInfo();
    if (!this.req.kauth) this.req.kauth = {};
    if (userInfo) {
      this.req.kauth.userInfo = userInfo;
      if (this.req.session) this.req.session.userInfo = userInfo;
    }
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
