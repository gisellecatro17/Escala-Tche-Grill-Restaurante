import { Injectable, UnauthorizedException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseAdminService } from '../../supabase/supabase-admin.service';
import type {
  RequestMembership,
  RequestOrganizationMembership,
  RequestUser,
} from '../../common/types/authenticated-request';
import { RoleSlug } from '../roles/role-slug.enum';

interface SupabaseIdentity {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseAdmin: SupabaseAdminService,
  ) {}

  /** Valida o access token do Supabase e retorna a identidade autenticada. */
  async verifyAccessToken(accessToken: string): Promise<SupabaseIdentity> {
    const { data, error } =
      await this.supabaseAdmin.client.auth.getUser(accessToken);

    if (error || !data.user) {
      throw new UnauthorizedException(
        'Sessão inválida ou expirada. Faça login novamente.',
      );
    }

    const metadata = data.user.user_metadata as Record<string, unknown>;

    return {
      id: data.user.id,
      email: data.user.email ?? '',
      name:
        typeof metadata?.full_name === 'string'
          ? metadata.full_name
          : undefined,
      avatarUrl:
        typeof metadata?.avatar_url === 'string'
          ? metadata.avatar_url
          : undefined,
    };
  }

  /**
   * Garante que exista um perfil (tabela `users`) para o usuário autenticado no Supabase
   * e retorna o usuário com todos os seus vínculos (organizações/empresas) e permissões.
   */
  async loadRequestUser(identity: SupabaseIdentity): Promise<RequestUser> {
    const user = await this.prisma.user.upsert({
      where: { id: identity.id },
      update: {
        email: identity.email,
        ...(identity.name ? { name: identity.name } : {}),
        ...(identity.avatarUrl ? { avatarUrl: identity.avatarUrl } : {}),
      },
      create: {
        id: identity.id,
        email: identity.email,
        name: identity.name ?? identity.email,
        avatarUrl: identity.avatarUrl,
      },
    });

    const [organizationMemberships, companyMemberships] = await Promise.all([
      this.prisma.userOrganizationRole.findMany({
        where: { userId: user.id, status: 'ACTIVE' },
        include: {
          organization: {
            include: {
              companies: {
                where: { systemStatus: { notIn: ['INACTIVE', 'CLOSED'] } },
              },
            },
          },
          role: { include: { permissions: { include: { permission: true } } } },
        },
      }),
      this.prisma.userCompanyRole.findMany({
        where: { userId: user.id, status: 'ACTIVE' },
        include: {
          company: { include: { organization: true } },
          role: { include: { permissions: { include: { permission: true } } } },
        },
      }),
    ]);

    const membershipsByCompany = new Map<string, RequestMembership>();

    // 1) Acesso derivado do papel na organização (ex.: Administrador da organização
    //    enxerga todas as empresas da organização, salvo vínculo mais específico).
    for (const orgMembership of organizationMemberships) {
      const permissions = orgMembership.role.permissions.map(
        (p) => p.permission.slug,
      );

      for (const company of orgMembership.organization.companies) {
        membershipsByCompany.set(company.id, {
          companyId: company.id,
          companyName:
            company.displayName ?? company.legalName ?? 'Empresa sem nome',
          organizationId: orgMembership.organization.id,
          organizationName: orgMembership.organization.name,
          role: {
            id: orgMembership.role.id,
            name: orgMembership.role.name,
            slug: orgMembership.role.slug as RoleSlug,
          },
          permissions,
        });
      }
    }

    // 2) Vínculo direto com a empresa tem precedência sobre o acesso derivado da organização.
    for (const companyMembership of companyMemberships) {
      const permissions = companyMembership.role.permissions.map(
        (p) => p.permission.slug,
      );

      membershipsByCompany.set(companyMembership.company.id, {
        companyId: companyMembership.company.id,
        companyName:
          companyMembership.company.displayName ??
          companyMembership.company.legalName ??
          'Empresa sem nome',
        organizationId: companyMembership.company.organization.id,
        organizationName: companyMembership.company.organization.name,
        role: {
          id: companyMembership.role.id,
          name: companyMembership.role.name,
          slug: companyMembership.role.slug as RoleSlug,
        },
        permissions,
      });
    }

    const memberships = Array.from(membershipsByCompany.values());

    // Vínculo direto por organização — necessário para autorizar ações que ainda não
    // possuem uma empresa associada (ex.: criar a primeira empresa de uma organização nova).
    const requestOrganizationMemberships: RequestOrganizationMembership[] =
      organizationMemberships.map((orgMembership) => ({
        organizationId: orgMembership.organization.id,
        organizationName: orgMembership.organization.name,
        role: {
          id: orgMembership.role.id,
          name: orgMembership.role.name,
          slug: orgMembership.role.slug as RoleSlug,
        },
        permissions: orgMembership.role.permissions.map(
          (p) => p.permission.slug,
        ),
      }));

    const isPlatformAdmin = organizationMemberships.some(
      (m) => (m.role.slug as RoleSlug) === RoleSlug.PLATFORM_ADMIN,
    );

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      memberships,
      organizationMemberships: requestOrganizationMemberships,
      isPlatformAdmin,
    };
  }
}
