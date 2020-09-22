import { GqlExecutionContext } from '@nestjs/graphql';
import { PrismaService } from 'nestjs-prisma-module';
import { Request } from 'express';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GraphqlCtx = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext<GraphqlCtxShape>();
  }
);

export interface GraphqlCtxShape {
  prisma: PrismaService;
  req: Request;
}
