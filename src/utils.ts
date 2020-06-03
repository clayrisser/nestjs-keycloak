import { ExecutionContext } from '@nestjs/common';
import { IncomingHttpHeaders } from 'http';
import { Request } from 'express';
import { KeycloakedRequest } from './types';

let nestjsGraphql: any;
try {
  nestjsGraphql = require('@nestjs/graphql');
} catch (err) {}

export function getReq(context: ExecutionContext): KeycloakedRequest<Request> {
  if ((context.getType() as string) === 'graphql' && nestjsGraphql) {
    const ctx = nestjsGraphql.GqlExecutionContext.create(context).getContext();
    if (ctx.req) return ctx.req;
  }
  return context.switchToHttp().getRequest();
}

export function extractJwt(headers: IncomingHttpHeaders) {
  const { authorization } = headers;
  if (typeof authorization === 'undefined') return null;
  if (authorization?.indexOf(' ') <= -1) return authorization;
  const auth = authorization?.split(' ');
  if (auth && auth[0] && auth[0].toLowerCase() === 'bearer') return auth[1];
  return null;
}
