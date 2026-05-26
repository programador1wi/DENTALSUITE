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

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterOrganizationPayload = {
  organizationName: string;
  legalName?: string;
  taxId?: string;
  organizationPhone?: string;
  organizationEmail?: string;
  organizationAddress?: string;
  branchName: string;
  branchPhone?: string;
  branchEmail?: string;
  branchAddress?: string;
  branchCity?: string;
  branchState?: string;
  branchCountry?: string;
  branchTimezone?: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPhone?: string;
  adminPassword: string;
};

export type AuthResponse = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};
