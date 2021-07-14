/**
 * File: /src/index.ts
 * Project: whisker-keycloak
 * File Created: 14-07-2021 11:43:59
 * Author: Clay Risser <email@clayrisser.com>
 * -----
 * Last Modified: 14-07-2021 11:46:02
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

import {
  MiddlewareConsumer,
  HttpService,
  Module,
  DynamicModule,
  NestModule,
  RequestMethod,
  HttpModule
} from '@nestjs/common';
import { DiscoveryModule, DiscoveryService, Reflector } from '@nestjs/core';
import KeycloakMiddleware from '~/keycloak.middleware';
import KeycloakProvider from '~/keycloak.provider';
import KeycloakService from '~/keycloak.service';
import Register from '~/register';
import { Options } from '~/types';

@Module({})
export default class KeycloakModule implements NestModule {
  private static imports = [HttpModule, DiscoveryModule];

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(KeycloakMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }

  public static register(options: Options): DynamicModule {
    return {
      module: KeycloakModule,
      imports: KeycloakModule.imports,
      providers: [
        KeycloakService,
        KeycloakProvider,
        {
          provide: KEYCLOAK_OPTIONS,
          useValue: options
        },
        this.createKeycloakRegisterProvider()
      ],
      exports: [KEYCLOAK_OPTIONS, KeycloakService, KeycloakProvider]
    };
  }

  private static createKeycloakRegisterProvider() {
    return {
      provide: KEYCLOAK_REGISTER,
      async useFactory(
        options: Options,
        httpService: HttpService,
        discoveryService: DiscoveryService,
        reflector: Reflector
      ) {
        await new Register(
          options,
          httpService,
          discoveryService,
          reflector
        ).setup();
      },
      inject: [KEYCLOAK_OPTIONS, HttpService, DiscoveryService, Reflector]
    };
  }
}

export const KEYCLOAK_OPTIONS = 'KEYCLOAK_OPTIONS';
export const KEYCLOAK_REGISTER = 'KEYCLOAK_REGISTER';
export * from './keycloak.provider';
export { KeycloakMiddleware, KeycloakProvider };
