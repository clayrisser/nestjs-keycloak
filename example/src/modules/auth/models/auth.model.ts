import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Auth {
  @Field({ description: 'access token' })
  accessToken?: string;

  @Field({ description: 'expires in' })
  expiresIn?: number;

  @Field({ description: 'message' })
  message?: string;

  @Field({ description: 'refresh expires in' })
  refreshExpiresIn?: number;

  @Field({ description: 'refresh token' })
  refreshToken?: string;

  @Field({ description: 'scope' })
  scope?: string;

  @Field({ description: 'token type' })
  tokenType?: string;
}
