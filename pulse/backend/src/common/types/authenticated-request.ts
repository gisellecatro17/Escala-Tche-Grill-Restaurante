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

export interface RequestUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  memberships: RequestMembership[];
  /** true quando o usuário possui o perfil de sistema "Administrador da plataforma". */
  isPlatformAdmin: boolean;
}

export interface AuthenticatedRequest extends Request {
  user: RequestUser;
  /** Empresa resolvida a partir do header X-Company-Id, já validada contra os vínculos do usuário. */
  membership?: RequestMembership;
}
