import { GqlExecutionContext } from '@nestjs/graphql';
import { Request } from 'express';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GraphqlCtx = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext<GraphqlCtxShape>();
  }
);

export interface GraphqlCtxShape {
  req: Request;
}
