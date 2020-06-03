import qs from 'qs';
import { AxiosInstance } from 'axios';
import { Request } from 'express';
import { KeycloakedRequest, KeycloakConnectOptions } from './types';

export default async function authenticate(
  req: KeycloakedRequest<Request>,
  options: KeycloakConnectOptions,
  api: AxiosInstance,
  { password, refreshToken, scope, username }: LoginArgs
): Promise<Auth> {
  if (Array.isArray(scope)) scope = scope.join(' ');
  if (!scope?.length) scope = 'openid profile';
  try {
    let data: string;
    if (refreshToken?.length) {
      data = qs.stringify({
        client_id: options.clientId,
        client_secret: options.secret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      });
    } else {
      data = qs.stringify({
        client_id: options.clientId,
        client_secret: options.secret,
        grant_type: 'password',
        password,
        scope,
        username
      });
    }
    const res = await api.post<LoginResponseData>(
      `/realms/${options.realm}/protocol/openid-connect/token`,
      data,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    if (req.session) {
      if (res.data.access_token?.length) {
        req.session.token = res.data.access_token;
      }
      if (res.data.refresh_token?.length) {
        req.session.refreshToken = res.data.refresh_token;
      }
    }
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

export interface LoginArgs {
  username?: string;
  password?: string;
  scope?: string | string[];
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
