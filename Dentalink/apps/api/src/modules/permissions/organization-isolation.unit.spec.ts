import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthController } from '../auth/auth.controller';
import { UsersService } from '../users/users.service';
import { OrthodonticsService } from '../orthodontics/orthodontics.service';

const actor = { id: 'local-user', organizationId: 'org-a', branchIds: ['branch-a'], permissions: ['organization.manage_all'] };

describe('organization isolation regressions', () => {
  it('never removes the organization filter for an administrator', () => {
    const service = new UsersService({} as never, {} as never);
    const scope = (service as unknown as { organizationScope: (value: unknown) => unknown }).organizationScope;
    expect(scope({ ...actor, permissions: ['organization.manage_all'] })).toEqual({ organizationId: 'org-a' });
    expect(scope(actor)).toEqual({ organizationId: 'org-a' });
  });

  it('does not recognize legacy global privilege as an authorization bypass', () => {
    const reflector = { getAllAndOverride: (key: string) => key === 'permissions' ? ['patients.read'] : 'all' };
    const guard = new PermissionsGuard(reflector as never);
    const context = {
      getHandler: () => function handler() {}, getClass: () => class Controller {},
      switchToHttp: () => ({ getRequest: () => ({ method: 'GET', user: { ...actor, permissions: ['system.manage_all'] } }) })
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('closes public organization provisioning before invoking any write', async () => {
    const create = jest.fn().mockResolvedValue({ refreshToken: 'token' });
    const controller = new AuthController({ registerOrganization: create } as never, { get: () => 'test' } as never);
    await expect(controller.registerOrganization({} as never, { headers: {} } as never, { cookie: jest.fn() } as never))
      .rejects.toMatchObject({ response: { code: 'ORGANIZATION_REGISTRATION_DISABLED' } });
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a foreign orthodontic treatment before reading clinical progress', async () => {
    const progress = { recalculateTreatmentProgress: jest.fn().mockResolvedValue({ patientMobile: 'private' }) };
    const prisma = { treatmentPlan: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new OrthodonticsService(prisma as never, progress as never, {} as never);
    await expect(service.recalculateProgress(actor as never, 'foreign-plan')).rejects.toBeInstanceOf(NotFoundException);
    expect(progress.recalculateTreatmentProgress).not.toHaveBeenCalled();
  });
});
