import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import Auth from '~/auth';

@Injectable()
export default class KeycloakMiddleware implements NestMiddleware {
  constructor(private auth: Auth) {}

  async use(_req: Request, _res: Response, next: NextFunction) {
    try {
      await this.auth.init();
      return next();
    } catch (err) {
      return next(err);
    }
  }
}
