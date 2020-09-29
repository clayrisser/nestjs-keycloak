import { Request } from 'express';
import { PrismaService } from '~/modules/prisma';

export enum Adapter {
  Express = 'express',
  Fastify = 'fastify'
}

export interface SessionData {
  count: number;
}

export interface GraphqlCtx {
  prisma: PrismaService;
  req: Request;
}
