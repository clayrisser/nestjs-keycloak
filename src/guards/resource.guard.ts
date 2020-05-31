import KeycloakConnect, { Keycloak } from 'keycloak-connect';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger
} from '@nestjs/common';
import { KEYCLOAK_INSTANCE } from '../constants';
import { KeycloakedRequest } from '../types';

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
    const resource = this.reflector.get<string>('resource', context.getClass());
    const scopes = this.reflector.get<string[]>('scopes', context.getHandler());
    if (!resource) return true;
    this.logger.verbose(
      `Protecting resource '${resource}' with scopes: [ ${scopes} ]`
    );
    if (!scopes) return true;
    const permissions = scopes.map((scope) => `${resource}:${scope}`);
    const req: KeycloakedRequest<Request> = context.switchToHttp().getRequest();
    const res: Response = context.switchToHttp().getResponse();
    const user = req.user?.preferred_username;
    const enforcerFn = createEnforcerContext(req, res);
    const isAllowed = await enforcerFn(this.keycloak, permissions);
    if (!isAllowed) {
      this.logger.verbose(`Resource '${resource}' denied to '${user}'.`);
      throw new ForbiddenException();
    }
    this.logger.verbose(`Resource '${resource}' granted to '${user}'.`);
    return true;
  }
}

function createEnforcerContext(req: any, res: any) {
  return (keycloak: Keycloak, permissions: string[]) => {
    return new Promise<boolean>((resolve) =>
      keycloak.enforcer(permissions)(req, res, (_next: any) => {
        if (req.resourceDenied) {
          resolve(false);
        } else {
          resolve(true);
        }
      })
    );
  };
}
