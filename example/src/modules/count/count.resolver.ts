import { Resolver, Query, Ctx } from 'type-graphql';
// import { Roles } from 'nestjs-keycloak';
import { GraphqlCtx } from '~/types';

@Resolver()
export class CountResolver {
  //  @Roles('howdy')
  @Query((_returns: any) => Number, { nullable: true })
  count(@Ctx() ctx: GraphqlCtx): number {
    const { session } = ctx.req;
    if (typeof session === 'undefined') return 0;
    session.count = ++session.count || 0;
    return session.count;
  }
}
