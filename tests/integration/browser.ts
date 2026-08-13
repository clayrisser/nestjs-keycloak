/**
 * A very small stand-in for a browser: a cookie jar plus the keycloak login
 * form dance, so the integration suite can drive a real authorization code
 * flow end to end.
 */
export class CookieJar {
  private cookies = new Map<string, string>();

  get header(): string {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  absorb(res: Response) {
    for (const raw of res.headers.getSetCookie()) {
      const [pair] = raw.split(';');
      const separator = pair.indexOf('=');
      if (separator < 0) continue;
      const name = pair.slice(0, separator).trim();
      const value = pair.slice(separator + 1).trim();
      if (!value) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  get(name: string) {
    return this.cookies.get(name);
  }

  set(name: string, value: string) {
    this.cookies.set(name, value);
  }

  async fetch(url: string, init: RequestInit = {}): Promise<Response> {
    const res = await fetch(url, {
      redirect: 'manual',
      ...init,
      headers: { ...init.headers, ...(this.header ? { cookie: this.header } : {}) },
    });
    this.absorb(res);
    return res;
  }
}

/**
 * Walks the keycloak login page and submits credentials, returning the raw
 * redirect that keycloak sends back to the application's callback url.
 */
export async function login(
  jar: CookieJar,
  authorizationUrl: string,
  username: string,
  password: string,
): Promise<URL> {
  const page = await jar.fetch(authorizationUrl);
  if (page.status !== 200) {
    throw new Error(`expected the keycloak login page, got ${page.status}`);
  }
  const html = await page.text();
  const action = html.match(/action="([^"]+)"/)?.[1];
  if (!action) throw new Error('could not find the keycloak login form');
  const formUrl = action.replace(/&amp;/g, '&');
  const submitted = await jar.fetch(formUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password, credentialId: '' }).toString(),
  });
  const location = submitted.headers.get('location');
  if (!location) {
    throw new Error(`keycloak did not redirect after login (status ${submitted.status})`);
  }
  return new URL(location);
}
