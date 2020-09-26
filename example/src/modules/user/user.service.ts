import { Injectable } from '@nestjs/common';
import { PrismaCrudService } from 'nestjs-crud-prisma';
import { PrismaService } from '../prisma';
import { User } from '../../generated/typegraphql';

@Injectable()
export class UserService extends PrismaCrudService<User> {
  constructor(prisma: PrismaService) {
    super(prisma, User);
  }
}
