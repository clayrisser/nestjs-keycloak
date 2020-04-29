# Nest Keycloak Connect

An adapter for [keycloak-nodejs-connect](https://github.com/keycloak/keycloak-nodejs-connect).

## Features

- Protect your resources using [Keycloak's Authorization Services](https://www.keycloak.org/docs/latest/authorization_services/).
- Simply add `@Resource` and `@Scopes` in your controllers and you're good to go.
- Compatible with [Fastify](https://github.com/fastify/fastify) platform.

## Installation

### Yarn

```bash
yarn add nest-keycloak-connect
```

### NPM

```bash
npm install nest-keycloak-connect --save
```

## Getting Started

Register the module in app.module.ts

```typescript
import { Module } from '@nestjs/common';
import { KeycloakConnectModule, ResourceGuard, AuthGuard } from 'nest-keycloak-connect';

@Module({
  imports: [KeycloakConnectModule.register({
    authServerUrl: 'http://localhost:8080/auth',
    realm: 'master',
    clientId: 'my-nestjs-app',
    secret: 'secret',
  })],
  providers: [
    // These are in order, see https://docs.nestjs.com/guards#binding-guards
    // for more information

    // This adds a global level authentication guard, you can also have it scoped
    // if you like.
    //
    // Will return a 401 unauthorized when it is unable to
    // verify the JWT token or Bearer header is missing.
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    // This adds a global level resource guard, which is permissive.
    // Only controllers annotated with @Resource and methods with @Scopes
    // are handled by this guard.
    {
      provide: APP_GUARD,
      useClass: ResourceGuard,
    },
  ],
})
export class AppModule {}
```

Create Public Paths

```typescript
import { Resource, Scopes, KeycloakService, Roles, KeycloakedRequest } from '@cenkce/nest-keycloak-connect';
import { Controller, Get, Delete, Put, Post, Param } from '@nestjs/common';

@Controller()
@Resource(Product.name)
export class AppController {
  constructor(private service: keycloakService: KeycloakService) {}

  @PublicPath()
  @Get('login')
  @Render('login.hbs')
  login(@Res() resp: FastifyReply<any>, req: KeycloakedRequest<FastifyRequest>) {
    console.log('/login');
    if(req.grant){
      resp.status(302).redirect('/notifications/direct');
      return {}
    }

    return {};
  }

  @PublicPath()
  @Post('login')
  async auth(@Res() resp: FastifyReply<any>, @Body() body, @Session() session) {
    try {
      const res = await this.keycloakService.login(body.user, body.password);
    
      if(typeof res === 'string' && res.indexOf('access_token') !== -1){
        session.auth = true;
        session.token = res;
        resp.status(302).redirect('/notifications/direct');
      }
    } catch(e) {
      throw new HttpException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: e.message,
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @PublicPath()
  @Get('logout')
  logout(@Res() resp: FastifyReply<any>, @Res() req:FastifyRequest){
    req.session.sessionId && req.destroySession((e) => {
      throw new HttpException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: e.message,
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    });
    resp.status(302).redirect('/login');
  }
}
```

Authorization Using **@Roles()** and **@Scopes()**

- Usage of @Roles decorater
  - @Roles("role_name", /* or */, "role_name2")
  - @Roles(["role_name", /* and */, "role_name2"])
  - @Roles(["role_name", /* and */, "role_name2"], /* or */ "role_name3" )
  - @Roles(["role_name", /* and */, "role_name2"], /* or */ ["role_name3", /* and */, "role_name4"] )



```typescript
import { Resource, Scopes } from '@cenkce/nest-keycloak-connect';
import { Controller, Get, Delete, Put, Post, Param } from '@nestjs/common';
import { Product } from './product';
import { ProductService } from './product.service';

@Controller()
@Resource(Product.name)
export class ProductController {
  constructor(private service: ProductService) {}

  @Get()
  @Roles("realm:admin")
  @Scopes('View', 'View All')
  async findAll() {
    return await this.service.findAll();
  }

  @Get(':code')
  @Roles("realm:admin", "realm:user")
  @Scopes('View')
  async findByCode(@Param('code') code: string) {
    return await this.service.findByCode(code);
  }

  @Post()
  @Scopes('Create')
  async create(@Body product: Product) {
    return await this.service.create(product);
  }

  @Delete(':code')
  @Scopes('Delete')
  async deleteByCode(@Param('code') code: string) {
    return await this.service.deleteByCode(code);
  }

  @Put(':code')
  @Scopes('Edit')
  async update(@Param('code') code: string, @Body product: Product) {
    return await this.service.update(code, product);
  }
}
```
