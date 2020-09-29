import { Controller } from '@nestjs/common';
import { Crud } from '@nestjsx/crud';
import { User } from '~/generated/typegraphql';
import { UserService } from './user.service';

@Crud({
  model: {
    type: User
  },
  params: {
    id: {
      field: 'id',
      type: 'string',
      primary: true
    }
  }
})
@Controller('users')
export class UserController {
  constructor(public service: UserService) {}
}
