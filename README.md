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
provision a realm, client and users, and exercise token validation, guards, role checks and
the automatic registration flow end to end. Set `KEEP_KEYCLOAK=1` to leave the container
running after the tests for poking around. The container can also be managed directly with
`make docker/up-d`, `make docker/logs` and `make docker/down`.

## Version Notes

- **keycloak-connect** is pinned to `26.1.1`, the final release line of the upstream
  [Node.js adapter](https://www.keycloak.org/securing-apps/nodejs-adapter), which Keycloak has
  deprecated. It still validates tokens issued by current Keycloak servers (tested against
  Keycloak 26.x). The grant management core of this library is built on it, so replacing it
  will be a separate breaking change.
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
