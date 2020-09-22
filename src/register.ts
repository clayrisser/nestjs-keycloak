import { HttpService } from '@nestjs/common';
import { KeycloakOptions } from './types';

export default class Register {
  constructor(
    private readonly options: KeycloakOptions,
    private httpService: HttpService
  ) {}

  async setup() {
    // REGISTER HERE
    console.log(this.options, this.httpService);
  }
}
