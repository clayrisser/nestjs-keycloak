export const baseUrl = `http://localhost:${process.env.KEYCLOAK_PORT || '18080'}`;
export const realm = 'nestjs-keycloak-test';
export const clientId = 'nestjs';
export const clientSecret = 'nestjs-integration-secret';
export const adminUsername = process.env.KEYCLOAK_ADMIN_USERNAME || 'admin';
export const adminPassword = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin';

export const users = {
  alice: { username: 'alice', password: 'alice-password', email: 'alice@example.com' },
  bob: { username: 'bob', password: 'bob-password', email: 'bob@example.com' },
};
