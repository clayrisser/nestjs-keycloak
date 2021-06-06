type Grant = import('keycloak-connect').Grant;
type Request = import('express').Request;

export interface HashMap<T = any> {
  [key: string]: T;
}

export interface Options {
  adminClientId?: string;
  adminPassword?: string;
  adminUsername?: string;
  baseUrl: string;
  clientId: string;
  clientSecret?: string;
  realm: string;
  register?: boolean;
}

export interface UserInfo {
  emailVerified: boolean;
  preferredUsername: string;
  sub: string;
  [key: string]: any;
}

export type KeycloakRequest<T = Request> = {
  kauth?: Kauth;
  session?: {
    refreshToken?: string;
    token?: string;
    userInfo?: UserInfo;
    [key: string]: any;
  };
} & T;

export interface Kauth {
  grant?: Grant;
  userInfo?: UserInfo;
}
