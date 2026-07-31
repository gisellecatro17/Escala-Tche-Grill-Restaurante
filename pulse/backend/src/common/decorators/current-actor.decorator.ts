import { ExecutionContext, createParamDecorator } from '@nestjs/common';

import type {
  AuthenticatedRequest,
  RequestUser,
} from '../types/authenticated-request';

/**
 * O usuário autenticado acrescido de onde ele estava quando agiu.
 *
 * Superset de `RequestUser`, então continua servindo para `assertCompanyPermission` e para
 * qualquer coisa que já espere o usuário — o IP e o dispositivo vêm junto de graça.
 */
export interface RequestActor extends RequestUser {
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * Injeta o usuário com IP e dispositivo.
 *
 * A seção 18 do Contas a Pagar exige os dois no histórico. Ler no controlador em vez de no
 * serviço mantém o serviço testável sem `Request` falso — e evita a tentação de passar o
 * objeto de requisição inteiro camada adentro.
 */
export const CurrentActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestActor => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const forwarded = request.headers['x-forwarded-for'];

    const ipAddress =
      (typeof forwarded === 'string'
        ? forwarded.split(',')[0]?.trim()
        : undefined) ??
      request.ip ??
      request.socket?.remoteAddress ??
      null;

    return {
      ...request.user,
      ipAddress,
      userAgent: request.headers['user-agent'] ?? null,
    };
  },
);
