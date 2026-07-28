import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import type { AuthenticatedRequest } from '../types/authenticated-request';

/** Restringe a rota ao perfil "Administrador da plataforma" (equipe Pulse). */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user?.isPlatformAdmin) {
      throw new ForbiddenException(
        'Apenas administradores da plataforma podem realizar esta ação.',
      );
    }

    return true;
  }
}
