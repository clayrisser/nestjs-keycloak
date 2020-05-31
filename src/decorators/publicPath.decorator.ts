import { SetMetadata } from '@nestjs/common';

export const PublicPath = (...scopes: string[]) => {
  return SetMetadata('public-path', scopes);
};
