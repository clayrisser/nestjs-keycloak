import { Resolver } from 'type-graphql';
import { UserCrudResolver, User } from '~/generated/typegraphql';

@Resolver((_of: any) => User)
export class UserResolver extends UserCrudResolver {}
