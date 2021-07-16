/**
 * File: /src/keycloak.provider.ts
 * Project: nestjs-keycloak
 * File Created: 14-07-2021 11:43:59
 * Author: Clay Risser <email@clayrisser.com>
 * -----
 * Last Modified: 15-07-2021 19:07:45
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
import session from 'express-session';
import { FactoryProvider } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { KeycloakOptions, KeycloakRequest } from './types';
import { KEYCLOAK_OPTIONS } from './index';

export const KEYCLOAK = 'KEYCLOAK';

const KeycloakProvider: FactoryProvider<Keycloak> = {
  provide: KEYCLOAK,
  inject: [KEYCLOAK_OPTIONS],
  useFactory: (options: KeycloakOptions) => {
    const { baseUrl, clientSecret, clientId, realm } = options;
    const keycloak: Keycloak & { accessDenied: any } = new KeycloakConnect(
      { store: new session.MemoryStore() },
      {
        bearerOnly: true,
        clientId,
        realm,
        serverUrl: `${baseUrl}/auth`,
        credentials: {
          ...(clientSecret ? { secret: clientSecret } : {})
        }
      } as unknown as any
    );
    keycloak.accessDenied = (
      req: KeycloakRequest<Request>,
      _res: Response,
      next: NextFunction
    ) => {
      req.resourceDenied = true;
      next();
    };
    return keycloak;
  }
};

export default KeycloakProvider;
