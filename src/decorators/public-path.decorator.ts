import { SetMetadata } from '@nestjs/common';

/**
 * Keycloak Authorization Scopes.
 * @param scopes - scopes that are associated with the resource
 */
export const PublicPath = (...scopes: string[]) => SetMetadata('public-path', scopes);
