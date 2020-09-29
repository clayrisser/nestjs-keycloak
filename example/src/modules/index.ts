import { CountModule } from './count';
import { PassportSessionModule, AuthModule } from './auth';
import { PrismaModule } from './prisma';
import { UserModule } from './user';

export default [
  AuthModule,
  CountModule,
  PassportSessionModule,
  PrismaModule,
  UserModule
];
