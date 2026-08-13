// KEYCLOAK_URL points the suite at a keycloak that is already running, for
// example a gitlab ci service container. when it is unset the suite starts one
// with docker compose.
export const externalKeycloak = !!process.env.KEYCLOAK_URL;
export const baseUrl = process.env.KEYCLOAK_URL || `http://localhost:${process.env.KEYCLOAK_PORT || '18080'}`;
export const realm = 'nestjs-keycloak-test';
export const clientId = 'nestjs';
export const clientSecret = 'nestjs-integration-secret';
// a second confidential client in the same realm, used to prove that a token
// minted for someone else is not silently accepted as ours
export const otherClientId = 'other';
export const otherClientSecret = 'other-integration-secret';
export const adminUsername = process.env.KEYCLOAK_ADMIN_USERNAME || 'admin';
export const adminPassword = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin';

export const users = {
  alice: { username: 'alice', password: 'alice-password', email: 'alice@example.com' },
  bob: { username: 'bob', password: 'bob-password', email: 'bob@example.com' },
  // deliberately holds no role on the `nestjs` client, so keycloak's default
  // audience resolve mapper never adds `nestjs` to her tokens
  carol: { username: 'carol', password: 'carol-password', email: 'carol@example.com' },
};
