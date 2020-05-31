import { Grant } from 'keycloak-connect';
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
