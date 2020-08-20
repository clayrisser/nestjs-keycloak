import Keycloak from 'keycloak-connect';
import KcAdminClient from 'keycloak-admin';
import axios from 'axios';
import { DynamicModule, Module, Provider } from '@nestjs/common';
import {
  KeycloakAxiosProvider,
  KEYCLOAK_AXIOS
} from './providers/axios.provider';
import { KEYCLOAK_OPTIONS, KEYCLOAK_INSTANCE } from './constants';
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
    KeycloakModule.setupKeycloak(options);
    return {
      module: KeycloakModule,
      providers: [
        KeycloakAxiosProvider,
        KeycloakService,
        this.keycloakProvider,
        {
          provide: KEYCLOAK_OPTIONS,
          useValue: options
        }
      ],
      exports: [
        KEYCLOAK_OPTIONS,
        KeycloakService,
        this.keycloakProvider,
        KEYCLOAK_AXIOS
      ]
    };
  }

  public static registerAsync(
    asyncOptions: KeycloakAsyncOptions
  ): DynamicModule {
    KeycloakModule.setupKeycloak({});
    return {
      module: KeycloakModule,
      imports: asyncOptions.imports || [],
      providers: [
        KeycloakAxiosProvider,
        KeycloakService,
        this.createOptionsProviders(asyncOptions),
        this.keycloakProvider
      ],
      exports: [
        KEYCLOAK_OPTIONS,
        KeycloakService,
        this.keycloakProvider,
        KEYCLOAK_AXIOS
      ]
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

  public static async setupKeycloak(options: KeycloakOptions) {
    console.log(options);
    console.log('call keycloak endpoint APIs');
    /*
    resources  {
      exampleResourceName: [scope1, scope2],
    }
    */
    const roles = ['admin', 'user'];
    const kcAdminClient = new KcAdminClient();
    kcAdminClient.auth({
      username: 'admin ',
      password: 'pass',
      grantType: 'password',
      clientId: 'admin-cli'
    });
    kcAdminClient.setConfig({
      realmName: 'Nestjs-keycloak-example'
    });
    roles.forEach(async (role) => {
      const createdRole = await kcAdminClient.roles.create({
        name: role
      });
      console.log(createdRole);
    });
  }

  public static async enableAuthorization(realm: string, id: string) {
    return axios.put(
      `http://localhost:8080/auth/admin/realms/${realm}/clients/${id}`,
      {
        authorizationServicesEnabled: true,
        serviceAccountsEnabled: true
      }
    );
  }

  public static async getRoles(realm: string, id: string) {
    return axios.get(
      `http://localhost:8080/auth/admin/${realm}/clients/${id}/roles`
    );
  }

  public static async createRoles(realm: string, id: string, role: string) {
    return axios.post(
      `http://localhost:8080/auth/admin/${realm}/clients/${id}/roles`,
      {
        name: role
      }
    );
  }

  public static async getResources(realm: string, id: string) {
    return axios.get(
      `http://localhost:8080/auth/admin/realms/${realm}/clients/${id}/authz/resource-server`
    );
  }

  public static async createResource(
    realm: string,
    id: string,
    resourceName: string
  ) {
    return axios.post(
      `http://localhost:8080/auth/admin/realms/${realm}/clients/${id}/authz/resource-server/resource`,
      {
        attributes: {},
        displayName: resourceName,
        name: resourceName,
        ownerManagedAccess: '',
        scopes: [],
        uris: []
      }
    );
  }

  public static updateResource(
    realm: string,
    id: string,
    resourceId: string,
    resourceName: string,
    scopeId: string,
    scopeName: string
  ) {
    return axios.put(
      'http://localhost:8080/auth/admin/realms/nestjs-keycloak-example/clients/cb11fd17-46df-419a-9c67-4a69d1be66ae/authz/resource-server/resource/e7e61d07-9f90-4c44-82d0-71e4009fd99e',
      {
        attributes: {},
        displayName: resourceName,
        name: resourceName,
        owner: {
          id, // client ID
          name: realm
        },
        ownerManagedAccess: false,
        scopes: [{ id: scopeId, name: scopeName }],
        uris: [],
        _id: resourceId
      }
    );
  }

  public static async getScopes(realm: string, id: string) {
    return axios.get(
      `http://localhost:8080/auth/admin/realms/${realm}/clients/${id}/authz/resource-server`
    );
  }

  public static async createScope(realm: string, id: string, scope: string) {
    return axios.post(
      `http://localhost:8080/auth/admin/realms/${realm}/clients/${id}/authz/resource-server/scope`,
      { name: scope }
    );
  }
}
