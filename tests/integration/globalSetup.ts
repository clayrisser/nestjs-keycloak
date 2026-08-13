import { execFileSync } from 'node:child_process';
import type { TestProject } from 'vitest/node' with { 'resolution-mode': 'import' };
import { adminGet, adminRequest, getAdminToken } from './admin';
import { clientId, clientSecret, externalKeycloak, otherClientId, otherClientSecret, realm, users } from './config';

function compose(rootDir: string, ...args: string[]) {
  execFileSync('docker', ['compose', '-f', 'docker/compose.yaml', ...args], {
    cwd: rootDir,
    stdio: 'inherit',
  });
}

async function retry<T>(fn: () => Promise<T>, attempts: number, delayMs: number): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

async function provision() {
  const token = await retry(getAdminToken, 60, 2000);
  await adminRequest(token, 'POST', '/realms', { realm, enabled: true });
  await adminRequest(token, 'POST', `/realms/${realm}/clients`, {
    clientId,
    secret: clientSecret,
    enabled: true,
    publicClient: false,
    directAccessGrantsEnabled: true,
    standardFlowEnabled: true,
    redirectUris: ['*'],
    webOrigins: ['*'],
  });
  await adminRequest(token, 'POST', `/realms/${realm}/clients`, {
    clientId: otherClientId,
    secret: otherClientSecret,
    enabled: true,
    publicClient: false,
    directAccessGrantsEnabled: true,
    standardFlowEnabled: true,
    redirectUris: ['*'],
    webOrigins: ['*'],
  });
  await adminRequest(token, 'POST', `/realms/${realm}/roles`, { name: 'special' });
  await Promise.all(
    Object.values(users).map((user) =>
      adminRequest(token, 'POST', `/realms/${realm}/users`, {
        username: user.username,
        email: user.email,
        emailVerified: true,
        enabled: true,
        firstName: user.username,
        lastName: 'tester',
        credentials: [{ type: 'password', value: user.password, temporary: false }],
      }),
    ),
  );
  const [alice] = await adminGet<{ id: string }[]>(token, `/realms/${realm}/users?username=alice&exact=true`);
  const specialRole = await adminGet<{ id: string; name: string }>(token, `/realms/${realm}/roles/special`);
  await adminRequest(token, 'POST', `/realms/${realm}/users/${alice.id}/role-mappings/realm`, [specialRole]);
}

export default async function globalSetup(project: TestProject) {
  const rootDir = project.config.root;
  // ci supplies keycloak as a service container, so there is nothing to start
  if (externalKeycloak) {
    await provision();
    return async () => {};
  }
  compose(rootDir, 'up', '-d', '--wait', '--wait-timeout', '300', 'keycloak');
  await provision();
  return async () => {
    if (!process.env.KEEP_KEYCLOAK) {
      compose(rootDir, 'down', '--volumes', '--remove-orphans');
    }
  };
}
