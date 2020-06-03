import { Injectable, Inject, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { KEYCLOAK_CONNECT_OPTIONS } from './constants';
import { KeycloakedRequest, KeycloakConnectOptions } from './types';
import authenticate, { LoginArgs, Auth } from './authenticate';

@Injectable({ scope: Scope.REQUEST })
export class KeycloakService {
  constructor(
    @Inject(KEYCLOAK_CONNECT_OPTIONS) private options: KeycloakConnectOptions,
    @Inject(REQUEST) private req: KeycloakedRequest<Request>
  ) {}

  async authenticate(loginArgs: LoginArgs): Promise<Auth> {
    return authenticate(this.req, this.options, loginArgs);
  }
}
