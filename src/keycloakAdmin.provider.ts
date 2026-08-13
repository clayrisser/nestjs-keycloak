/**
 * File: /src/keycloakAdmin.provider.ts
 * Project: @risserlabs/nestjs-keycloak
 * File Created: 06-11-2022 22:42:11
 * Author: Clay Risser
 * -----
 * Last Modified: 06-11-2022 22:45:55
 * Modified By: Clay Risser
 * -----
 * Risser Labs LLC (c) Copyright 2021 - 2022
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

import type KcAdminClient from '@keycloak/keycloak-admin-client' with { 'resolution-mode': 'import' };
import type { FactoryProvider } from '@nestjs/common';
import { Scope } from '@nestjs/common';
import { CREATE_KEYCLOAK_ADMIN } from './createKeycloakAdmin.provider';

export const KEYCLOAK_ADMIN = 'KEYCLOAK_ADMIN';

export const KeycloakAdminProvider: FactoryProvider<KcAdminClient | void> = {
  provide: KEYCLOAK_ADMIN,
  inject: [CREATE_KEYCLOAK_ADMIN],
  scope: Scope.REQUEST,
  useFactory: async (createKeycloakAdmin: () => Promise<KcAdminClient | void>) => {
    const keycloakAdmin = createKeycloakAdmin();
    return keycloakAdmin;
  },
};
