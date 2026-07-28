import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { REQUIRED_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import type { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Garante o isolamento multiempresa: a rota só é liberada se o usuário possuir um vínculo
 * ativo com a empresa informada no header X-Company-Id e, quando exigido, a permissão
 * necessária dentro dessa empresa. Autorização é sempre validada no back-end.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.getAllAndOverride<string>(
      REQUIRED_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.user?.isPlatformAdmin) {
      return true;
    }

    if (!request.membership) {
      throw new ForbiddenException(
        'Informe uma empresa válida (header X-Company-Id) para acessar este recurso.',
      );
    }

    if (!request.membership.permissions.includes(requiredPermission)) {
      throw new ForbiddenException(
        'Você não tem permissão para realizar esta ação.',
      );
    }

    return true;
  }
}
