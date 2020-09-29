import { Controller, Get, Session, Render, Req } from '@nestjs/common';
import { Public, Resource /* , Roles */ } from 'nestjs-keycloak';
import { Request } from 'express';
import { SessionData } from '~/types';

@Controller()
@Resource('app')
export class CountController {
  constructor() {}

  @Get()
  @Public()
  @Render('index')
  getRoot() {
    return { message: 'Hello, world!' };
  }

  // @Roles('howdy')
  @Get('/count')
  getCount(@Req() _req: Request, @Session() session: SessionData): number {
    session.count = ++session.count || 0;
    return session.count;
  }
}
