import { Module } from '@nestjs/common';
import controllers from './controllers';
import services, { AuthService } from './services';

@Module({
  controllers,
  exports: [AuthService],
  providers: [...services]
})
export class AuthModule {}
