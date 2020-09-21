import Keycloak from 'keycloak-connect';
import { DynamicModule, Module, Provider, HttpModule } from '@nestjs/common';
import {
  KEYCLOAK_OPTIONS,
  KEYCLOAK_INSTANCE,
  KEYCLOAK_SETUP
} from './constants';
import { KeycloakAsyncOptions } from './types';
import { KeycloakService } from './keycloak.service';

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
    this.setup(options);
    return {
      module: KeycloakModule,
      imports: [HttpModule],
      providers: [
        KeycloakService,
        this.keycloakProvider,
        {
          provide: KEYCLOAK_OPTIONS,
          useValue: options
        }
      ],
      exports: [KEYCLOAK_OPTIONS, KeycloakService, this.keycloakProvider]
    };
  }

  public static registerAsync(
    asyncOptions: KeycloakAsyncOptions
  ): DynamicModule {
    KeycloakModule.setupKeycloak({});
    return {
      module: KeycloakModule,
      imports: [...(asyncOptions.imports || []), HttpModule],
      providers: [
        KeycloakService,
        this.createOptionsProviders(asyncOptions),
        this.keycloakProvider,
        {
          provide: KEYCLOAK_SETUP,
          useFactory(options: KeycloakOptions) {
            KeycloakModule.setup(options);
          },
          inject: [KEYCLOAK_OPTIONS]
        }
      ],
      exports: [KEYCLOAK_OPTIONS, KeycloakService, this.keycloakProvider]
    };
  }

  private static createOptionsProviders(asyncOptions: KeycloakAsyncOptions) {
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

  static async setup(options: KeycloakOptions) {
    console.log('setting up keycloak', options);
  }
}
