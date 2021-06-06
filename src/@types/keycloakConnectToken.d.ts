declare module 'keycloak-connect/middleware/auth-utils/token' {
  class Token {
    constructor(accessToken: string, clientId: string);
    token: string;
    isExpired(): boolean;
    hasRole(roleName: string): boolean;
    hasApplicationRole(appName: string, roleName: string): boolean;
    hasRealmRole(roleName: string): boolean;
  }
  export = Token;
}
