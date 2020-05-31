import KeycloakConnect from 'keycloak-connect';
import { IncomingHttpHeaders } from 'http';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException
} from '@nestjs/common';
import { KEYCLOAK_INSTANCE } from '../constants';
import { KeycloakedRequest } from '../types';

@Injectable()
export class AuthGuard implements CanActivate {
  logger = new Logger(AuthGuard.name);

  constructor(
    @Inject(KEYCLOAK_INSTANCE)
    private keycloak: KeycloakConnect.Keycloak,
    private reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req: KeycloakedRequest<Request> = context.switchToHttp().getRequest();
    const isPublic = !!this.reflector.get<string>(
      'public-path',
      context.getHandler()
    );
    const roles = this.reflector.get<(string | string[])[]>(
      'roles',
      context.getHandler()
    );
    const jwt = this.extractJwt(req.headers);
    let grant: KeycloakConnect.Grant | undefined;
    if (jwt) {
      grant = await this.keycloak.grantManager.createGrant(
        JSON.stringify({
          access_token: jwt
        })
      );
    } else if (req.session?.token) {
      grant = await this.keycloak.grantManager.createGrant(
        JSON.stringify({
          access_token: req.session.token
        })
      );
    } else if (isPublic === false) throw new UnauthorizedException();
    if (grant) {
      req.grant = grant;
      if (!grant.isExpired() && !req.session.authUser) {
        const user =
          grant.access_token &&
          (await this.keycloak.grantManager.userInfo(grant.access_token));
        req.session.user = user;
      }
      req.user = req.session.user;
      if (roles && req.grant) {
        return roles.some((role) =>
          Array.isArray(role)
            ? role.every((innerRole) =>
                req.grant?.access_token?.hasRole(innerRole)
              )
            : req.grant?.access_token?.hasRole(role)
        );
      }
      return true;
    }
    if (isPublic) return true;
    return false;
  }

  extractJwt(headers: IncomingHttpHeaders) {
    const { authorization } = headers;
    if (typeof authorization === 'undefined') return null;
    if (authorization?.indexOf(' ') <= -1) return authorization;
    const auth = authorization?.split(' ');
    if (auth && auth[0] && auth[0].toLowerCase() === 'bearer') return auth[1];
    return null;
  }
}
