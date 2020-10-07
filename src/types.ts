import { Grant } from 'keycloak-connect';
import { ModuleMetadata } from '@nestjs/common/interfaces';
import { Request } from 'express';

export interface UserInfo {
  emailVerified: boolean;
  preferredUsername: string;
  sub: string;
  [key: string]: any;
}

export type KeycloakedRequest<T = Request> = {
  grant?: Grant;
  userInfo?: UserInfo;
  session?: {
    refreshToken?: string;
    token?: string;
    userInfo?: UserInfo;
    [key: string]: any;
  };
} & T;

export interface KeycloakAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  inject?: any[];
  useFactory?: (...args: any[]) => Promise<KeycloakOptions> | KeycloakOptions;
}

export interface KeycloakOptions {
  authServerUrl: string;
  clientId?: string;
  debug?: boolean;
  realm?: string;
  realmPublicKey?: string;
  secret?: string;
  clientUniqueId: string;
  adminUser: string;
  adminPass: string;
}
