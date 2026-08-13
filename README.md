# nestjs-keycloak

> nestjs module for authenticating keycloak

Please ★ this repo if you found it useful ★ ★ ★

What sets this apart from projects such as [nest-keycloak-connect](https://www.npmjs.com/package/nest-keycloak-connect) is
the several awesome enhancements as well as support for [TypeGraphQL](https://typegraphql.com) using [nestjs-keycloak-typegraphql](https://www.npmjs.com/package/nestjs-keycloak-typegraphql).
This makes it possible to use this with projects such as [typegraphql-nestjs](https://www.npmjs.com/package/typegraphql-nestjs)
and [typegraphql-prisma](https://www.npmjs.com/package/typegraphql-prisma).

There are several key decisions in the architecture that differ from [nest-keycloak-connect](https://www.npmjs.com/package/nest-keycloak-connect). The most obvious difference is that all
the controllers and resolvers are public by default, unless a decorator explicitly annotates a class or method. Another key difference is that
the `@Roles()` decorator is replaced with [`@Authorized()`](src/decorators/authorized.decorator.ts). It works basically the same way as the
TypeGraphQL [`@Authorized()`](https://typegraphql.com/docs/authorization.html) decorator.

There are also some enhancements such as the ability to use a union or intersection of roles.

Another key enhancement is the automatic registration of resources, roles and scopes with KeyCloak during the bootstrapping of the application.

## Requirements

| dependency | version           |
| ---------- | ----------------- |
| node       | `>=20`            |
| nestjs     | `^11.0.0`         |
| keycloak   | `26.x` (or newer) |

## Installation

```sh
pnpm add @risserlabs/nestjs-keycloak
```

## Usage

Here is a basic example of how to use this.

```ts
import KeycloakModule from '@risserlabs/nestjs-keycloak';
```

```ts
KeycloakModule.registerAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    return {
      adminClientId: config.get('KEYCLOAK_ADMIN_CLIENT_ID') || '',
      adminPassword: config.get('KEYCLOAK_ADMIN_PASSWORD') || '',
      adminUsername: config.get('KEYCLOAK_ADMIN_USERNAME') || '',
      appBaseUrl: config.get('APP_BASE_URL') || '',
      baseUrl: config.get('KEYCLOAK_BASE_URL') || '',
      clientId: config.get('KEYCLOAK_CLIENT_ID') || '',
      clientSecret: config.get('KEYCLOAK_CLIENT_SECRET') || '',
      realm: config.get('KEYCLOAK_REALM') || '',
      register: {
        resources: {},
        roles: [],
      },
    };
  },
});
```

### Configuration

| option                      | type                         | default     | description                                                                                                         |
| --------------------------- | ---------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------- |
| `baseUrl`                   | `string`                     | _required_  | base url of the keycloak server, for example `https://sso.example.com`                                              |
| `realm`                     | `string`                     | _required_  | realm name                                                                                                          |
| `clientId`                  | `string`                     | _required_  | client id of this application                                                                                       |
| `clientSecret`              | `string`                     | _required_  | client secret of this application. also signs the fallback oauth state cookie                                       |
| `appBaseUrl`                | `string`                     | _derived_   | externally reachable base url of **this** application. see [Deployment behind a proxy](#deployment-behind-a-proxy)  |
| `allowedRedirectOrigins`    | `string[]`                   | `[]`        | extra origins accepted as a post login destination, on top of this application's own origin                         |
| `requireAuthorizationState` | `boolean`                    | `true`      | reject an authorization callback whose `state` does not match the value bound to the browser that started the login |
| `authorizationStateTtl`     | `number`                     | `600000`    | lifetime of a pending oauth `state`, in milliseconds                                                                |
| `verifyTokenAudience`       | `boolean`                    | `false`     | require the `aud` claim of an access token to contain `clientId`. see [Token audience](#token-audience)             |
| `ensureFreshness`           | `boolean`                    | `true`      | refresh an expired access token from the refresh token before validating it                                         |
| `strict`                    | `boolean`                    | `false`     | when true, an `Authorization` header without a `Bearer ` prefix is ignored instead of being treated as a raw token  |
| `debug`                     | `boolean`                    | `false`     | log the readiness probes performed during registration                                                              |
| `adminUsername`             | `string`                     | —           | admin user, required for registration and for `getUser()`                                                           |
| `adminPassword`             | `string`                     | —           | admin password                                                                                                      |
| `adminClientId`             | `string`                     | `admin-cli` | client used for the admin login                                                                                     |
| `register`                  | `RegisterOptions \| boolean` | —           | automatic role, resource and scope registration                                                                     |

### Unions and Intersections

You can specify an intersection of roles by using an array. The following example
means a user must have the roles `one`, `two` and `three`.

```ts
@Authorized(['one', 'two', 'three'])
@Get('cats')
getCats() {
  return ['calico']
}
```

You can specify a union of roles as well. The following example
means a user must have at least the role `one`, `two` or `three`.

```ts
@Authorized('one', 'two', 'three')
@Get('cats')
getCats() {
  return ['calico']
}
```

You can use unions and intersections together. The following example
means a user must have at least the roles `one` and `two` or the role `three`.

```ts
@Authorized(['one', 'two'], 'three')
@Get('cats')
getCats() {
  return ['calico']
}
```

### Realm Roles

If you want to support a realm role, instead of a client role, simply prepend `realm:`
to the beginning of the role name. For example the following would only allow users
with the realm role `admin` to be able to access the respective resolver or controller.

```ts
@Authorized('realm:admin')
@Get('cats')
getCats() {
  return ['calico']
}
```

### Decorators

You can find all of the available decorators at [src/decorators](src/decorators).

### KeyCloak Registration

One of the really cool things about this project is the automatic registration of
roles, resources and scopes with keycloak. This will only work if you provide
the `adminUsername` and `adminPassword` configuration.

If you want to log the registration api calls to KeyCloak during the application bootstrap, you can setup
[nestjs-axios-logger](https://www.npmjs.com/package/nestjs-axios-logger).

### KeyCloak Service

The keycloak service provides a ton of awesome utility methods. Here are just a few
of them.

`await keycloakService.getAccessToken()` gets the access token and automatically renews it
with the refresh token if it finds it was expired.

`await keycloakService.getUser()` gets the keycloak user from the keycloak server. This will
include all the information about the user including their custom properties. This will only
work if the `adminUsername` and `adminPassword` settings are configured. If you are trying
to get information about the user that is contained in the token, it is better to directly
get the information from the token rather then using this method because it makes an api
call to the keycloak server.

`await keycloakService.getUserInfo()` gets the user info from the access token. It is better
to use this method instead of `getUser()` when trying to access information such as the username
or email, because it does not require `adminUsername` or `adminPassword` settings configured and because
it does not make an api call to the server.

You can find all of the available methods at [src/keycloak.service.ts](src/keycloak.service.ts).

## Security

### The authorization code flow and the `state` parameter

The `state` parameter is what binds an authorization callback to the browser that
started the login. Without it, anyone who can make a victim's browser open the
callback url with an authorization code of their choosing silently logs that
victim into the attacker's account.

This library generates `state` with a CSPRNG, stores it against the caller's
session, and verifies it on the callback with a constant time comparison. A
callback whose state is missing, unknown, expired or already used is rejected
with `403`. Verification happens **before** the authorization code is spent.

If you build the authorization request yourself instead of relying on
`@RedirectUnauthorized()` / `@Render()`, mint the state with the exported helper
so that the callback can verify it:

```ts
import { createAuthState } from '@risserlabs/nestjs-keycloak';

@Public()
@Get('login')
login(@Req() req: Request, @Res() res: Response) {
  const state = createAuthState(req, res, { secret: clientSecret });
  res.redirect(
    `${baseUrl}/realms/${realm}/protocol/openid-connect/auth?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${appBaseUrl}/auth/callback`,
      response_type: 'code',
      scope: 'openid',
      state,
    })}`,
  );
}
```

State is stored in `req.session` when [express-session](https://www.npmjs.com/package/express-session)
is installed, which makes it genuinely single use. **Install a session store.**
Without one the value falls back to an http-only, `SameSite=Lax`, HMAC signed
cookie, which still blocks forgery but cannot detect a replay of a captured
cookie beyond the TTL.

`requireAuthorizationState: false` (module wide) or
`@AuthorizationCallback({ requireState: false })` (per callback) turns the check
off. Both log a warning on every callback. Only reach for them if a legacy flow
issues authorization requests this library never saw, and treat it as temporary.

### Redirect safety

`destination_uri` on the authorization callback is validated before the browser
is sent anywhere. Same origin paths and absolute urls whose origin matches
`appBaseUrl` (or an entry in `allowedRedirectOrigins`) are allowed; everything
else — cross origin, protocol relative `//host`, backslash smuggling,
`javascript:`, `data:` — is refused, and the browser goes to the callback's
configured `destinationUri` instead.

### Deployment behind a proxy

`x-forwarded-host`, `x-forwarded-proto` and `x-forwarded-port` are only honoured
when express `trust proxy` is enabled, because an untrusted client can set them
freely and they feed the `redirect_uri` sent to keycloak. Either enable trust
proxy:

```ts
app.set('trust proxy', 1);
```

or, better, pin the value so no header can influence it at all:

```ts
KeycloakModule.register({ appBaseUrl: 'https://app.example.com', ... });
```

### Token audience

Access token signature, issuer, expiry and type are validated on every request
against the realm's JWKS. The audience is **not** checked by default, which means
an access token minted for a _different_ client in the _same_ realm is accepted
as if it were yours.

Turn it on with `verifyTokenAudience: true`. It requires an
[audience mapper](https://www.keycloak.org/docs/latest/server_admin/#_audience)
on your keycloak client that adds `clientId` to `aud`; without the mapper every
request fails with `401`. That prerequisite is why it cannot be the default.
Enable the mapper, then enable the option.

Be clear eyed about what it buys you. Keycloak's built in _audience resolve_
mapper already adds a client to `aud` whenever the token's user holds a role on
that client. So a token minted by a sibling client, for a user who has any role
on yours, will carry your client id in `aud` and pass this check. The option
closes the case of an unrelated user from an unrelated client; it is not a
tenancy boundary. If you need a hard "this token was issued to me" rule, compare
`azp` yourself:

```ts
const accessToken = await keycloakService.getAccessToken();
if (accessToken?.content?.azp !== clientId) throw new UnauthorizedException();
```

That is deliberately not built in, because presenting a front end client's token
to a back end resource server is a legitimate and common pattern that it breaks.

### Logout

`keycloakService.logout(redirectUri)` revokes the refresh token at keycloak over
the back channel, then clears the local grant and destroys the session, and only
then returns the front channel redirect. A caller that never follows the
redirect — an api client, a `fetch` based front end — still ends up with a dead
keycloak session.

### Known limitations

- `@Public()` only takes effect on a route handler. On a controller class it is
  ignored. Routes with no `@Authorized()` anywhere are already public, so making
  class level `@Public()` work could only ever loosen an explicit role
  requirement. Put it on the handler.
- Class level and handler level `@Authorized()` roles are merged as a **union**.
  `@Authorized('admin')` on the controller plus `@Authorized('user')` on the
  method grants access to anyone holding _either_ role. If you want the class
  level role to be mandatory, express it as an intersection on the handler:
  `@Authorized(['admin', 'user'])`.
- `keycloak-connect` stores its own grant cache in an in-memory
  `express-session` store. It is per process and does not survive a restart.

## Development

The toolchain is pinned with [asdf](https://asdf-vm.com) and driven by make.

```sh
make prepare          # one time system setup (asdf toolchain + pnpm install)
make build            # compile to lib/
make lint             # oxfmt --check + oxlint + tsc --noEmit
make format           # oxfmt
make test/unit        # vitest unit tests with coverage
make test/integration # vitest against a real keycloak container (requires docker)
make test             # unit + integration
```

The integration tests spin up a real [Keycloak](https://www.keycloak.org) container
(`quay.io/keycloak/keycloak` in `start-dev` mode, see [docker/compose.yaml](docker/compose.yaml)),
provision a realm, two clients and users, and exercise token validation, guards, role checks,
a full browser-driven authorization code login, oauth state verification, logout revocation and
the automatic registration flow end to end. Set `KEEP_KEYCLOAK=1` to leave the container
running after the tests for poking around. The container can also be managed directly with
`make docker/up-d`, `make docker/logs` and `make docker/down`.

Set `KEYCLOAK_URL` to point the suite at a keycloak that is already running, in which case it
skips docker compose entirely. That is how CI runs it, with keycloak supplied as a GitLab CI
service container — no docker-in-docker and no privileged runner required:

```sh
KEYCLOAK_URL=http://localhost:18080 pnpm test:integration
```

## Upgrading to 4.x

### Breaking changes

**1. The `KEYCLOAK_ADMIN` provider token value changed.**

The exported constant was always named `KEYCLOAK_ADMIN`, but its _value_ was the
string `'CREATE_KEYCLOAK'`, which collided conceptually with the separate
`CREATE_KEYCLOAK_ADMIN` provider. It is now `'KEYCLOAK_ADMIN'`.

```ts
// still fine, and the form you should be using
constructor(@Inject(KEYCLOAK_ADMIN) private readonly keycloakAdmin: KcAdminClient) {}

// BROKEN in 4.x — update the literal or import the constant
constructor(@Inject('CREATE_KEYCLOAK') private readonly keycloakAdmin: KcAdminClient) {}
```

If you inject by string literal anywhere, change `'CREATE_KEYCLOAK'` to
`'KEYCLOAK_ADMIN'`. Nest will fail at bootstrap with an unresolved dependency
rather than fail silently.

**2. Authorization callbacks now require a valid `state`.**

`@AuthorizationCallback()` rejects a callback with a missing, unknown, expired or
replayed `state` with `403`. If your application builds its own authorization
request, mint the state with `createAuthState()` (see [Security](#security)) so
the callback can verify it. `requireAuthorizationState: false` restores the old
behaviour and logs a warning; it is an escape hatch, not a setting.

**3. `destination_uri` is restricted to your own origin.**

Off origin post login destinations are refused. Add anything legitimate to
`allowedRedirectOrigins`.

**4. `x-forwarded-*` headers are ignored unless `trust proxy` is set.**

If your callback urls suddenly point at an internal hostname, set
`appBaseUrl` or enable express `trust proxy`.

**5. Auth redirects are now `302` instead of `301`.**

A permanent redirect on a login or callback url gets cached by the browser. The
`@RedirectUnauthorized(url, status)` default is unchanged.

### Fixes worth knowing about

- `logout()` now revokes the refresh token server side, and its
  `post_logout_redirect_uri` actually survives (`keycloak-connect`'s `logoutUrl`
  silently dropped it unless an `id_token_hint` was supplied).
- The authorization callback strips the `iss` parameter that keycloak 18+ adds
  (RFC 9207) before rebuilding `redirect_uri`, which previously caused
  `invalid_grant: Incorrect redirect_uri` on the code exchange.
- The callback endpoint path is now joined correctly for a bare `@Controller()`,
  which previously produced `///path`.
- Errors from the token endpoint are sanitized before they are logged or
  rethrown. An axios error carries the request body, and therefore the client
  secret, the user's password, the refresh token or the authorization code.

## Version Notes

### keycloak-connect is deprecated

**keycloak-connect** is pinned to `26.1.1`, the final release of the upstream
[Node.js adapter](https://www.keycloak.org/securing-apps/nodejs-adapter). Keycloak
has deprecated it and recommends a generic OpenID Connect client instead.

Current risk assessment, so you can make your own call:

- **Token validation is sound.** Signatures are verified with `RSA-SHA256`
  against the realm JWKS keyed by `kid`, and the `alg` header is never trusted to
  select the algorithm. `alg: none` and an RS256→HS256 downgrade both fail
  closed. `iss`, `exp` and token `typ` are checked.
- **Audience is opt in.** See [Token audience](#token-audience). This is the one
  validation gap that matters day to day.
- **No clock skew tolerance.** `exp` is compared against local time exactly. Keep
  your clocks in sync.
- **It is unmaintained.** No CVE affects `26.1.1` today, but nothing will be
  fixed upstream if one lands. That, not a known defect, is the reason to move.

Migration path, roughly in the order it should happen:

1. Replace grant creation and validation in `KeycloakService` with
   [openid-client](https://www.npmjs.com/package/openid-client) (discovery,
   authorization code with PKCE, refresh, revocation, back channel logout) plus
   [jose](https://www.npmjs.com/package/jose) for local JWKS verification with
   audience, issuer and clock tolerance enforced by default.
2. Replace `keycloak.enforcer()` — used by `@Resource()` / `@Scopes()` — with a
   direct UMA ticket exchange against the token endpoint
   (`grant_type=urn:ietf:params:oauth:grant-type:uma-ticket`). This is the only
   piece with no drop-in replacement.
3. Drop the `express-session` `MemoryStore` that `keycloak-connect` requires.
4. Keep `@keycloak/keycloak-admin-client` as is. It is separately maintained and
   is not part of the deprecated adapter.

Steps 1 and 2 change observable behaviour, so they belong in a `5.0.0`, not here.
The integration suite in [tests/integration](tests/integration) exercises the
flows end to end against a real keycloak and is the safety net for that work.

### Other notes

- **@keycloak/keycloak-admin-client** `26.x` is esm-only, so it is loaded lazily with a dynamic
  `import()`. This package itself remains commonjs and can be consumed from both commonjs and esm.
- The typegraphql specific parameter decorator implementation moved out of this package. The
  inject decorators (`@InjectAccessToken()`, `@InjectRoles()`, ...) are now standard
  [nestjs param decorators](https://docs.nestjs.com/custom-decorators) that also resolve the
  request from a graphql execution context when [@nestjs/graphql](https://www.npmjs.com/package/@nestjs/graphql)
  (an optional peer dependency) is installed.

## Support

Submit an [issue](https://gitlab.com/bitspur/nestjs-keycloak/issues/new)

## License

[Apache-2.0 License](LICENSE)

[Clay Risser](https://clayrisser.com) © 2021

## Credits

- [Clay Risser](https://clayrisser.com) - Author
