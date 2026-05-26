export type AuthUser = {
  id: string;
  organizationId: string;
  email: string;
  firstName: string;
  lastName: string;
  roleIds: string[];
  roleNames: string[];
  permissions: string[];
  branchIds: string[];
};
