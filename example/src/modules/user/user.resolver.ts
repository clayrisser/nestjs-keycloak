import { Resolver } from 'type-graphql';
import { UserCrudResolver, User } from '../../generated/type-graphql';

@Resolver((_of: any) => User)
export class UserResolver extends UserCrudResolver {}
