import { AxiosStatic, AxiosInstance } from 'axios';
import { Injectable, Inject, Scope } from '@nestjs/common';
import { Keycloak } from 'keycloak-connect';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import authenticate, { LoginArgs, Auth } from './authenticate';
import { AXIOS } from './providers/axios.provider';
import { KEYCLOAK_CONNECT_OPTIONS, KEYCLOAK_INSTANCE } from './constants';
import { KeycloakedRequest, KeycloakConnectOptions } from './types';

@Injectable({ scope: Scope.REQUEST })
export class KeycloakService {
  api: AxiosInstance;

  constructor(
    @Inject(KEYCLOAK_INSTANCE) private readonly keycloak: Keycloak,
    @Inject(KEYCLOAK_CONNECT_OPTIONS)
    private readonly options: KeycloakConnectOptions,
    @Inject(REQUEST) private readonly req: KeycloakedRequest<Request>,
    @Inject(AXIOS) axios: AxiosStatic
  ) {
    this.api = axios.create({
      baseURL: options.authServerUrl,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async authenticate(loginArgs: LoginArgs): Promise<Auth> {
    return authenticate(this.req, this.options, this.api, loginArgs);
  }
}
