/* eslint-disable @typescript-eslint/no-unsafe-assignment -- slugs de RoleSlug usam `as any` propositalmente nos testes */
import { ForbiddenException } from '@nestjs/common';

import type { RequestUser } from '../types/authenticated-request';
import {
  assertCompanyPermission,
  assertOrganizationPermission,
  hasPermissionAnywhere,
} from './access-control.util';

function buildActor(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id: 'user-1',
    name: 'Usuária de Teste',
    email: 'teste@pulse.app',
    avatarUrl: null,
    isPlatformAdmin: false,
    memberships: [],
    organizationMemberships: [],
    ...overrides,
  };
}

describe('access-control.util (isolamento entre organizações/empresas)', () => {
  it('assertOrganizationPermission bloqueia quando o usuário não tem vínculo com a organização', () => {
    const actor = buildActor();
    expect(() =>
      assertOrganizationPermission(actor, 'org-1', 'company.create'),
    ).toThrow(ForbiddenException);
  });

  it('assertOrganizationPermission permite criar a primeira empresa de uma organização nova (sem empresas ainda)', () => {
    const actor = buildActor({
      organizationMemberships: [
        {
          organizationId: 'org-1',
          organizationName: 'Organização Teste',
          role: {
            id: 'role-1',
            name: 'Administrador da organização',
            slug: 'organization_admin' as any,
          },
          permissions: ['company.create'],
        },
      ],
    });

    expect(() =>
      assertOrganizationPermission(actor, 'org-1', 'company.create'),
    ).not.toThrow();
  });

  it('assertOrganizationPermission bloqueia acesso a uma organização diferente da vinculada (isolamento)', () => {
    const actor = buildActor({
      organizationMemberships: [
        {
          organizationId: 'org-1',
          organizationName: 'Organização A',
          role: {
            id: 'role-1',
            name: 'Administrador da organização',
            slug: 'organization_admin' as any,
          },
          permissions: ['company.create'],
        },
      ],
    });

    expect(() =>
      assertOrganizationPermission(actor, 'org-2', 'company.create'),
    ).toThrow(ForbiddenException);
  });

  it('assertCompanyPermission bloqueia quando a permissão não está entre as concedidas', () => {
    const actor = buildActor({
      memberships: [
        {
          companyId: 'company-1',
          companyName: 'Empresa Teste',
          organizationId: 'org-1',
          organizationName: 'Organização Teste',
          role: { id: 'role-1', name: 'Financeiro', slug: 'financial' as any },
          permissions: ['company.view'],
        },
      ],
    });

    expect(() =>
      assertCompanyPermission(actor, 'company-1', 'company.delete'),
    ).toThrow(ForbiddenException);
  });

  it('administrador da plataforma tem acesso a qualquer organização/empresa', () => {
    const actor = buildActor({ isPlatformAdmin: true });
    expect(() =>
      assertOrganizationPermission(actor, 'org-qualquer', 'company.delete'),
    ).not.toThrow();
    expect(() =>
      assertCompanyPermission(actor, 'company-qualquer', 'company.delete'),
    ).not.toThrow();
  });

  it('hasPermissionAnywhere verifica tanto vínculos de organização quanto de empresa', () => {
    const actorSemPermissao = buildActor();
    expect(
      hasPermissionAnywhere(actorSemPermissao, 'company.query_document'),
    ).toBe(false);

    const actorComPermissaoNaEmpresa = buildActor({
      memberships: [
        {
          companyId: 'company-1',
          companyName: 'Empresa Teste',
          organizationId: 'org-1',
          organizationName: 'Organização Teste',
          role: { id: 'role-1', name: 'Financeiro', slug: 'financial' as any },
          permissions: ['company.query_document'],
        },
      ],
    });
    expect(
      hasPermissionAnywhere(
        actorComPermissaoNaEmpresa,
        'company.query_document',
      ),
    ).toBe(true);
  });
});
