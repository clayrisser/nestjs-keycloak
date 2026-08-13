/**
 * File: /src/index.ts
 * Project: nestjs-keycloak
 * File Created: 14-07-2021 11:43:59
 * Author: Clay Risser <email@clayrisser.com>
 * -----
 * Last Modified: 06-11-2022 22:49:33
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

import { DiscoveryModule, APP_GUARD } from '@nestjs/core';
import { HttpModule } from '@nestjs/axios';
import type { DynamicModule, MiddlewareConsumer, NestModule, OnModuleInit } from '@nestjs/common';
import { Global, Module, RequestMethod } from '@nestjs/common';
import CreateKeycloakAdminProvider from './createKeycloakAdmin.provider';
import KeycloakMiddleware from './keycloak.middleware';
import KeycloakProvider from './keycloak.provider';
import KeycloakRegisterService from './keycloakRegister.service';
import KeycloakService from './keycloak.service';
import { AuthGuard, ResourceGuard } from './guards';
import type { KeycloakOptions, KeycloakAsyncOptions } from './types';
import { KEYCLOAK_OPTIONS } from './types';
import { KeycloakAdminProvider } from './keycloakAdmin.provider';

@Global()
@Module({})
export default class KeycloakModule implements OnModuleInit, NestModule {
  private static imports = [HttpModule, DiscoveryModule];

  constructor(private readonly keycloakRegisterService: KeycloakRegisterService) {}

  public static register(options: KeycloakOptions): DynamicModule {
    return {
      module: KeycloakModule,
      global: true,
      imports: KeycloakModule.imports,
      providers: [
        CreateKeycloakAdminProvider,
        KeycloakAdminProvider,
        KeycloakProvider,
        KeycloakRegisterService,
        KeycloakService,
        {
          provide: KEYCLOAK_OPTIONS,
          useValue: options,
        },
        {
          provide: APP_GUARD,
          useClass: AuthGuard,
        },
        {
          provide: APP_GUARD,
          useClass: ResourceGuard,
        },
      ],
      exports: [
        KEYCLOAK_OPTIONS,
        CreateKeycloakAdminProvider,
        KeycloakAdminProvider,
        KeycloakProvider,
        KeycloakRegisterService,
        KeycloakService,
      ],
    };
  }

  public static registerAsync(asyncOptions: KeycloakAsyncOptions): DynamicModule {
    return {
      module: KeycloakModule,
      global: true,
      imports: [...KeycloakModule.imports, ...(asyncOptions.imports || [])],
      providers: [
        CreateKeycloakAdminProvider,
        KeycloakAdminProvider,
        KeycloakModule.createOptionsProvider(asyncOptions),
        KeycloakProvider,
        KeycloakRegisterService,
        KeycloakService,
        {
          provide: APP_GUARD,
          useClass: AuthGuard,
        },
        {
          provide: APP_GUARD,
          useClass: ResourceGuard,
        },
      ],
      exports: [
        KEYCLOAK_OPTIONS,
        CreateKeycloakAdminProvider,
        KeycloakAdminProvider,
        KeycloakProvider,
        KeycloakRegisterService,
        KeycloakService,
      ],
    };
  }

  private static createOptionsProvider(asyncOptions: KeycloakAsyncOptions) {
    if (!asyncOptions.useFactory) {
      throw new Error("registerAsync must have 'useFactory'");
    }
    return {
      inject: asyncOptions.inject || [],
      provide: KEYCLOAK_OPTIONS,
      useFactory: asyncOptions.useFactory,
    };
  }

  async onModuleInit() {
    await this.keycloakRegisterService.register();
  }

  configure(consumer: MiddlewareConsumer) {
    // express v5 (path-to-regexp v8) wildcard syntax
    consumer.apply(KeycloakMiddleware).forRoutes({ path: '{*splat}', method: RequestMethod.ALL });
  }
}

export { CreateKeycloakAdminProvider, KeycloakMiddleware, KeycloakProvider, KeycloakRegisterService, KeycloakService };

export * from './authState';
export * from './createKeycloakAdmin.provider';
export * from './decorators';
export * from './guards';
export * from './keycloak.provider';
export * from './keycloak.service';
export * from './keycloakAdmin.provider';
export * from './types';
// getBaseUrl is re-exported from ./decorators for backwards compatibility, so
// it is deliberately not part of this star export
export { describeError, isSafeRedirect, redactSecrets, sanitizeError, trustsProxy } from './security';
