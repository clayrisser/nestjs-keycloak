import { Grant } from 'keycloak-connect';
import { ModuleMetadata, Type } from '@nestjs/common/interfaces';
import { Provider } from '@nestjs/common';
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

export interface KeycloakConnectModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  axiosProvider?: Provider;
  inject?: any[];
  useClass?: Type<KeycloakConnectOptionsFactory>;
  useExisting?: Type<KeycloakConnectOptionsFactory>;
  useFactory?: (
    ...args: any[]
  ) => Promise<KeycloakConnectOptions> | KeycloakConnectOptions;
}

export interface KeycloakConnectOptions {
  authServerUrl: string;
  clientId: string;
  realm: string;
  secret: string;
}

export interface KeycloakConnectOptionsFactory {
  createKeycloakConnectOptions():
    | KeycloakConnectOptions
    | Promise<KeycloakConnectOptions>;
}
