import { Grant } from 'keycloak-connect';
import { Request } from 'express';

export type KeycloakedRequest<T = Request> = {
  user: {
    email_verified: boolean;
    preferred_username: string;
    sub: string;
  };
  grant: Grant | undefined;
  session: { [key: string]: any };
} & T;
