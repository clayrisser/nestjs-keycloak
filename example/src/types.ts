import { PrismaService } from '~/modules/prisma';
import { Request } from 'express';

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
