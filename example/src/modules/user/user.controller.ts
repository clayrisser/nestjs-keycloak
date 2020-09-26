import { Controller } from '@nestjs/common';
import { Crud } from '@nestjsx/crud';
import { UserService } from './user.service';
import { User } from '../../generated/typegraphql';

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
