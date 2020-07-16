import Keycloak from 'keycloak-connect';
import { DynamicModule, Module, Provider } from '@nestjs/common';
import { AxiosProvider } from './providers/axios.provider';
import { KEYCLOAK_OPTIONS, KEYCLOAK_INSTANCE } from './constants';
import { KeycloakService } from './keycloak.service';
import { KeycloakOptionsFactory, KeycloakModuleAsyncOptions } from './types';

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

declare interface KeycloakOptions {
  authServerUrl: string;
  clientId?: string;
  realm?: string;
  realmPublicKey?: string;
  secret?: string;
}

@Module({})
export class KeycloakModule {
  public static register(options: KeycloakOptions): DynamicModule {
    return {
      module: KeycloakModule,
      providers: [
        AxiosProvider,
        KeycloakService,
        this.keycloakProvider,
        {
          provide: KEYCLOAK_OPTIONS,
          useValue: options
        }
      ],
      exports: [
        AxiosProvider,
        KEYCLOAK_OPTIONS,
        KeycloakService,
        this.keycloakProvider
      ]
    };
  }

  public static registerAsync(
    options: KeycloakModuleAsyncOptions
  ): DynamicModule {
    return {
      module: KeycloakModule,
      imports: options.imports || [],
      providers: [
        KeycloakService,
        options.axiosProvider || AxiosProvider,
        this.createProviders(options) as any,
        this.keycloakProvider
      ],
      exports: [
        KEYCLOAK_OPTIONS,
        KeycloakService,
        options.axiosProvider || AxiosProvider,
        this.keycloakProvider
      ]
    };
  }

  private static createProviders(options: KeycloakModuleAsyncOptions) {
    if (options.useExisting || options.useFactory) {
      return this.createOptionsProvider(options);
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

  private static createOptionsProvider(
    options: KeycloakModuleAsyncOptions
  ): Provider {
    if (options.useFactory) {
      return {
        inject: options.inject || [],
        provide: KEYCLOAK_OPTIONS,
        useFactory: options.useFactory
      };
    }
    return {
      provide: KEYCLOAK_OPTIONS,
      useFactory: async (optionsFactory: KeycloakOptionsFactory) =>
        await optionsFactory.createKeycloakOptions(),
      inject: [options.useExisting || (options.useClass as any)]
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
}
