import KeycloakConnect from 'keycloak-connect';
import { DynamicModule, Module, Provider } from '@nestjs/common';
import { AxiosProvider } from './providers/axios.provider';
import { KEYCLOAK_CONNECT_OPTIONS, KEYCLOAK_INSTANCE } from './constants';
import { KeycloakService } from './keycloak.service';
import {
  KeycloakConnectOptionsFactory,
  KeycloakConnectModuleAsyncOptions
} from './types';

export * from './authenticate';
export * from './constants';
export * from './decorators/public.decorator';
export * from './decorators/resource.decorator';
export * from './decorators/roles.decorator';
export * from './decorators/scopes.decorator';
export * from './guards/auth.guard';
export * from './guards/resource.guard';
export * from './keycloak.service';
export * from './types';

declare interface KeycloakConnectOptions {
  authServerUrl: string;
  clientId?: string;
  realm?: string;
  realmPublicKey?: string;
  secret?: string;
}

@Module({})
export class KeycloakConnectModule {
  public static register(options: KeycloakConnectOptions): DynamicModule {
    return {
      module: KeycloakConnectModule,
      providers: [
        AxiosProvider,
        KeycloakService,
        this.keycloakProvider,
        {
          provide: KEYCLOAK_CONNECT_OPTIONS,
          useValue: options
        }
      ],
      exports: [
        AxiosProvider,
        KEYCLOAK_CONNECT_OPTIONS,
        KeycloakService,
        this.keycloakProvider
      ]
    };
  }

  public static registerAsync(
    options: KeycloakConnectModuleAsyncOptions
  ): DynamicModule {
    return {
      module: KeycloakConnectModule,
      imports: options.imports || [],
      providers: [
        KeycloakService,
        options.axiosProvider || AxiosProvider,
        this.createConnectProviders(options) as any,
        this.keycloakProvider
      ],
      exports: [
        KEYCLOAK_CONNECT_OPTIONS,
        KeycloakService,
        options.axiosProvider || AxiosProvider,
        this.keycloakProvider
      ]
    };
  }

  private static createConnectProviders(
    options: KeycloakConnectModuleAsyncOptions
  ) {
    if (options.useExisting || options.useFactory) {
      return this.createConnectOptionsProvider(options);
    }
    if (!options.useClass) {
      return {
        provide: options.useClass,
        useClass: options.useClass
      };
    }
    throw new Error(
      "registerAsync must have 'useExisting', 'useFactory', or 'useClass'"
    );
  }

  private static createConnectOptionsProvider(
    options: KeycloakConnectModuleAsyncOptions
  ): Provider {
    if (options.useFactory) {
      return {
        inject: options.inject || [],
        provide: KEYCLOAK_CONNECT_OPTIONS,
        useFactory: options.useFactory
      };
    }
    return {
      provide: KEYCLOAK_CONNECT_OPTIONS,
      useFactory: async (optionsFactory: KeycloakConnectOptionsFactory) =>
        await optionsFactory.createKeycloakConnectOptions(),
      inject: [options.useExisting || (options.useClass as any)]
    };
  }

  private static keycloakProvider: Provider = {
    provide: KEYCLOAK_INSTANCE,
    useFactory: (options: KeycloakConnectOptions) => {
      const keycloak: any = new KeycloakConnect({}, options as any);
      keycloak.accessDenied = (req: any, _res: any, next: any) => {
        req.resourceDenied = true;
        next();
      };
      return keycloak;
    },
    inject: [KEYCLOAK_CONNECT_OPTIONS]
  };
}
