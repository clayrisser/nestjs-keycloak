import { Grant, Keycloak } from 'keycloak-connect';
import { Injectable, Inject, Scope, HttpService } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import authenticate, { LoginArgs, Auth } from './authenticate';
import { KEYCLOAK_OPTIONS, KEYCLOAK_INSTANCE } from './constants';
import { KeycloakedRequest, KeycloakOptions, UserInfo } from './types';

@Injectable({ scope: Scope.REQUEST })
export class KeycloakService {
  constructor(
    @Inject(KEYCLOAK_INSTANCE) _keycloak: Keycloak,
    @Inject(KEYCLOAK_OPTIONS)
    private readonly options: KeycloakOptions,
    @Inject(REQUEST) private readonly req: KeycloakedRequest<Request>,
    private readonly httpService: HttpService
  ) {}

  async authenticate(loginArgs: LoginArgs): Promise<Auth> {
    return authenticate(this.req, this.options, this.httpService, loginArgs);
  }

  async logout(): Promise<null> {
    if (!this.req.session) return null;
    await new Promise<void>((resolve, reject) => {
      if (!this.req.session?.destroy) return resolve();
      this.req.session?.destroy((err: Error) => {
        if (err) return reject(err);
        return resolve();
      });
    });
    return null;
  }

  get userInfo(): UserInfo | undefined {
    return this.req.userInfo;
  }

  get grant(): Grant | undefined {
    return this.req.grant;
  }
}

export interface UserinfoResponseData {}
