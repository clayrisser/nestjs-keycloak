import { SetMetadata } from '@nestjs/common';

export const Public = (...scopes: string[]) => {
  return SetMetadata('public', scopes);
};
