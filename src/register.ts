import { HttpService } from '@nestjs/common';
import KcAdminClient from 'keycloak-admin';
import _ from 'lodash';
import qs from 'qs';
import { KeycloakOptions } from './types';

const kcAdminClient = new KcAdminClient();

export default class Register {
  constructor(
    private readonly options: KeycloakOptions,
    private httpService: HttpService
  ) {}

  async setup() {
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
    // Get and Create Roles
    const roles: any = await this.getRoles();
    // console.log(roles);
    const rolesToCreate = _.difference(data.roles, roles);
    // console.log(rolesToCreate);
    rolesToCreate.forEach((role) => {
      this.createRoles(role);
    });

    // // Create Resources
    const getResourcesRes = await this.getResources();
    const resources = _.map(getResourcesRes, 'name');
    // console.log(resources);
    const resourceToCreate = _.difference(
      Object.keys(data.resources),
      resources
    );
    // const resourceToUpdate = _.intersection(
    //   Object.keys(data.resources),
    //   resources
    // );
    // console.log(resourceToCreate);
    resourceToCreate.forEach(async (resource: string) => {
      const scopes: Array<string> = data.resources[resource];
      const createdScopes = await this.scopeOperations(scopes);
      await this.createResource(resource, createdScopes);
    });
  }

  async scopeOperations(scopes: Array<string>) {
    // // Create Scopes
    // // [{"id":"255c02ed-f9d5-4d5a-bd40-6c298ec44df5","name":"test-auth-scope"}]
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
    console.log('scopes to create and link', scopesToCreate);
    console.log('scopes to just link', scopesToLink);
    scopesToCreate.forEach(async (resource) => {
      const res: Scope | {} = (await this.createScope(resource)).data;
      if ('id' in res) createdScopes.push(res);
    });
    return createdScopes;
  }

  async enableAuthorization() {
    await kcAdminClient.clients
      .update(
        { id: this.options.clientUniqueId || '' },
        {
          clientId: this.options.clientId,
          authorizationServicesEnabled: true,
          serviceAccountsEnabled: true
        }
      )
      .catch((e) => {
        return e;
      });
  }

  async getRoles() {
    const roles: [Role] = await kcAdminClient.clients
      .listRoles({
        id: this.options.clientUniqueId || ''
      })
      .catch((e) => {
        return e;
      });
    console.log('roles in getRoles', roles);
    return _.map(roles, 'name');
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
      .toPromise()
      .catch((e) => {
        console.log('get resources failed', e);
        return { data: [] };
      });
    console.log('roles in getResources', resourcesRes.data);
    // return _.map(resourcesRes.data, 'name');
    return resourcesRes.data;
  }

  async createResource(resourceName: string, scopes: Array<Scope> | [] = []) {
    console.log(
      `${this.options.authServerUrl}/admin/realms/${this.options.realm}/clients/${this.options.clientUniqueId}/authz/resource-server/resource`
    );
    console.log(`Bearer ${(await this.getAccessToken()).data.access_token}`);
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
      .toPromise()
      .catch((e) => {
        console.log('create resources failed', e);
        return { data: {} };
      });
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
    console.log('roles in getscopes', scopes.data);
    // return _.map(scopes.data, 'name');
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
      .toPromise()
      .catch((e) => {
        console.log('create scopes failed', e);
        return { data: {} };
      });
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
