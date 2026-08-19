import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BRANCH_FIELD_KEY } from '../decorators/branch-access.decorator';
import { AuthUser } from '../types/auth-user';

@Injectable()
export class BranchAccessGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: AuthUser = request.user;

    if (!user) {
      return false;
    }

    if (user.permissions?.includes('system.manage_all')) {
      return true;
    }

    const fieldName = this.reflector.getAllAndOverride<string>(BRANCH_FIELD_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) || 'branchId';

    const branchId = 
      request.params[fieldName] || 
      request.query[fieldName] || 
      request.body?.[fieldName];

    if (branchId) {
      if (!user.branchIds?.includes(branchId)) {
        throw new ForbiddenException('BRANCH_ACCESS_DENIED');
      }
    }

    return true;
  }
}
