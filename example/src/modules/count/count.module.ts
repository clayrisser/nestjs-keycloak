import { Module } from '@nestjs/common';
import controllers from './controllers';
import resolvers from './resolvers';

@Module({
  controllers,
  providers: [...resolvers]
})
export class CountModule {}
