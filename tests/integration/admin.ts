import { adminPassword, adminUsername, baseUrl, clientId, clientSecret, realm } from './config';

export async function getAdminToken(): Promise<string> {
  const res = await fetch(`${baseUrl}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: adminUsername,
      password: adminPassword,
    }),
  });
  if (!res.ok) {
    throw new Error(`failed to get admin token: ${res.status} ${await res.text()}`);
  }
  return ((await res.json()) as { access_token: string }).access_token;
}

export async function adminRequest(token: string, method: string, path: string, body?: unknown): Promise<Response> {
  const res = await fetch(`${baseUrl}/admin${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  // 409 conflict means the resource already exists, which keeps setup idempotent
  if (!res.ok && res.status !== 409) {
    throw new Error(`${method} ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res;
}

export async function adminGet<T>(token: string, path: string): Promise<T> {
  const res = await adminRequest(token, 'GET', path);
  return (await res.json()) as T;
}

export async function passwordGrant(username: string, password: string): Promise<string> {
  const res = await fetch(`${baseUrl}/realms/${realm}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'openid profile email',
      username,
      password,
    }),
  });
  if (!res.ok) {
    throw new Error(`password grant for ${username} failed: ${res.status} ${await res.text()}`);
  }
  return ((await res.json()) as { access_token: string }).access_token;
}
