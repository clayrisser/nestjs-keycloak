import { Module } from '@nestjs/common';
import { CountController } from './count.controller';
import { CountResolver } from './count.resolver';

@Module({
  controllers: [CountController],
  providers: [CountResolver]
})
export class CountModule {}
