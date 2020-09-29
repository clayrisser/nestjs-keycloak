import { Module } from '@nestjs/common';
import { PrismaModule } from '~/modules/prisma';
import { UserController } from './user.controller';
import { UserResolver } from './user.resolver';
import { UserService } from './user.service';

@Module({
  imports: [PrismaModule],
  controllers: [UserController],
  providers: [UserService, UserResolver]
})
export class UserModule {}
