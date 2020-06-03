import { Request } from 'express';
import { ExecutionContext } from '@nestjs/common';
import { KeycloakedRequest } from './types';

let nestjsGraphql: any;
try {
  nestjsGraphql = require('@nestjs/graphql');
} catch (err) {}

export default function getReq(
  context: ExecutionContext
): KeycloakedRequest<Request> {
  if ((context.getType() as string) === 'graphql' && nestjsGraphql) {
    const ctx = nestjsGraphql.GqlExecutionContext.create(context).getContext();
    if (ctx.req) return ctx.req;
  }
  return context.switchToHttp().getRequest();
}
