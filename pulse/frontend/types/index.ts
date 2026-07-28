export type Status = "active" | "inactive" | "blocked";

export interface Organization {
  id: string;
  name: string;
  status: Status;
}

export interface Company {
  id: string;
  organizationId: string;
  name: string;
  tradeName: string | null;
  document: string;
  status: Status;
}

export interface Role {
  id: string;
  name: string;
  slug: RoleSlug;
  description: string | null;
  isSystem: boolean;
}

export type RoleSlug =
  | "platform_admin"
  | "organization_admin"
  | "company_admin"
  | "financial"
  | "financial_operator"
  | "approver"
  | "manager"
  | "accountant";

export interface Permission {
  id: string;
  slug: string;
  module: string;
  description: string | null;
}

export interface UserCompanyMembership {
  companyId: string;
  companyName: string;
  organizationId: string;
  organizationName: string;
  role: Role;
  permissions: string[];
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  memberships: UserCompanyMembership[];
}

/** Envelope padrão de resposta da API (ver seção 19 do prompt mestre). */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  message: string;
}

export interface ApiError {
  success: false;
  message: string;
  errors: string[];
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
