import passport from 'passport';
import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';

@Module({})
export class PassportSessionModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(passport.initialize(), passport.session())
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
