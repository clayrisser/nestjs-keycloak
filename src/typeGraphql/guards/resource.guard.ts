import { MiddlewareFn } from 'type-graphql';

export const TypeGraphqlResourceGuard: MiddlewareFn = async (
  { args },
  next
) => {
  console.log('resource guard', args);
  return next();
};
