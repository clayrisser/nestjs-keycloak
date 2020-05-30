import * as KeycloakConnect from 'keycloak-connect';
import { Reflector } from '@nestjs/core';
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException
} from '@nestjs/common';
import { KEYCLOAK_INSTANCE } from '../constants';
import { KeycloakedRequest } from '../keycloaked-request';

declare module 'keycloak-connect' {
  interface GrantType {
    access_token?: KeycloakConnect.Token;
    expires_in?: string;
    id_token?: string;
    refresh_token?: string;
    token_type?: string;
  }
}

/**
 * An authentication guard. Will return a 401 unauthorized when it is unable to
 * verify the JWT token or Bearer header is missing.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  logger = new Logger(AuthGuard.name);

  constructor(
    @Inject(KEYCLOAK_INSTANCE)
    private keycloak: KeycloakConnect.Keycloak,
    private reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: KeycloakedRequest<Request> = context
      .switchToHttp()
      .getRequest();
    const isPublic = !!this.reflector.get<string>(
      'public-path',
      context.getHandler()
    );
    const roles = this.reflector.get<(string | string[])[]>(
      'roles',
      context.getHandler()
    );
    const jwt = this.extractJwt(request.headers);
    let grant: KeycloakConnect.Grant | undefined;
    if (jwt) {
      grant = await this.keycloak.grantManager.createGrant({
        access_token: jwt
      });
    } else if (request.session?.token) {
      grant = await this.keycloak.grantManager.createGrant({
        access_token:
          request.session.accessToken ||
          request.session.access_token ||
          request.session.token
      });
    } else if (isPublic === false) throw new UnauthorizedException();
    if (grant) {
      request.grant = (grant as any) as KeycloakConnect.GrantType;
      if (!grant.isExpired() && !request.session.authUser) {
        // Attach user info to the session
        const user =
          grant.access_token &&
          (await this.keycloak.grantManager.userInfo(grant.access_token));
        request.session.authUser = user;
      }
      request.user = request.session.authUser;
      if (roles && request.grant) {
        return roles.some((role) =>
          Array.isArray(role)
            ? role.every((innerRole) =>
                request.grant?.access_token?.hasRole(innerRole)
              )
            : request.grant?.access_token?.hasRole(role)
        );
      }
      return true;
    }
    if (isPublic) return true;
    return false;
  }

  extractJwt(headers: Headers) {
    const auth = headers['authorization']?.split(' ');
    if (auth && auth[0] && auth[0].toLowerCase() === 'bearer') return auth[1];
    return null;
  }
}
