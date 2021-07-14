/**
 * File: /src/guards/resource.guard.ts
 * Project: whisker-keycloak
 * File Created: 14-07-2021 11:39:50
 * Author: Clay Risser <email@clayrisser.com>
 * -----
 * Last Modified: 14-07-2021 11:45:59
 * Modified By: Clay Risser <email@clayrisser.com>
 * -----
 * Silicon Hills LLC (c) Copyright 2021
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
