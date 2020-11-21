import KcAdminClient from 'keycloak-admin';
import _ from 'lodash';
import qs from 'qs';
import { HttpService } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { KeycloakOptions } from './types';

const kcAdminClient = new KcAdminClient();

export default class Register {
  constructor(
    private readonly options: KeycloakOptions,
    private httpService: HttpService,
    private readonly discoveryService: DiscoveryService,
    private readonly reflector: Reflector
  ) {}

  get roles() {
    const controllers = this.discoveryService
      .getControllers()
      .map((instanceWrapper: InstanceWrapper) => instanceWrapper.instance);
    return this.getDecoratorValues('roles', controllers);
  }

  // TODO: attach scope to resource
  get scope() {
    const controllers = this.discoveryService
      .getControllers()
      .map((instanceWrapper: InstanceWrapper) => instanceWrapper.instance);
    return this.getDecoratorValues('scope', controllers);
  }

  getDecoratorValues(metadataKey: string, instances: any[]) {
    return [
      ...instances.reduce((roles: Set<string>, instance: any) => {
        const methods = getMethods(instance);
        const classValues = this.reflector.get(metadataKey, instance);
        return new Set([
          ...roles,
          ...(typeof classValues === 'undefined'
            ? []
            : Array.isArray(classValues)
            ? classValues
            : [classValues]),
          ...methods.reduce(
            (roles: string[], method: (...args: any[]) => any) => {
              const methodValues = this.reflector.get(metadataKey, method);
              return [
                ...roles,
                ...(typeof methodValues === 'undefined'
                  ? []
                  : Array.isArray(methodValues)
                  ? methodValues
                  : [methodValues])
              ];
            },
            []
          )
        ]);
      }, new Set())
    ];
  }

  async setup() {
    console.log('ROLES', this.roles);
    // REGISTER HERE
    console.log(this.options, this.httpService);
    const data: Data = {
      roles: ['role1', 'role2', 'role3'],
      resources: {
        resource1: ['scope1', 'scope2', 'scope3'],
        resource2: ['scope3', 'scope5', 'scope6']
      }
    };
    await kcAdminClient.auth({
      username: this.options.adminUser,
      password: this.options.adminPass,
      grantType: 'password',
      clientId: 'admin-cli'
    });

    kcAdminClient.setConfig({
      realmName: this.options.realm
    });

    // Enable Authorization service
    await this.enableAuthorization();
    const getRolesRes: any = await this.getRoles();
    const roleNames = _.map(getRolesRes, 'name');
    const rolesToCreate = _.difference(data.roles, roleNames);
    rolesToCreate.forEach((role) => {
      this.createRoles(role);
    });
    const getResourcesRes = await this.getResources();
    const resourceNames = _.map(getResourcesRes, 'name');
    const resourceToCreate = _.difference(
      Object.keys(data.resources),
      resourceNames
    );
    resourceToCreate.forEach(async (resource: string) => {
      const scopes: Array<string> = data.resources[resource];
      const scopesToAttach = await this.scopeOperations(scopes);
      await this.createResource(resource, scopesToAttach);
    });
  }

  async scopeOperations(scopes: Array<string>) {
    const createdScopes: Array<Scope> = [];
    const getScopesRes = await this.getScopes();
    const existingScopes = _.map(getScopesRes.data, 'name');
    const scopesToCreate = _.difference(scopes, existingScopes);
    const scopesToLink = _.intersection(scopes, existingScopes);
    if (scopesToLink.length) {
      const scopeInfo = _.filter(getScopesRes.data, (scope) => {
        return _.includes(existingScopes, scope.name);
      });
      createdScopes.concat(scopeInfo);
    }
    scopesToCreate.forEach(async (resource) => {
      const res: Scope | {} = (await this.createScope(resource)).data;
      if ('id' in res) createdScopes.push(res);
    });
    return createdScopes;
  }

  async enableAuthorization() {
    await kcAdminClient.clients.update(
      { id: this.options.clientUniqueId || '' },
      {
        clientId: this.options.clientId,
        authorizationServicesEnabled: true,
        serviceAccountsEnabled: true
      }
    );
  }

  async getRoles() {
    return kcAdminClient.clients.listRoles({
      id: this.options.clientUniqueId || ''
    });
  }

  async createRoles(role: string) {
    return kcAdminClient.clients.createRole({
      id: this.options.clientUniqueId,
      name: role
    });
  }

  async getAccessToken() {
    return this.httpService
      .post(
        `${this.options.authServerUrl}/realms/master/protocol/openid-connect/token`,
        qs.stringify({
          client_id: 'admin-cli',
          grant_type: 'password',
          username: 'admin',
          password: 'pass'
        }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
      )
      .toPromise();
  }

  async getResources() {
    const resourcesRes = await this.httpService
      .get<[Resource]>(
        `${this.options.authServerUrl}/admin/realms/${this.options.realm}/clients/${this.options.clientUniqueId}/authz/resource-server/resource`,
        {
          headers: {
            // Authorization: `Bearer ${kcAdminClient.getAccessToken()}`
            Authorization: `Bearer ${
              (await this.getAccessToken()).data.access_token
            }`
          }
        }
      )
      .toPromise();
    return resourcesRes.data;
  }

  async createResource(resourceName: string, scopes: Array<Scope> | [] = []) {
    return this.httpService
      .post(
        `${this.options.authServerUrl}/admin/realms/${this.options.realm}/clients/${this.options.clientUniqueId}/authz/resource-server/resource`,
        {
          attributes: {},
          displayName: resourceName,
          name: resourceName,
          ownerManagedAccess: '',
          scopes,
          uris: []
        },
        {
          headers: {
            // Authorization: `Bearer ${kcAdminClient.getAccessToken()}`
            'Content-Type': 'application/json',
            Authorization: `Bearer ${
              (await this.getAccessToken()).data.access_token
            }`
          }
        }
      )
      .toPromise();
  }

  updateResource(
    resourceName: string,
    resourceId: string,
    scopes: Array<Scope> | [] = []
  ) {
    return this.httpService
      .put(
        `${this.options.authServerUrl}/admin/realms/${this.options.realm}/clients/${this.options.clientUniqueId}/authz/resource-server/resource/${resourceId}`,
        qs.stringify({
          attributes: {},
          displayName: resourceName,
          name: resourceName,
          owner: {
            id: this.options.clientUniqueId, // client ID
            name: this.options.realm
          },
          ownerManagedAccess: false,
          scopes,
          uris: [],
          _id: resourceId
        }),
        {
          headers: {
            Authorization: `Bearer ${kcAdminClient.getAccessToken()}`
          }
        }
      )
      .toPromise();
  }

  async getScopes() {
    const scopes = await this.httpService
      .get<Array<Scope>>(
        `${this.options.authServerUrl}/admin/realms/${this.options.realm}/clients/${this.options.clientUniqueId}/authz/resource-server/scope`,
        {
          headers: {
            Authorization: `Bearer ${
              (await this.getAccessToken()).data.access_token
            }`
          }
        }
      )
      .toPromise()
      .catch((e) => {
        console.log('get scopes failed', e);
        return { data: [] };
      });
    return scopes;
  }

  async createScope(scope: string) {
    return this.httpService
      .post<Scope>(
        `${this.options.authServerUrl}/admin/realms/${this.options.realm}/clients/${this.options.clientUniqueId}/authz/resource-server/scope`,
        { name: scope },
        {
          headers: {
            Authorization: `Bearer ${
              (await this.getAccessToken()).data.access_token
            }`
          }
        }
      )
      .toPromise();
  }
}

export interface Role {
  clientRole: boolean;
  composite: boolean;
  containerId: string;
  id: string;
  name: string;
}
export interface Resource {
  name: string;
  owner: Resource;
  ownerManagedAccess: boolean;
  type: string;
  uris: [string];
  id: string;
}

export interface ResourceOwner {
  id: string;
  name: string;
}

export interface Data {
  roles: Array<string>;
  resources: DataResources;
}

export interface DataResources {
  [key: string]: Array<string>;
}

export interface Scope {
  name: string;
  id: string;
}

function getMethods(obj: any): ((...args: any[]) => any)[] {
  const propertyNames = new Set<string>();
  let current = obj;
  do {
    Object.getOwnPropertyNames(current).map((propertyName) =>
      propertyNames.add(propertyName)
    );
  } while ((current = Object.getPrototypeOf(current)));
  return [...propertyNames]
    .filter((propertyName: string) => typeof obj[propertyName] === 'function')
    .map((propertyName: string) => obj[propertyName]) as ((
    ...args: any[]
  ) => any)[];
}
