import { SetMetadata } from '@nestjs/common';

export const RESOURCE = 'resource';

export const Resource = (resource: string) => SetMetadata(RESOURCE, resource);
