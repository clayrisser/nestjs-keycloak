/**
 * File: /src/typegraphql/resourceGuard.provider.ts
 * Project: nestjs-keycloak
 * File Created: 15-07-2021 21:45:29
 * Author: Clay Risser <email@clayrisser.com>
 * -----
 * Last Modified: 15-07-2021 22:59:42
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
import {
  Logger,
  FactoryProvider,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import { MiddlewareFn, NextFn, ResolverData } from 'type-graphql';
import KeycloakService from '../keycloak.service';
import { KEYCLOAK } from '../keycloak.provider';
import { KeycloakOptions, KEYCLOAK_OPTIONS, GraphqlContext } from '../types';

const logger = new Logger('ResourceGuard');
export const RESOURCE_GUARD = 'RESOURCE_GUARD';

const ResourceGuardProvider: FactoryProvider<MiddlewareFn<GraphqlContext>> = {
  provide: RESOURCE_GUARD,
  inject: [KEYCLOAK_OPTIONS, KEYCLOAK, HttpService],
  useFactory: (
    options: KeycloakOptions,
    keycloak: Keycloak,
    httpService: HttpService
  ) => {
    return async ({ context }: ResolverData<GraphqlContext>, next: NextFn) => {
      if (!(await canActivate(options, keycloak, httpService, context))) {
        throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
      }
      return next();
    };
  }
};

async function canActivate(
  options: KeycloakOptions,
  keycloak: Keycloak,
  httpService: HttpService,
  context: GraphqlContext
): Promise<boolean> {
  const keycloakService = new KeycloakService(
    options,
    keycloak,
    httpService,
    context
  );
  const resource = context.typegraphqlMeta?.resource;
  if (!resource) return true;
  const username = (await keycloakService.getUserInfo())?.preferredUsername;
  if (!username) return false;
  const scopes = context.typegraphqlMeta?.scopes || [];
  if (!scopes.length) {
    logger.verbose(`resource '${resource}' granted to '${username}'`);
    return true;
  }
  logger.verbose(
    `protecting resource '${resource}' with scopes [ ${scopes.join(', ')} ]`
  );
  if (!scopes.length) return true;
  const permissions = scopes.map((scope) => `${resource}:${scope}`);
  if (await keycloakService.enforce(permissions)) {
    logger.verbose(`resource '${resource}' granted to '${username}'`);
    return true;
  }
  logger.verbose(`resource '${resource}' denied to '${username}'`);
  return false;
}

export default ResourceGuardProvider;
