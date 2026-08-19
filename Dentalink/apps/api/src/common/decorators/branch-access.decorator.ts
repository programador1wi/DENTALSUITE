import { UseGuards, SetMetadata, applyDecorators } from '@nestjs/common';
import { BranchAccessGuard } from '../guards/branch-access.guard';

export const BRANCH_FIELD_KEY = 'branchField';

export const BranchField = (fieldName: string) => SetMetadata(BRANCH_FIELD_KEY, fieldName);

export function RequireBranchAccess() {
  return applyDecorators(UseGuards(BranchAccessGuard));
}
