import { Grant, Keycloak, Token } from 'keycloak-connect';
import { IncomingHttpHeaders } from 'http';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger
} from '@nestjs/common';
import authenticate from '../authenticate';
import getReq from '../getReq';
import { KEYCLOAK_INSTANCE, KEYCLOAK_CONNECT_OPTIONS } from '../constants';
import { KeycloakConnectOptions, KeycloakedRequest, UserInfo } from '../types';

@Injectable()
export class AuthGuard implements CanActivate {
  logger = new Logger(AuthGuard.name);

  constructor(
    @Inject(KEYCLOAK_INSTANCE)
    private readonly keycloak: Keycloak,
    @Inject(KEYCLOAK_CONNECT_OPTIONS) private options: KeycloakConnectOptions,
    private readonly reflector: Reflector
  ) {}

  async getGrant(
    req: KeycloakedRequest<Request>,
    accessToken?: string
  ): Promise<Grant | null> {
    const accessGrant = !!accessToken?.length;
    if (!accessToken && req.session?.refreshToken?.length) {
      try {
        const result = await authenticate(req, this.options, {
          refreshToken: req.session.refreshToken
        });
        accessToken = result.accessToken;
        req.session.token = result.accessToken;
        req.session.refreshToken = result.refreshToken;
      } catch (err) {
        this.logger.error(err.statusCode, JSON.stringify(err.payload));
        if (err.statusCode < 500) return null;
        if (err.payload && err.statusCode) {
          this.logger.error(err.statusCode, JSON.stringify(err.payload));
        }
        throw err;
      }
    }
    if (!accessToken) return null;
    try {
      const grant = await this.keycloak.grantManager.createGrant({
        access_token: accessToken as any
      });
      if (accessGrant && grant.isExpired()) return this.getGrant(req);
      return grant;
    } catch (err) {
      if (
        err.message !==
        'Grant validation failed. Reason: invalid token (expired)'
      ) {
        throw err;
      }
      return this.getGrant(req);
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = getReq(context);
    const isPublic = !!this.reflector.get<string>(
      'public-path',
      context.getHandler()
    );
    if (isPublic) return true;
    const roles = this.reflector.get<(string | string[])[]>(
      'roles',
      context.getHandler()
    );
    const accessToken = this.extractJwt(req.headers) || req.session?.token;
    let grant: Grant | null = null;
    if (accessToken?.length) {
      grant = await this.getGrant(req, accessToken);
    } else if (req.session?.refreshToken) {
      grant = await this.getGrant(req);
    } else if (isPublic === false) return false;
    if (grant) {
      if (grant.isExpired()) return false;
      req.grant = grant;
      if (req.session?.user) {
        req.user = req.session.user;
      } else {
        req.user =
          grant.access_token &&
          (await this.keycloak.grantManager.userInfo<Token | string, UserInfo>(
            grant.access_token
          ));
        if (req.session) req.session.user = req.user;
      }
      if (roles && req.grant) {
        return roles.some((role) => {
          return Array.isArray(role)
            ? role.every((innerRole) =>
                req.grant?.access_token?.hasRole(innerRole)
              )
            : req.grant?.access_token?.hasRole(role);
        });
      }
      return true;
    }
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
