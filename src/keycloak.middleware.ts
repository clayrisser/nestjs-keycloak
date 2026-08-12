/**
 * File: /src/keycloak.middleware.ts
 * Project: nestjs-keycloak
 * File Created: 14-07-2021 11:43:59
 * Author: Clay Risser <email@clayrisser.com>
 * -----
 * Last Modified: 12-04-2023 18:06:51
 * Modified By: Clay Risser
 * -----
 * Risser Labs LLC (c) Copyright 2021
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

import type { NestMiddleware } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Injectable, Logger } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import KeycloakService from './keycloak.service';

@Injectable()
export default class KeycloakMiddleware implements NestMiddleware {
  private readonly logger = new Logger(KeycloakMiddleware.name);

  constructor(@Inject(KeycloakService) private readonly keycloakService: KeycloakService) {}

  async use(_req: Request, _res: Response, next: NextFunction) {
    try {
      await this.keycloakService.getGrant();
    } catch (err) {
      // invalid or expired credentials resolve to an anonymous request here;
      // guards decide whether the route actually requires authentication
      this.logger.verbose(`failed to resolve grant: ${(err as Error).message}`);
    }
    return next();
  }
}
