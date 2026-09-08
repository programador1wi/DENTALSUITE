export type AuthUserOrganization = {
  id: string;
  name: string;
  legalName?: string | null;
  taxId?: string | null;
  logoUrl?: string | null;
  slug?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

export type AuthUserBranch = {
  id: string;
  name: string;
  code?: string | null;
  isPrimary?: boolean;
};

export type AuthUser = {
  id: string;
  organizationId: string;
  organizationName?: string;
  organization?: AuthUserOrganization;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  roleIds: string[];
  roleNames: string[];
  permissions: string[];
  branchIds: string[];
  branches?: AuthUserBranch[];
  authorizationVersion?: number;
  branchScopeVersion?: number;
  sessionId?: string;
  status?: string;
  lastLoginAt?: Date | string | null;
  createdAt?: Date | string | null;
};
