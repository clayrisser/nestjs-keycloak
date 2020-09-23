import { HttpService } from '@nestjs/common';
import qs from 'qs';
import { KeycloakOptions } from './types';

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

    const getAccessTokenRes = await this.getAccessToken();
    console.log('getAccessTokenRes', getAccessTokenRes.data);
    const enableAuthorizationRes = await this.enableAuthorization(
      getAccessTokenRes.data
    );
    console.log('enableAuthorizationRes', enableAuthorizationRes.data);
    // const roles: any = await this.getRoles();
    // data.roles.forEach((role) => {
    //   roles.forEach((existingRole: any) => {
    //     if (existingRole.name !== role) {
    //       this.createRoles(role);
    //     }
    //   });
    // });
    // // Create Resources
    // const resources: any = await this.getResources();
    // Object.keys(data.resources).forEach((resource) => {
    //   resources.forEach((existingResource: any) => {
    //     if (existingResource.name !== resource) {
    //       this.createResource(resource);
    //     }
    //   });
    // });
    // // Create Scopes
  }

  async getAccessToken() {
    return this.httpService
      .post<GetAccessTokenRes>(
        `${this.options.authServerUrl}/realms/${this.options.realm}/protocol/openid-connect/token`,
        qs.stringify({
          grant_type: 'client_credentials',
          client_id: this.options.clientId,
          client_secret: this.options.secret
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      )
      .toPromise()
      .catch((e) => {
        return { data: e };
      });
  }

  async refreshAccessToken(refreshToken: string) {
    return this.httpService
      .post<GetAccessTokenRes>(
        `${this.options.authServerUrl}/realms/${this.options.realm}/protocol/openid-connect/token`,
        {
          grant_type: 'refresh_token',
          client_id: this.options.clientId,
          client_secret: this.options.secret,
          refresh_token: refreshToken
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      )
      .toPromise();
  }

  async enableAuthorization(res: GetAccessTokenRes) {
    return this.httpService
      .put<any>(
        `${this.options.authServerUrl}/admin/realms/${this.options.realm}/clients/${this.options.clientId}`,
        qs.stringify({
          authorizationServicesEnabled: true,
          serviceAccountsEnabled: true
        }),
        {
          headers: {
            Authorization: `Bearer ${res.access_token}`
          }
        }
      )
      .toPromise()
      .catch(async (e) => {
        // if (e.response.status === 401) {
        //   const refreshAccessTokenRes = await this.refreshAccessToken(
        //     res.refresh_token
        //   );
        //   this.enableAuthorization(refreshAccessTokenRes.data);
        // }
        return { data: e };
      });
  }

  async getRoles(accessToken: string) {
    return this.httpService
      .get<Array<string>>(
        `${this.options.authServerUrl}admin/${this.options.realm}/clients/${this.options.clientId}/roles`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      )
      .toPromise()
      .catch(async (e) => {
        return { data: e };
      });
  }

  async createRoles(role: string, accessToken: string) {
    return this.httpService
      .post(
        `${this.options.authServerUrl}admin/${this.options.realm}/clients/${this.options.clientId}/roles`,
        {
          name: role
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Bearer ${accessToken}`
          }
        }
      )
      .toPromise();
  }

  async getResources(accessToken: string) {
    return this.httpService
      .get(
        `${this.options.authServerUrl}admin/realms/${this.options.realm}/clients/${this.options.clientId}/authz/resource-server/resource`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      )
      .toPromise();
  }

  async createResource(resourceName: string, accessToken: string) {
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
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Bearer ${accessToken}`
          }
        }
      )
      .toPromise();
  }

  updateResource(
    resourceName: string,
    resourceId: string,
    scopeId: string,
    scopeName: string,
    accessToken: string
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
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Bearer ${accessToken}`
          }
        }
      )
      .toPromise();
  }

  async getScopes(accessToken: string) {
    return this.httpService
      .get(
        `${this.options.authServerUrl}admin/realms/${this.options.realm}/clients/${this.options.clientId}/authz/resource-server/scope`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Bearer ${accessToken}`
          }
        }
      )
      .toPromise();
  }

  async createScope(scope: string, accessToken: string) {
    return this.httpService
      .post(
        `${this.options.authServerUrl}admin/realms/${this.options.realm}/clients/${this.options.clientId}/authz/resource-server/scope`,
        { name: scope },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Bearer ${accessToken}`
          }
        }
      )
      .toPromise();
  }
}

export interface GetAccessTokenRes {
  access_token: string;
  expires_in?: string;
  refresh_expires_in?: number;
  refresh_token: string;
  token_type?: string;
  'not-before-policy'?: string;
  session_state?: string;
  scope?: string;
}
