import { GrantType } from "keycloak-connect";

export type KeycloakedRequest<T = Request> = {
  user: {
    sub: string,
    email_verified: boolean,
    preferred_username: string
  },
  grant: GrantType | undefined,
  session: {[key: string]: any},
} & T;
