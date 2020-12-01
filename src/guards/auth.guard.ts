import { Grant, Keycloak, Token } from 'keycloak-connect';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import {
  CanActivate,
  ExecutionContext,
  HttpService,
  Inject,
  Injectable,
  Logger
} from '@nestjs/common';
import authenticate from '../authenticate';
import { KEYCLOAK_INSTANCE, KEYCLOAK_OPTIONS } from '../constants';
import { KeycloakOptions, KeycloakedRequest, UserInfo } from '../types';
import { getReq, extractJwt } from '../utils';

@Injectable()
export class AuthGuard implements CanActivate {
  logger = new Logger(AuthGuard.name);

  constructor(
    @Inject(KEYCLOAK_INSTANCE)
    private readonly keycloak: Keycloak,
    @Inject(KEYCLOAK_OPTIONS) private options: KeycloakOptions,
    private readonly reflector: Reflector,
    private httpService: HttpService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = getReq(context);
    const handlerIsPublic = !!this.reflector.get<string>(
      'public',
      context.getHandler()
    );
    const classIsPublic = !!this.reflector.get<string>(
      'public',
      context.getClass()
    );
    const isPublic = handlerIsPublic || classIsPublic;
    if (isPublic) return true;
    const handlerRoles = this.reflector.get<(string | string[])[]>(
      'roles',
      context.getHandler()
    );
    const classRoles = this.reflector.get<(string | string[])[]>(
      'roles',
      context.getHandler()
    );
    const roles = [...new Set([...handlerRoles.flat(), ...classRoles.flat()])];
    const accessToken = extractJwt(req.headers) || req.session?.token;
    let grant: Grant | null = null;
    if (accessToken?.length) {
      grant = await this.getGrant(req, accessToken);
    } else if (req.session?.refreshToken) {
      grant = await this.getGrant(req);
    } else if (isPublic === false) return false;
    if (grant) {
      if (grant.isExpired()) return false;
      req.grant = grant;
      if (req.session?.userInfo) {
        req.userInfo = req.session.userInfo;
      } else {
        req.userInfo = await this.getUserInfo(req.grant);
        if (req.session) req.session.userInfo = req.userInfo;
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

  async getUserInfo(grant: Grant): Promise<UserInfo> {
    const userinfo =
      grant.access_token &&
      (await this.keycloak.grantManager.userInfo<
        Token | string,
        {
          email_verified: boolean;
          preferred_username: string;
          sub: string;
          [key: string]: any;
        }
      >(grant.access_token));
    const userInfo = {
      ...{
        emailVerified: userinfo?.email_verified,
        preferredUsername: userinfo?.preferred_username
      },
      ...userinfo
    } as UserInfo;
    delete userInfo?.email_verified;
    delete userInfo?.preferred_username;
    return userInfo;
  }

  async getGrant(
    req: KeycloakedRequest<Request>,
    accessToken?: string
  ): Promise<Grant | null> {
    const accessGrant = !!accessToken?.length;
    if (!accessToken && req.session?.refreshToken?.length) {
      try {
        const result = await authenticate(req, this.options, this.httpService, {
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
}
