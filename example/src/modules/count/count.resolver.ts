import { Resolver, Query } from '@nestjs/graphql';
import { Roles } from 'nestjs-keycloak';
import { GraphqlCtx, GraphqlCtxShape } from '../../decorators';

@Resolver()
export class CountResolver {
  @Roles('howdy')
  @Query((_returns) => Number)
  count(@GraphqlCtx() ctx: GraphqlCtxShape): number {
    let { session } = ctx.req;
    if (typeof session === 'undefined') return 0;
    session.count = ++session.count || 0;
    return session.count;
  }
}
