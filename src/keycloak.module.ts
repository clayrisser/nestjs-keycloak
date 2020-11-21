import Keycloak from 'keycloak-connect';
import { DiscoveryModule, DiscoveryService, Reflector } from '@nestjs/core';
import {
  DynamicModule,
  Module,
  Provider,
  HttpModule,
  HttpService
} from '@nestjs/common';
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
