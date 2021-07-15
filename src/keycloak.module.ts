/**
 * File: /src/keycloak.module.ts
 * Project: whisker-keycloak
 * File Created: 14-07-2021 11:39:50
 * Author: Clay Risser <email@clayrisser.com>
 * -----
 * Last Modified: 15-07-2021 16:09:11
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

import Keycloak from 'keycloak-connect';
import { DiscoveryModule, DiscoveryService, Reflector } from '@nestjs/core';
import { DynamicModule, Module, Provider } from '@nestjs/common';
import { HttpService, HttpModule } from '@nestjs/axios';
import Register from './register';
import { KeycloakAsyncOptions, KeycloakOptions } from './types';
import { KeycloakService } from './keycloak.service';
import {
  KEYCLOAK_OPTIONS,
  KEYCLOAK_INSTANCE,
  KEYCLOAK_REGISTER
} from './constants';

export * from './authenticate';
export * from './constants';
export * from './decorators/public.decorator';
export * from './decorators/resource.decorator';
export * from './decorators/roles.decorator';
export * from './decorators/scopes.decorator';
export * from './guards/auth.guard';
export * from './guards/resource.guard';
export * from './keycloak.service';
export * from './typeGraphql';
export * from './types';

@Module({})
export class KeycloakModule {
  public static imports = [HttpModule, DiscoveryModule];

  public static register(options: KeycloakOptions): DynamicModule {
    return {
      module: KeycloakModule,
      imports: KeycloakModule.imports,
      providers: [
        KeycloakService,
        this.keycloakProvider,
        {
          provide: KEYCLOAK_OPTIONS,
          useValue: options
        },
        this.createKeycloakRegisterProvider()
      ],
      exports: [KEYCLOAK_OPTIONS, KeycloakService, this.keycloakProvider]
    };
  }

  public static registerAsync(
    asyncOptions: KeycloakAsyncOptions
  ): DynamicModule {
    return {
      module: KeycloakModule,
      imports: [...(asyncOptions.imports || []), ...KeycloakModule.imports],
      providers: [
        KeycloakService,
        this.createOptionsProvider(asyncOptions),
        this.keycloakProvider,
        this.createKeycloakRegisterProvider()
      ],
      exports: [KEYCLOAK_OPTIONS, KeycloakService, this.keycloakProvider]
    };
  }

  private static createKeycloakRegisterProvider() {
    return {
      provide: KEYCLOAK_REGISTER,
      useFactory(
        options: KeycloakOptions,
        httpService: HttpService,
        discoveryService: DiscoveryService,
        reflector: Reflector
      ) {
        KeycloakModule.setupKeycloak(
          options,
          httpService,
          discoveryService,
          reflector
        );
      },
      inject: [KEYCLOAK_OPTIONS, HttpService, DiscoveryService, Reflector]
    };
  }

  private static createOptionsProvider(asyncOptions: KeycloakAsyncOptions) {
    if (!asyncOptions.useFactory) {
      throw new Error("registerAsync must have 'useFactory'");
    }
    return {
      inject: asyncOptions.inject || [],
      provide: KEYCLOAK_OPTIONS,
      useFactory: asyncOptions.useFactory
    };
  }

  private static keycloakProvider: Provider = {
    provide: KEYCLOAK_INSTANCE,
    useFactory: (options: KeycloakOptions) => {
      const keycloak: any = new Keycloak({}, options as any);
      keycloak.accessDenied = (req: any, _res: any, next: any) => {
        req.resourceDenied = true;
        next();
      };
      return keycloak;
    },
    inject: [KEYCLOAK_OPTIONS]
  };

  static async setupKeycloak(
    options: KeycloakOptions,
    httpService: HttpService,
    discoveryService: DiscoveryService,
    reflector: Reflector
  ) {
    const register = new Register(
      options,
      httpService,
      discoveryService,
      reflector
    );
    await register.setup();
  }
}
