import { SetMetadata } from '@nestjs/common';

export const PUBLIC = 'public';

export const Public = (...scopes: string[]) => {
  return SetMetadata(PUBLIC, scopes);
};
