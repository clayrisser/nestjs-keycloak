import Token from 'keycloak-connect/middleware/auth-utils/token';
import type { ExecutionContext } from '@nestjs/common';

export const clientId = 'test-client';

export function makeJwt(payload: Record<string, any> = {}): string {
  const encode = (value: any) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = { alg: 'RS256', typ: 'JWT', kid: 'test' };
  return `${encode(header)}.${encode(payload)}.${Buffer.from('signature').toString('base64url')}`;
}

export function makeToken(payload: Record<string, any> = {}): Token {
  return new Token(makeJwt(payload), clientId);
}

export interface MockContextOptions {
  handlerMetadata?: Record<string, any>;
  classMetadata?: Record<string, any>;
  req?: any;
  res?: any;
  type?: string;
  graphqlContext?: any;
}

export function makeContext({
  handlerMetadata = {},
  classMetadata = {},
  req = {},
  res = {},
  type = 'http',
  graphqlContext,
}: MockContextOptions = {}): ExecutionContext {
  const handler = function handler() {};
  class TestClass {}
  Object.entries(handlerMetadata).forEach(([key, value]) => Reflect.defineMetadata(key, value, handler));
  Object.entries(classMetadata).forEach(([key, value]) => Reflect.defineMetadata(key, value, TestClass));
  return {
    getHandler: () => handler,
    getClass: () => TestClass,
    getType: () => type,
    // graphql resolver args: [root, args, context, info]
    getArgs: () => [undefined, {}, graphqlContext || {}, {}],
    getArgByIndex: (index: number) => [undefined, {}, graphqlContext || {}, {}][index],
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
      getNext: () => undefined,
    }),
  } as unknown as ExecutionContext;
}
