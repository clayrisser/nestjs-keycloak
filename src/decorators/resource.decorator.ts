import { SetMetadata } from '@nestjs/common';

export const Resource = (resource: string) => SetMetadata('resource', resource);
