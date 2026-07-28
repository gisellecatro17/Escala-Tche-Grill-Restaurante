/* eslint-disable @typescript-eslint/no-unsafe-assignment -- mocks de request usam `any` propositalmente nos testes */
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthenticatedRequest } from '../types/authenticated-request';
import { PermissionsGuard } from './permissions.guard';

function buildContext(
  request: Partial<AuthenticatedRequest>,
  requiredPermission?: string,
) {
  const reflector = new Reflector();
  jest
    .spyOn(reflector, 'getAllAndOverride')
    .mockReturnValue(requiredPermission);

  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;

  return { guard: new PermissionsGuard(reflector), context };
}

describe('PermissionsGuard (isolamento multiempresa)', () => {
  it('libera a rota quando nenhuma permissão é exigida', () => {
    const { guard, context } = buildContext({});
    expect(guard.canActivate(context)).toBe(true);
  });

  it('bloqueia quando não há empresa selecionada (header X-Company-Id ausente)', () => {
    const { guard, context } = buildContext(
      { user: { isPlatformAdmin: false } as any },
      'payables.view',
    );
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('bloqueia quando a empresa selecionada não possui a permissão exigida', () => {
    const { guard, context } = buildContext(
      {
        user: { isPlatformAdmin: false } as any,
        membership: { permissions: ['payables.view'] } as any,
      },
      'financial.approve',
    );
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('libera quando a empresa selecionada possui a permissão exigida', () => {
    const { guard, context } = buildContext(
      {
        user: { isPlatformAdmin: false } as any,
        membership: { permissions: ['payables.view'] } as any,
      },
      'payables.view',
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it('administrador da plataforma tem acesso mesmo sem vínculo com a empresa', () => {
    const { guard, context } = buildContext(
      { user: { isPlatformAdmin: true } as any },
      'financial.approve',
    );
    expect(guard.canActivate(context)).toBe(true);
  });
});
