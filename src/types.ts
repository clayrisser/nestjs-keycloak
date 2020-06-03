import { Grant } from 'keycloak-connect';
import { ModuleMetadata, Type } from '@nestjs/common/interfaces';
import { Provider } from '@nestjs/common';
import { Request } from 'express';

export interface UserInfo {
  email_verified: boolean;
  preferred_username: string;
  sub: string;
}

export type KeycloakedRequest<T = Request> = {
  grant?: Grant;
  user?: UserInfo;
  session?: {
    refreshToken?: string;
    token?: string;
    user?: UserInfo;
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
