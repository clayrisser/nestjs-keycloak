/**
 * File: /src/keycloakRegister.service.ts
 * Project: nestjs-keycloak
 * File Created: 14-07-2021 11:43:59
 * Author: Clay Risser <email@clayrisser.com>
 * -----
 * Last Modified: 21-11-2022 05:02:31
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

import difference from 'lodash/difference';
import type KcAdminClient from '@keycloak/keycloak-admin-client' with { 'resolution-mode': 'import' };
import type ClientRepresentation from '@keycloak/keycloak-admin-client/lib/defs/clientRepresentation.js' with {
  'resolution-mode': 'import',
};
import type ResourceRepresentation from '@keycloak/keycloak-admin-client/lib/defs/resourceRepresentation.js' with {
  'resolution-mode': 'import',
};
import type RoleRepresentation from '@keycloak/keycloak-admin-client/lib/defs/roleRepresentation.js' with {
  'resolution-mode': 'import',
};
import type ScopeRepresentation from '@keycloak/keycloak-admin-client/lib/defs/scopeRepresentation.js' with {
  'resolution-mode': 'import',
};
import type { AuthorizationCallback } from './decorators/authorizationCallback.decorator';
import type { AxiosError } from 'axios';
import type { HashMap, KeycloakOptions, RegisterOptions } from './types';
import type { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { HttpService } from '@nestjs/axios';
import { Reflector } from '@nestjs/core';
import { AUTHORIZATION_CALLBACK } from './decorators/authorizationCallback.decorator';
import { AUTHORIZED } from './decorators/authorized.decorator';
import { DiscoveryService } from '@nestjs/core';
import { KEYCLOAK_OPTIONS } from './types';
import { Logger, Inject, Injectable } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { RESOURCE } from './decorators/resource.decorator';
import { SCOPES } from './decorators/scopes.decorator';

const privateGlobalRegistrationMap: GlobalRegistrationMap = {};

export function getGlobalRegistrationMap() {
  const globalRegistrationMap = { ...privateGlobalRegistrationMap };
  if (globalRegistrationMap.defaultAuthorizationCallback) {
    globalRegistrationMap.defaultAuthorizationCallback = {
      ...globalRegistrationMap.defaultAuthorizationCallback,
    };
  }
  return globalRegistrationMap;
}

// makes registration idempotent
let registeredKeycloak = false;

@Injectable()
export default class KeycloakRegisterService {
  private logger = new Logger(KeycloakRegisterService.name);

  private registerOptions: RegisterOptions;

  private keycloakAdmin?: KcAdminClient;

  constructor(
    @Inject(KEYCLOAK_OPTIONS) private readonly options: KeycloakOptions,
    @Inject(DiscoveryService) private readonly discoveryService: DiscoveryService,
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(HttpService) private readonly httpService: HttpService,
  ) {
    this.registerOptions = {
      roles: [],
      ...(typeof this.options.register === 'boolean' ? {} : this.options.register || {}),
    };
  }

  private _idsFromClientIds: HashMap<string> = {};

  private _providers: any[] | undefined;

  private _roles: string[] | undefined;

  private _authorizationCallbacks: AuthorizationCallback[] | undefined;

  private _defaultAuthorizationCallback: AuthorizationCallback | undefined;

  private get defaultAuthorizationCallback(): AuthorizationCallback | undefined {
    if (this._defaultAuthorizationCallback) {
      return this._defaultAuthorizationCallback;
    }
    this._defaultAuthorizationCallback =
      this.authorizationCallbacks.find(
        (authorizationCallback: AuthorizationCallback) =>
          authorizationCallback.default &&
          !authorizationCallback.manual &&
          authorizationCallback.persistSession &&
          authorizationCallback.destinationUriFromQuery,
      ) ||
      this.authorizationCallbacks.find(
        (authorizationCallback: AuthorizationCallback) =>
          !authorizationCallback.manual &&
          authorizationCallback.persistSession &&
          authorizationCallback.destinationUriFromQuery,
      ) ||
      undefined;
    return this._defaultAuthorizationCallback;
  }

  private get authorizationCallbacks(): AuthorizationCallback[] {
    if (this._authorizationCallbacks) return this._authorizationCallbacks;
    this._authorizationCallbacks = this.providers.reduce(
      (authorizationCallbacks: AuthorizationCallback[], controller: InstanceWrapper) => {
        const methods = getMethods(controller.instance);
        return [
          ...authorizationCallbacks,
          ...methods.reduce((authorizationCallbacks: AuthorizationCallback[], method: any) => {
            const authorizationCallback: AuthorizationCallback = this.reflector.get(AUTHORIZATION_CALLBACK, method);
            if (authorizationCallback) {
              const controllerPath = this.reflector.get(PATH_METADATA, controller.instance.constructor) || '';
              const methodPath = this.reflector.get(PATH_METADATA, method) || '';
              let callbackEndpoint =
                authorizationCallback.callbackEndpoint ||
                `/${controllerPath}${controllerPath && methodPath ? '/' : ''}${methodPath}`;
              authorizationCallbacks.push({
                destinationUriFromQuery: true,
                manual: false,
                persistSession: true,
                ...authorizationCallback,
                callbackEndpoint,
              });
            }
            return authorizationCallbacks;
          }, []),
        ];
      },
      [],
    );
    return this._authorizationCallbacks;
  }

  private get canRegister() {
    return !registeredKeycloak && !!this.options.register && this.options.adminUsername && this.options.adminPassword;
  }

  private get providers(): InstanceWrapper[] {
    if (this._providers) return this._providers;
    this._providers = [
      ...this.discoveryService
        .getProviders()
        .reduce((providers: InstanceWrapper<any>[], provider: InstanceWrapper<any>) => {
          if (typeof provider.name !== 'symbol' && provider.name?.endsWith('Resolver')) providers.push(provider);
          return providers;
        }, []),
      ...this.discoveryService.getControllers(),
    ];
    return this._providers;
  }

  private get roles() {
    if (this._roles) return this._roles;
    this._roles = [
      ...this.providers.reduce(
        (roles: Set<string>, controller: InstanceWrapper) => {
          const methods = getMethods(controller.instance);
          let values: any[] = [];
          try {
            values = this.reflector.getAllAndMerge(AUTHORIZED, [
              ...(controller.metatype ? [controller.metatype] : []),
              ...methods,
            ]);
          } catch (err) {
            this.logger.warn(err);
            // noop
          }
          return new Set([...roles, ...values.flat()]);
          // the final set dedupes roles listed both in a decorator and in the
          // register options, which would otherwise be created twice
        },
        new Set(this.registerOptions.roles || []),
      ),
    ];
    return this._roles;
  }

  private get applicationRoles() {
    return this.roles.filter((role: string) => !role.startsWith('realm:'));
  }

  private get realmRoles() {
    return this.roles
      .filter((role: string) => role.startsWith('realm:'))
      .map((role: string) => role.replace(/^realm:/g, ''));
  }

  private get resources(): HashMap<string[]> {
    return Object.entries(
      this.providers.reduce((resources: HashMap<Set<string>>, controller: InstanceWrapper) => {
        if (!controller.metatype) return resources;
        const methods = getMethods(controller.instance);
        const resourceName = this.reflector.get(RESOURCE, controller.metatype);
        if (!resourceName) return resources;
        resources[resourceName] = new Set([
          ...(resourceName in resources ? resources[resourceName] : []),
          ...methods.reduce((scopes: Set<string>, method: (...args: any[]) => any) => {
            const methodValues = this.reflector.get(SCOPES, method);
            return new Set([...scopes, ...(methodValues || [])]);
          }, new Set()),
        ]);
        return resources;
      }, {}),
    ).reduce((resources: HashMap<string[]>, [resourceName, scopes]: [string, Set<string>]) => {
      resources[resourceName] = [...new Set([...(resources[resourceName] || []), ...scopes])];
      return resources;
    }, this.registerOptions.resources || {});
  }

  async register(force = false) {
    privateGlobalRegistrationMap.defaultAuthorizationCallback = this.defaultAuthorizationCallback;
    if (!force && !this.canRegister) return;
    this.logger.log('waiting for keycloak');
    await this.waitForReady();
    this.logger.log('registering keycloak');
    await this.initializeKeycloakAdmin();
    const client = await this.getClient();
    await this.createRealmRoles();
    if (await this.canEnableAuthorization(client)) {
      await this.enableAuthorization(client);
      await this.createApplicationRoles();
      await this.createScopedResources();
    }
    registeredKeycloak = true;
  }

  private async initializeKeycloakAdmin() {
    if (!this.keycloakAdmin) {
      // @keycloak/keycloak-admin-client is esm-only, so it must be loaded with
      // a dynamic import() to keep this package consumable from commonjs
      const { default: KeycloakAdminClient } = await import('@keycloak/keycloak-admin-client');
      this.keycloakAdmin = new KeycloakAdminClient({ baseUrl: this.options.baseUrl });
    }
    await this.keycloakAdmin.auth({
      clientId: this.options.adminClientId || 'admin-cli',
      grantType: 'password',
      password: this.options.adminPassword,
      username: this.options.adminUsername,
    });
    this.keycloakAdmin.setConfig({
      realmName: this.options.realm,
    });
    return this.keycloakAdmin;
  }

  private async getClient() {
    const client = await this.keycloakAdmin!.clients.findOne({
      id: await this.getIdFromClientId(this.options.clientId),
    });
    if (!client) {
      throw new Error(`client ${this.options.clientId} does not exist`);
    }
    return client;
  }

  private async canEnableAuthorization(client: ClientRepresentation) {
    if (client?.publicClient) {
      this.logger.warn({ clientId: this.options.clientId }, 'authorization cannot be enabled on a public client');
      return false;
    }
    return true;
  }

  private async enableAuthorization(client: ClientRepresentation) {
    if (!client?.serviceAccountsEnabled || !client.authorizationServicesEnabled) {
      await this.keycloakAdmin!.clients.update(
        { id: await this.getIdFromClientId(this.options.clientId) },
        {
          authorizationServicesEnabled: true,
          clientId: this.options.clientId,
          serviceAccountsEnabled: true,
        },
      );
    }
  }

  private async createApplicationRoles() {
    const applicationRoles = (
      await this.keycloakAdmin!.clients.listRoles({
        id: await this.getIdFromClientId(this.options.clientId),
      })
    ).reduce((roles: string[], { name }: RoleRepresentation) => {
      if (name) roles.push(name);
      return roles;
    }, []);
    const rolesToCreate = difference(this.applicationRoles, applicationRoles);
    await Promise.all(
      rolesToCreate.map(async (role: string) =>
        this.keycloakAdmin!.clients.createRole({
          id: await this.getIdFromClientId(this.options.clientId),
          name: role,
        }),
      ),
    );
  }

  private async createRealmRoles() {
    const realmRoles = (await this.keycloakAdmin!.roles.find()).reduce(
      (roles: string[], { name }: RoleRepresentation) => {
        if (name) roles.push(name);
        return roles;
      },
      [],
    );
    const rolesToCreate = difference(this.realmRoles, realmRoles);
    await Promise.all(rolesToCreate.map(async (role: string) => this.keycloakAdmin!.roles.create({ name: role })));
  }

  private async createScopedResources() {
    const resources = await this.getResources();
    await Promise.all(
      Object.keys(this.resources).map(async (resourceName: string) => {
        const resource = resources.find((resource: ResourceRepresentation) => resource.name === resourceName);
        const scopes = this.resources[resourceName];
        const existingScopes = await this.getScopes(
          // resource.id is resource._id
          // @ts-ignore
          resource?.id || resource?._id,
          scopes,
        );
        const createdScopes = await this.createScopes(scopes, existingScopes);
        if (resource) {
          this.updateResource(resource, [...existingScopes, ...createdScopes]);
        } else {
          await this.createResource(resourceName, [...existingScopes, ...createdScopes]);
        }
      }),
    );
  }

  private async getIdFromClientId(clientId: string) {
    if (this._idsFromClientIds[clientId]) {
      return this._idsFromClientIds[clientId];
    }
    const idFromClientId = (await this.keycloakAdmin!.clients.find({ clientId }))?.[0]?.id;
    if (!idFromClientId) {
      throw new Error(`could not find id from clientId '${clientId}'`);
    }
    this._idsFromClientIds[clientId] = idFromClientId;
    return idFromClientId;
  }

  private async createScopes(
    scopes: string[],
    existingScopes: ScopeRepresentation[] = [],
  ): Promise<ScopeRepresentation[]> {
    const scopesToCreate = difference(
      scopes,
      existingScopes.reduce((scopeNames: string[], scope: ScopeRepresentation) => {
        if (scope.name) scopeNames.push(scope.name);
        return scopeNames;
      }, []),
    );
    const createdScopes: ScopeRepresentation[] = [];
    await Promise.all(
      scopesToCreate.map(async (scopeName: string) => {
        const scope = await this.createScope(scopeName);
        if (scope) createdScopes.push(scope);
      }),
    );
    return createdScopes;
  }

  private async getResources(): Promise<ResourceRepresentation[]> {
    // cannot have property 'name' to list all resource
    // @ts-ignore
    return this.keycloakAdmin!.clients.listResources({
      id: await this.getIdFromClientId(this.options.clientId),
    });
  }

  private async createResource(
    resourceName: string,
    scopes: ScopeRepresentation[] = [],
  ): Promise<ResourceRepresentation> {
    return this.keycloakAdmin!.clients.createResource(
      {
        id: await this.getIdFromClientId(this.options.clientId),
      },
      {
        attributes: {},
        displayName: resourceName,
        name: resourceName,
        scopes,
      },
    );
  }

  private async updateResource(resource: ResourceRepresentation, scopes: ScopeRepresentation[]) {
    return this.keycloakAdmin!.clients.updateResource(
      {
        id: await this.getIdFromClientId(this.options.clientId),
        // resource.id is resource._id
        // @ts-ignore
        resourceId: resource.id || resource._id || '',
      },
      {
        attributes: {},
        displayName: resource?.name,
        name: resource?.name,
        ownerManagedAccess: false,
        scopes,
        // TODO: probably can remove the following
        ...((resource as unknown as any)?.id
          ? {
              id: (resource as unknown as any)?.id,
            }
          : {}),
      },
    );
  }

  private async getScopes(resourceId?: string, scopeNames?: string[]): Promise<ScopeRepresentation[]> {
    let scopes: ScopeRepresentation[] = [];
    if (resourceId) {
      scopes = await this.keycloakAdmin!.clients.listScopesByResource({
        id: await this.getIdFromClientId(this.options.clientId),
        // resourceName is actually the resource id
        resourceName: resourceId,
      });
    } else {
      scopes = await this.keycloakAdmin!.clients.listAllScopes({
        id: await this.getIdFromClientId(this.options.clientId),
      });
    }
    if (scopeNames) {
      const scopeNamesSet = new Set(scopeNames);
      return scopes.reduce((scopes: ScopeRepresentation[], scope: ScopeRepresentation) => {
        if (scope.name && scopeNamesSet.has(scope.name)) scopes.push(scope);
        return scopes;
      }, []);
    }
    return scopes;
  }

  private async createScope(scope: string) {
    return this.keycloakAdmin!.clients.createAuthorizationScope(
      {
        id: await this.getIdFromClientId(this.options.clientId),
      },
      {
        name: scope,
      },
    );
  }

  private async waitForReady(interval = 5000): Promise<void> {
    try {
      const res = await this.httpService.axiosRef.get(`${this.options.baseUrl}/health/live`, {
        silent: !this.options.debug,
      } as any);
      if ((res?.status || 500) > 299) {
        await new Promise((r) => setTimeout(r, interval));
        return this.waitForReady(interval);
      }
    } catch (err) {
      const error = err as AxiosError;
      const res = error.response;
      if (res?.status === 404) return this.waitForReadyWellKnown(interval);
      await new Promise((r) => setTimeout(r, interval));
      return this.waitForReady(interval);
    }
  }

  private async waitForReadyWellKnown(interval = 5000): Promise<void> {
    try {
      const res = await this.httpService.axiosRef.get(
        `${this.options.baseUrl}/realms/master/.well-known/openid-configuration`,
        {
          silent: !this.options.debug,
        } as any,
      );
      if ((res.status || 500) > 299) {
        await new Promise((r) => setTimeout(r, interval));
        return this.waitForReadyWellKnown(interval);
      }
    } catch {
      await new Promise((r) => setTimeout(r, interval));
      return this.waitForReadyWellKnown(interval);
    }
  }
}

function getMethods(obj: any): ((...args: any[]) => any)[] {
  const propertyNames = new Set<string>();
  let current = obj;
  do {
    Object.getOwnPropertyNames(current).map((propertyName) => propertyNames.add(propertyName));
    // eslint-disable-next-line no-cond-assign
  } while ((current = Object.getPrototypeOf(current)));
  return [...propertyNames]
    .filter((propertyName: string) => typeof obj[propertyName] === 'function')
    .map((propertyName: string) => obj[propertyName]) as ((...args: any[]) => any)[];
}

export interface GlobalRegistrationMap {
  defaultAuthorizationCallback?: AuthorizationCallback;
}
