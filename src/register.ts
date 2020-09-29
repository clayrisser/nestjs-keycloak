import { HttpService } from '@nestjs/common';
import KcAdminClient from 'keycloak-admin';
import _ from 'lodash';
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
    const data = {
      roles: ['role1', 'role2', 'role3'],
      resources: {
        resource1: ['scope1', 'scope2', 'scope3'],
        resource2: ['scope2', 'scope3', 'scope4']
      }
    };
    await kcAdminClient.auth({
      username: 'admin',
      password: 'pass',
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
    console.log(roles);
    const rolesToCreate = _.difference(data.roles, roles);
    console.log(rolesToCreate);
    rolesToCreate.forEach((role) => {
      this.createRoles(role);
    });
    // // Create Resources
    // // [{"name":"Default Resource","type":"urn:nestjs-keycloak-example:resources:default","owner":{"id":"cb11fd17-46df-419a-9c67-4a69d1be66ae","name":"nestjs-keycloak-example"},"ownerManagedAccess":false,"_id":"8c75b071-c7a3-43e8-b84d-dae1fd0ce284","uris":["/*"]},{"name":"test resource","owner":{"id":"cb11fd17-46df-419a-9c67-4a69d1be66ae","name":"nestjs-keycloak-example"},"ownerManagedAccess":false,"_id":"45adc2e6-c5b8-40c3-87b2-90761ec2c27e","uris":[]}]
    // const resources: any = await this.getResources();
    // Object.keys(data.resources).forEach((resource) => {
    //   resources.forEach((existingResource: any) => {
    //     if (existingResource.name !== resource) {
    //       this.createResource(resource);
    //     }
    //   });
    // });

    // // const scopes: any = await this.getScopes();
    // // Create Scopes
    // // [{"id":"255c02ed-f9d5-4d5a-bd40-6c298ec44df5","name":"test-auth-scope"}]
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
    const roles = await kcAdminClient.clients
      .listRoles({
        id: this.options.clientUniqueId || ''
      })
      .catch((e) => {
        return e;
      });
    return _.map(roles, 'name');
  }

  async createRoles(role: string) {
    return kcAdminClient.clients.createRole({
      id: this.options.clientUniqueId,
      name: role
    });
  }

  async getResources() {
    return this.httpService.get(
      `${this.options.authServerUrl}admin/realms/${this.options.realm}/clients/${this.options.clientId}/authz/resource-server/resource`
    );
  }

  async createResource(resourceName: string) {
    return this.httpService
      .post(
        `${this.options.authServerUrl}admin/realms/${this.options.realm}/clients/${this.options.clientId}/authz/resource-server/resource`,
        {
          attributes: {},
          displayName: resourceName,
          name: resourceName,
          ownerManagedAccess: '',
          scopes: [],
          uris: []
        }
      )
      .toPromise();
  }

  updateResource(
    resourceName: string,
    resourceId: string,
    scopeId: string,
    scopeName: string
  ) {
    return this.httpService
      .put(
        `${this.options.authServerUrl}admin/realms/${this.options.realm}/clients/${this.options.clientId}/authz/resource-server/resource/${resourceId}`,
        {
          attributes: {},
          displayName: resourceName,
          name: resourceName,
          owner: {
            id: this.options.clientId, // client ID
            name: this.options.realm
          },
          ownerManagedAccess: false,
          scopes: [{ id: scopeId, name: scopeName }],
          uris: [],
          _id: resourceId
        }
      )
      .toPromise();
  }

  async getScopes() {
    const scopes = await kcAdminClient.clientScopes.find();
    return scopes;
    // return this.httpService
    //   .get(
    //     `${this.options.authServerUrl}admin/realms/${this.options.realm}/clients/${this.options.clientId}/authz/resource-server/scope`
    //   )
    //   .toPromise();
  }

  async createScope(scope: string) {
    await kcAdminClient.clientScopes.create({
      name: scope
    });

    // return this.httpService
    //   .post(
    //     `${this.options.authServerUrl}admin/realms/${this.options.realm}/clients/${this.options.clientId}/authz/resource-server/scope`,
    //     { name: scope }
    //   )
    //   .toPromise();
  }
}
