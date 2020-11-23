import { SetMetadata } from '@nestjs/common';

export const SCOPES = 'scopes';

export const Scopes = (...scopes: string[]) => SetMetadata(SCOPES, scopes);
