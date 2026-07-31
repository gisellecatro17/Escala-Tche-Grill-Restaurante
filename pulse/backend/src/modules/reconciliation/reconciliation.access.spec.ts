/* eslint-disable @typescript-eslint/no-unsafe-member-access -- mocks do jest sao any por natureza */
import { ForbiddenException } from '@nestjs/common';
import { BankTransactionDirection } from '@prisma/client';

import { BankTransactionsService } from './bank-transactions.service';
import { assertCompanyPermission } from '../../common/utils/access-control.util';
import type { RequestActor } from '../../common/decorators/current-actor.decorator';

/** Operador da empresa 1, sem a permissão de ver dado bancário completo. */
const operator: RequestActor = {
  id: 'user-1',
  name: 'Analista',
  email: 'analista@pulse.test',
  avatarUrl: null,
  memberships: [
    {
      companyId: 'company-1',
      organizationId: 'org-1',
      roleId: 'role-1',
      permissions: ['reconciliation.view', 'reconciliation.reconcile'],
    } as never,
  ],
  organizationMemberships: [],
  isPlatformAdmin: false,
  ipAddress: '10.0.0.4',
  userAgent: 'jest/1.0',
};

/** O mesmo operador, agora com a permissão de dado sensível. */
const auditor: RequestActor = {
  ...operator,
  id: 'user-2',
  memberships: [
    {
      companyId: 'company-1',
      organizationId: 'org-1',
      roleId: 'role-2',
      permissions: [
        'reconciliation.view',
        'reconciliation.view_sensitive_data',
      ],
    } as never,
  ],
};

const record = {
  id: 'tx-1',
  organizationId: 'org-1',
  companyId: 'company-1',
  financialAccountId: 'account-1',
  direction: BankTransactionDirection.IN,
  amount: 1000,
  accountNumber: '56789012',
  payerDocument: '12345678000199',
  payeeDocument: null,
  financialAccount: { id: 'account-1', accountNumber: '99887766' },
  suggestions: [],
  reconciliationItems: [],
  assignments: [],
  comments: [],
  history: [],
};

function buildService() {
  const prisma = {
    bankTransaction: {
      findFirstOrThrow: jest.fn(() => Promise.resolve({ ...record })),
      findMany: jest.fn(() => Promise.resolve([{ ...record }])),
      count: jest.fn(() => Promise.resolve(1)),
    },
  };

  return new BankTransactionsService(
    prisma as never,
    { log: jest.fn() } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

describe('Mascaramento de dados bancários (seção 70)', () => {
  /**
   * O mascaramento acontece no back-end, não na tela: o valor cru sairia na resposta, no
   * log do proxy e no cache do navegador. Esconder no front seria esconder só de quem olha.
   */
  it('mascara conta e documento de quem não tem a permissão', async () => {
    const service = buildService();
    const result: any = await service.findOne('tx-1', operator);

    expect(result.accountNumber).toBe('*******2');
    expect(result.payerDocument).toBe('*************9');
    expect(result.financialAccount.accountNumber).toBe('*******6');
  });

  it('entrega o dado completo a quem tem a permissão', async () => {
    const service = buildService();
    const result: any = await service.findOne('tx-1', auditor);

    expect(result.accountNumber).toBe('56789012');
    expect(result.payerDocument).toBe('12345678000199');
    expect(result.financialAccount.accountNumber).toBe('99887766');
  });

  it('mascara também na listagem, não só no detalhe', async () => {
    const service = buildService();
    const result: any = await service.findAll(
      { page: 1, perPage: 20 },
      operator,
    );

    expect(result.items[0].accountNumber).toBe('*******2');
  });

  it('não vaza nulo mascarado quando o campo não existe', async () => {
    const service = buildService();
    const result: any = await service.findOne('tx-1', operator);

    expect(result.payeeDocument).toBeNull();
  });
});

describe('Isolamento multiempresa', () => {
  /**
   * A permissão é verificada contra a empresa do **registro**, lida do banco — nunca contra
   * a que veio no corpo da requisição. Trocar um id no cliente não muda o dono do dado.
   */
  it('recusa acesso a movimentação de outra empresa', () => {
    expect(() =>
      assertCompanyPermission(operator, 'company-2', 'reconciliation.view'),
    ).toThrow(ForbiddenException);
  });

  it('recusa a ação quando falta a permissão específica', () => {
    expect(() =>
      assertCompanyPermission(operator, 'company-1', 'reconciliation.unmatch'),
    ).toThrow(ForbiddenException);
  });

  it('aceita a ação quando a permissão está na empresa certa', () => {
    expect(() =>
      assertCompanyPermission(
        operator,
        'company-1',
        'reconciliation.reconcile',
      ),
    ).not.toThrow();
  });
});
