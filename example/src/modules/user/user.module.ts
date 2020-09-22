import { Module } from '@nestjs/common';
import { PrismaModule } from 'nestjs-prisma';
import { UserController } from './user.controller';
import { UserCrudResolver } from '../../generated/type-graphql';
import { UserService } from './user.service';

@Module({
  imports: [PrismaModule],
  controllers: [UserController],
  providers: [UserService, UserCrudResolver]
})
export class UserModule {}
