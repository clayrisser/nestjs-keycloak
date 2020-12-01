import KeycloakConnect, { Keycloak } from 'keycloak-connect';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger
} from '@nestjs/common';
import { KEYCLOAK_INSTANCE } from '../constants';
import { RESOURCE } from '../decorators/resource.decorator';
import { SCOPES } from '../decorators/scopes.decorator';
import { getReq } from '../utils';

declare module 'keycloak-connect' {
  interface Keycloak {
    enforcer(
      expectedPermissions: string | string[]
    ): (req: any, res: any, next: any) => any;
  }
}

@Injectable()
export class ResourceGuard implements CanActivate {
  logger = new Logger(ResourceGuard.name);

  constructor(
    @Inject(KEYCLOAK_INSTANCE)
    private keycloak: KeycloakConnect.Keycloak,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const resource = this.reflector.get<string>(RESOURCE, context.getClass());
    const handlerScopes =
      this.reflector.get<string[]>(SCOPES, context.getHandler()) || [];
    const classScopes =
      this.reflector.get<string[]>(SCOPES, context.getClass()) || [];
    const scopes = [...new Set([...handlerScopes, ...classScopes])];
    if (!resource || !scopes.length) return true;
    this.logger.verbose(
      `Protecting resource '${resource}' with scopes: [ ${scopes} ]`
    );
    if (!scopes.length) return true;
    const req = getReq(context);
    if (!req.userInfo) return false;
    const permissions = scopes.map((scope) => `${resource}:${scope}`);
    const res: Response = context.switchToHttp().getResponse();
    const username = req.userInfo?.preferred_username;
    const enforcerFn = createEnforcerContext(req, res);
    const isAllowed = await enforcerFn(this.keycloak, permissions);
    if (!isAllowed) {
      this.logger.verbose(`Resource '${resource}' denied to '${username}'.`);
      return false;
    }
    this.logger.verbose(`Resource '${resource}' granted to '${username}'.`);
    return true;
  }
}

function createEnforcerContext(req: any, res: any) {
  req.kauth = { grant: req.grant };
  return (keycloak: Keycloak, permissions: string[]) => {
    return new Promise<boolean>((resolve) => {
      return keycloak.enforcer(permissions)(req, res, (_next: any) => {
        if (req.resourceDenied) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  };
}
