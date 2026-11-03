import { SetMetadata } from '@nestjs/common';

export const AUDITABLE_KEY = 'auditable';

export interface AuditableOptions {
  entity: string;
  action: string;
}

export const Auditable = (options: AuditableOptions) => SetMetadata(AUDITABLE_KEY, options);
