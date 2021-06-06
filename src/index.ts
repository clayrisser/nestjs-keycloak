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
