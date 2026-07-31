import { ForbiddenException } from '@nestjs/common';

import type { RequestUser } from '../types/authenticated-request';

const DEFAULT_MESSAGE = 'Você não tem permissão para realizar esta ação.';

/**
 * Garante que o usuário possua a permissão informada na organização (vínculo direto,
 * independente de a organização já ter empresas cadastradas). Usado para autorizar
 * ações anteriores à existência de uma empresa, como criar a primeira empresa de uma
 * organização recém-criada.
 */
export function assertOrganizationPermission(
  actor: RequestUser,
  organizationId: string,
  permissionSlug: string,
  message = DEFAULT_MESSAGE,
): void {
  if (actor.isPlatformAdmin) return;

  const hasAccess = actor.organizationMemberships.some(
    (m) =>
      m.organizationId === organizationId &&
      m.permissions.includes(permissionSlug),
  );

  if (!hasAccess) {
    throw new ForbiddenException(message);
  }
}

/** Garante que o usuário possua a permissão informada na empresa (vínculo direto ou derivado da organização). */
export function assertCompanyPermission(
  actor: RequestUser,
  companyId: string,
  permissionSlug: string,
  message = DEFAULT_MESSAGE,
): void {
  if (actor.isPlatformAdmin) return;

  const membership = actor.memberships.find((m) => m.companyId === companyId);

  if (!membership || !membership.permissions.includes(permissionSlug)) {
    throw new ForbiddenException(message);
  }
}

/** Verifica se o usuário possui a permissão em qualquer organização/empresa (uso em utilitários gerais, ex.: consulta de CEP/CNPJ). */
export function hasPermissionAnywhere(
  actor: RequestUser,
  permissionSlug: string,
): boolean {
  if (actor.isPlatformAdmin) return true;

  return (
    actor.organizationMemberships.some((m) =>
      m.permissions.includes(permissionSlug),
    ) || actor.memberships.some((m) => m.permissions.includes(permissionSlug))
  );
}
