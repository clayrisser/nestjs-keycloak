import { MiddlewareFn } from 'type-graphql';

export const TypeGraphqlAuthGuard: MiddlewareFn = async ({ args }, next) => {
  console.log('auth guard', args);
  return next();
};
