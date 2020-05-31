import axios from 'axios';
import qs from 'qs';
import { Injectable, Inject, Scope } from '@nestjs/common';
import { Keycloak } from 'keycloak-connect';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { KEYCLOAK_CONNECT_OPTIONS, KEYCLOAK_INSTANCE } from './constants';
import { KeycloakConnectOptions } from './interface/keycloak-connect-options.interface';
import { KeycloakedRequest } from './types';

@Injectable({ scope: Scope.REQUEST })
export class KeycloakService {
  constructor(
    @Inject(KEYCLOAK_INSTANCE) private keycloak: Keycloak,
    @Inject(KEYCLOAK_CONNECT_OPTIONS) private options: KeycloakConnectOptions,
    @Inject(REQUEST) private req: KeycloakedRequest<Request>
  ) {}

  async authenticate({
    password,
    refreshToken,
    scope,
    username
  }: LoginArgs): Promise<Auth> {
    if (!scope) scope = 'openid profile ';
    try {
      let data: string;
      if (refreshToken?.length) {
        data = qs.stringify({
          client_id: this.options.clientId,
          client_secret: this.options.secret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        });
      } else {
        data = qs.stringify({
          client_id: this.options.clientId,
          client_secret: this.options.secret,
          grant_type: 'password',
          password,
          scope,
          username
        });
      }
      const res = await axios.post<LoginResponseData>(
        `${this.options.authServerUrl}/realms/${this.options.realm}/protocol/openid-connect/token`,
        data
      );
      this.req.grant = (await this.keycloak.grantManager.createGrant({
        access_token: res.data.access_token as any
      })) as any;
      return {
        accessToken: res.data.access_token,
        expiresIn: res.data.expires_in,
        message: 'authentication successful',
        refreshExpiresIn: res.data.refresh_expires_in,
        refreshToken: res.data.refresh_token,
        scope: res.data.scope,
        tokenType: res.data.token_type
      };
    } catch (err) {
      if (err.response?.data && err.response?.status) {
        const { data } = err.response;
        err.statusCode = err.response.status;
        err.payload = {
          error: data.error,
          message: data.error_description,
          statusCode: err.statusCode
        };
      }
      throw err;
    }
  }
}

export interface LoginArgs {
  username?: string;
  password?: string;
  scope?: string;
  refreshToken?: string;
}

export interface LoginResponseData {
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

export interface LoginErrorData {
  error?: string;
  error_description?: string;
}

export interface Auth {
  accessToken?: string;
  expiresIn?: number;
  message: string;
  refreshExpiresIn?: number;
  refreshToken?: string;
  scope?: string;
  tokenType?: string;
}
