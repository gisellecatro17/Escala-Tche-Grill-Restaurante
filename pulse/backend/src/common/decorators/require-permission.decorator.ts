import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSION_KEY = 'required_permission';

/**
 * Exige que o usuário possua a permissão informada na empresa selecionada (header X-Company-Id)
 * para acessar a rota. Verificado pelo PermissionsGuard.
 */
export const RequirePermission = (permissionSlug: string) =>
  SetMetadata(REQUIRED_PERMISSION_KEY, permissionSlug);
