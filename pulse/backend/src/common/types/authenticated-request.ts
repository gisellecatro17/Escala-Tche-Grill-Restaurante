import { Request } from 'express';

import { RoleSlug } from '../../modules/roles/role-slug.enum';

export interface RequestMembership {
  companyId: string;
  companyName: string;
  organizationId: string;
  organizationName: string;
  role: {
    id: string;
    name: string;
    slug: RoleSlug;
  };
  permissions: string[];
}

/** Vínculo direto do usuário com uma organização (independe de a organização já ter empresas). */
export interface RequestOrganizationMembership {
  organizationId: string;
  organizationName: string;
  role: {
    id: string;
    name: string;
    slug: RoleSlug;
  };
  permissions: string[];
}

export interface RequestUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  /** Acesso por empresa (inclui o acesso derivado de perfis de organização). */
  memberships: RequestMembership[];
  /** Acesso direto por organização — usado para autorizar ações antes de uma empresa existir (ex.: criar a primeira empresa de uma organização nova). */
  organizationMemberships: RequestOrganizationMembership[];
  /** true quando o usuário possui o perfil de sistema "Administrador da plataforma". */
  isPlatformAdmin: boolean;
}

export interface AuthenticatedRequest extends Request {
  user: RequestUser;
  /** Empresa resolvida a partir do header X-Company-Id, já validada contra os vínculos do usuário. */
  membership?: RequestMembership;
}
