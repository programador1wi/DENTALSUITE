import { Prisma } from "@prisma/client";
import { AuthUser, AuthUserBranch } from "../../common/types/auth-user";
import { safeLogoForPresentation } from "../../common/utils/logo-reference.util";

export const authUserInclude = {
  organization: {
    select: {
      id: true,
      name: true,
      legalName: true,
      taxId: true,
      logoUrl: true,
      slug: true,
      phone: true,
      email: true,
      address: true,
      isActive: true,
      status: true,
      branchScopeVersion: true,
      branches: {
        where: { isActive: true, status: "ACTIVE", deletedAt: null },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" }
      }
    }
  },
  role: { include: { permissions: { include: { permission: true } } } },
  roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
  permissions: { include: { permission: true } },
  branches: {
    where: { branch: { isActive: true, status: "ACTIVE", deletedAt: null } },
    include: { branch: { select: { id: true, name: true, code: true } } }
  }
} satisfies Prisma.UserInclude;

export type AuthUserRecord = Prisma.UserGetPayload<{ include: typeof authUserInclude }>;

export function isActiveAuthUser(user: AuthUserRecord | null | undefined): user is AuthUserRecord {
  return Boolean(
    user &&
    user.isActive &&
    user.status === "ACTIVE" &&
    !user.deletedAt &&
    user.organization.isActive &&
    user.organization.status === "ACTIVE"
  );
}

export function serializeAuthUser(user: AuthUserRecord, sessionId?: string): AuthUser {
  const activePrimaryRole = user.role?.isActive && !user.role.deletedAt ? user.role : null;
  const activeAdditionalRoles = user.roles
    .map((entry) => entry.role)
    .filter((role) => role.isActive && !role.deletedAt);
  const roles = [...new Map(
    [...(activePrimaryRole ? [activePrimaryRole] : []), ...activeAdditionalRoles].map((role) => [role.id, role])
  ).values()];

  const permissions = new Set<string>();
  const permissionEntries = [
    ...user.permissions,
    ...roles.flatMap((role) => role.permissions)
  ];
  for (const entry of permissionEntries) {
    if (entry.permission.isActive && !entry.permission.deletedAt) {
      const key = entry.permission.key ?? entry.permission.code;
      if (key) permissions.add(key);
    }
  }

  const assignedPrimary = new Map(user.branches.map((entry) => [entry.branchId, entry.isPrimary]));
  const branches: AuthUserBranch[] = permissions.has("organization.manage_all")
    ? user.organization.branches.map((branch) => ({
        id: branch.id,
        name: branch.name,
        code: branch.code,
        isPrimary: assignedPrimary.get(branch.id) ?? false
      }))
    : user.branches.map((entry) => ({
        id: entry.branch.id,
        name: entry.branch.name,
        code: entry.branch.code,
        isPrimary: entry.isPrimary
      }));

  return {
    id: user.id,
    organizationId: user.organizationId,
    organizationName: user.organization.name,
    organization: {
      id: user.organization.id,
      name: user.organization.name,
      legalName: user.organization.legalName,
      taxId: user.organization.taxId,
      logoUrl: safeLogoForPresentation(user.organization.logoUrl),
      slug: user.organization.slug,
      phone: user.organization.phone,
      email: user.organization.email,
      address: user.organization.address
    },
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    roleIds: roles.map((role) => role.id),
    roleNames: roles.map((role) => role.name),
    permissions: [...permissions],
    branchIds: branches.map((branch) => branch.id),
    branches,
    authorizationVersion: user.authorizationVersion,
    branchScopeVersion: user.organization.branchScopeVersion,
    sessionId,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt
  };
}
