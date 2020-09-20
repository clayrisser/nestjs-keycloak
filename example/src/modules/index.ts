import { PassportSessionModule, AuthModule } from './auth';
import { UserModule } from './user';

export default [UserModule, PassportSessionModule, AuthModule];
