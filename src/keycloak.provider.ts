/**
 * File: /src/keycloak.provider.ts
 * Project: nestjs-keycloak
 * File Created: 14-07-2021 11:43:59
 * Author: Clay Risser <email@clayrisser.com>
 * -----
 * Last Modified: 12-04-2023 14:55:40
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

import type { Keycloak } from 'keycloak-connect';
import KeycloakConnect from 'keycloak-connect';
import session from 'express-session';
import type { FactoryProvider } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import type { KeycloakOptions, KeycloakRequest } from './types';
import { KEYCLOAK_OPTIONS } from './types';

export const KEYCLOAK = 'KEYCLOAK';

const KeycloakProvider: FactoryProvider<Keycloak> = {
  inject: [KEYCLOAK_OPTIONS],
  provide: KEYCLOAK,
  useFactory: (options: KeycloakOptions) => {
    const { clientSecret, clientId, realm } = options;
    const keycloak: Keycloak & { accessDenied: any } = new KeycloakConnect({ store: new session.MemoryStore() }, {
      clientId,
      realm,
      serverUrl: options.baseUrl,
      credentials: clientSecret ? { secret: clientSecret } : {},
    } as unknown as any);
    keycloak.accessDenied = (req: KeycloakRequest<Request>, _res: Response, next: NextFunction) => {
      req.resourceDenied = true;
      next();
    };
    return keycloak;
  },
};

export default KeycloakProvider;
