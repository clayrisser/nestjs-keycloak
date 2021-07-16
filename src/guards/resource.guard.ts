/**
 * File: /src/guards/resource.guard.ts
 * Project: nestjs-keycloak
 * File Created: 14-07-2021 11:39:50
 * Author: Clay Risser <email@clayrisser.com>
 * -----
 * Last Modified: 15-07-2021 19:06:27
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

import { HttpService } from '@nestjs/axios';
import { Keycloak } from 'keycloak-connect';
import { Reflector } from '@nestjs/core';
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger
} from '@nestjs/common';
import KeycloakService from '../keycloak.service';
import { KEYCLOAK, KEYCLOAK_OPTIONS } from '../index';
import { KeycloakOptions } from '../types';
import { RESOURCE } from '../decorators/resource.decorator';
import { SCOPES } from '../decorators/scopes.decorator';

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
    @Inject(KEYCLOAK_OPTIONS) private options: KeycloakOptions,
    @Inject(KEYCLOAK) private readonly keycloak: Keycloak,
    private readonly httpService: HttpService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const keycloakService = new KeycloakService(
      this.options,
      this.keycloak,
      this.httpService,
      context
    );
    const resource = this.getResource(context);
    if (!resource) return true;
    const username = (await keycloakService.getUserInfo())?.preferredUsername;
    if (!username) return false;
    const scopes = this.getScopes(context);
    if (!scopes.length) {
      this.logger.verbose(`resource '${resource}' granted to '${username}'`);
      return true;
    }
    this.logger.verbose(
      `protecting resource '${resource}' with scopes [ ${scopes.join(', ')} ]`
    );
    if (!scopes.length) return true;
    const permissions = scopes.map((scope) => `${resource}:${scope}`);
    if (await keycloakService.enforce(permissions)) {
      this.logger.verbose(`resource '${resource}' granted to '${username}'`);
      return true;
    }
    this.logger.verbose(`resource '${resource}' denied to '${username}'`);
    return false;
  }

  private getScopes(context: ExecutionContext) {
    const handlerScopes =
      this.reflector.get<string[]>(SCOPES, context.getHandler()) || [];
    const classScopes =
      this.reflector.get<string[]>(SCOPES, context.getClass()) || [];
    return [...new Set([...handlerScopes, ...classScopes])];
  }

  private getResource(context: ExecutionContext) {
    return this.reflector.get<string>(RESOURCE, context.getClass());
  }
}
