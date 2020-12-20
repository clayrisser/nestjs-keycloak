import { Controller, Get, Session, Render, Req } from '@nestjs/common';
import { Public, Resource, Roles, Scopes } from 'nestjs-keycloak';
import { Request } from 'express';
import { SessionData } from '~/types';

@Resource('app')
@Controller()
export class CountController {
  constructor() {}

  @Get()
  @Public()
  @Scopes('hello', 'world', 'yip', 'yap')
  @Render('index')
  getRoot() {
    return { message: 'Hello, world!' };
  }

  @Get('/count')
  getCount(@Req() _req: Request, @Session() session: SessionData): number {
    session.count = ++session.count || 0;
    return session.count;
  }
}
