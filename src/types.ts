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

export interface KeycloakModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  axiosProvider?: Provider;
  inject?: any[];
  useClass?: Type<KeycloakOptionsFactory>;
  useExisting?: Type<KeycloakOptionsFactory>;
  useFactory?: (...args: any[]) => Promise<KeycloakOptions> | KeycloakOptions;
}

export interface KeycloakOptions {
  authServerUrl: string;
  clientId: string;
  realm: string;
  secret: string;
}

export interface KeycloakOptionsFactory {
  createKeycloakOptions(): KeycloakOptions | Promise<KeycloakOptions>;
}
