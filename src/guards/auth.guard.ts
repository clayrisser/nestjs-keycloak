/**
 * File: /src/guards/auth.guard.ts
 * Project: nestjs-keycloak
 * File Created: 14-07-2021 11:43:59
 * Author: Clay Risser <email@clayrisser.com>
 * -----
 * Last Modified: 15-07-2021 19:06:11
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
import { KEYCLOAK } from '../keycloak.provider';
import { KEYCLOAK_OPTIONS } from '../index';
import { KeycloakOptions } from '../types';
import { PUBLIC } from '../decorators/public.decorator';
import { RESOURCE } from '../decorators/resource.decorator';
import { ROLES } from '../decorators/roles.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  logger = new Logger(AuthGuard.name);

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
    const username = (await keycloakService.getUserInfo())?.preferredUsername;
    if (!username) return false;
    const isPublic = this.getIsPublic(context);
    if (isPublic) return true;
    const roles = this.getRoles(context);
    const resource = this.getResource(context);
    if (roles.length) {
      this.logger.verbose(
        `resource${
          resource ? `'${resource}' ` : ''
        } for '${username}' requires roles [ ${roles.join(' | ')} ]`
      );
    }
    if (await keycloakService.isAuthorizedByRoles(roles)) {
      this.logger.verbose(`authorization for '${username}' granted`);
      return true;
    }
    this.logger.verbose(`authorization for '${username}' denied`);
    return false;
  }

  private getIsPublic(context: ExecutionContext) {
    const handlerIsPublic = !!this.reflector.get<string>(
      PUBLIC,
      context.getHandler()
    );
    const classIsPublic = !!this.reflector.get<string>(
      PUBLIC,
      context.getClass()
    );
    return handlerIsPublic || classIsPublic;
  }

  private getRoles(context: ExecutionContext) {
    const handlerRoles =
      this.reflector.get<(string | string[])[]>(ROLES, context.getHandler()) ||
      [];
    const classRoles =
      this.reflector.get<(string | string[])[]>(ROLES, context.getClass()) ||
      [];
    return [...new Set([...handlerRoles.flat(), ...classRoles.flat()])];
  }

  private getResource(context: ExecutionContext) {
    return this.reflector.get<string>(RESOURCE, context.getClass());
  }
}
