import { Injectable, Scope } from '@nestjs/common';
import { KeycloakService, LoginArgs } from 'nestjs-keycloak';
import { Auth } from './auth.model';

@Injectable({ scope: Scope.REQUEST })
export class AuthService {
  constructor(private readonly keycloakService: KeycloakService) {}

  async authenticate({
    password,
    refreshToken,
    scope,
    username
  }: LoginArgs): Promise<Auth> {
    return this.keycloakService.authenticate({
      password,
      refreshToken,
      scope,
      username
    });
  }
}
