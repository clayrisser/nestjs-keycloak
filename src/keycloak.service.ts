import * as requestPromise from 'request-promise';
import { Injectable, Inject, Scope } from '@nestjs/common';
import { Keycloak } from 'keycloak-connect';
import { REQUEST } from '@nestjs/core';
import { KEYCLOAK_CONNECT_OPTIONS, KEYCLOAK_INSTANCE } from './constants';
import { KeycloakConnectOptions } from './interface/keycloak-connect-options.interface';
import { KeycloakedRequest } from './keycloaked-request';

@Injectable({ scope: Scope.REQUEST })
export class KeycloakService {
  constructor(
    @Inject(KEYCLOAK_INSTANCE) private keycloak: Keycloak,
    @Inject(KEYCLOAK_CONNECT_OPTIONS) private options: KeycloakConnectOptions,
    @Inject(REQUEST) private request: KeycloakedRequest<Request>
  ) {}

  async login(
    username: string,
    password: string,
    scope = 'openid profile '
  ): Promise<unknown> {
    const res = await requestPromise.post(
      `${this.options.authServerUrl}/realms/${this.options.realm}/protocol/openid-connect/token`,
      {
        form: {
          grant_type: 'password',
          client_id: this.options.clientId,
          client_secret: this.options.secret,
          scope: scope,
          username: username,
          password: password
        },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );
    if (typeof res === 'string' && res.indexOf('access_token') !== -1) {
      this.request.session.token = res;
      this.request.grant = (await this.keycloak.grantManager.createGrant({
        access_token: JSON.parse(res).access_token
      })) as any;
      return true;
    }
    return false;
  }
}
