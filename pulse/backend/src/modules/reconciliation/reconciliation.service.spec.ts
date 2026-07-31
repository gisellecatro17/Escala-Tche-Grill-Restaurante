/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call -- mocks do jest sao any por natureza */
import { BadRequestException } from '@nestjs/common';
import {
  BankTransactionDirection,
  BankTransactionReconciliationStatus,
  MatchSuggestionStatus,
  ReconcilableEntityType,
  ReconciliationStatus,
  ReconciliationType,
} from '@prisma/client';

import { ReconciliationService } from './reconciliation.service';
import type { RequestActor } from '../../common/decorators/current-actor.decorator';

const actor: RequestActor = {
  id: 'user-1',
  name: 'Financeiro',
  email: 'financeiro@pulse.test',
  avatarUrl: null,
  memberships: [],
  organizationMemberships: [],
  isPlatformAdmin: true,
  ipAddress: '10.0.0.9',
  userAgent: 'jest/1.0',
};

const defaultSettings = {
  isEnabled: true,
  amountTolerance: 0,
  percentageTolerance: 0,
  dateToleranceDays: 3,
  minimumSuggestionScore: 60,
  partialMatchEnabled: true,
  multipleMatchEnabled: true,
  unmatchEnabled: true,
};

function transaction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tx-1',
    organizationId: 'org-1',
    companyId: 'company-1',
    financialAccountId: 'account-1',
    direction: BankTransactionDirection.OUT,
    amount: 1000,
    reconciledAmount: 0,
    transactionDate: new Date('2026-07-03'),
    reconciliationStatus: BankTransactionReconciliationStatus.AVAILABLE,
    duplicateStatus: 'NOT_DUPLICATE',
    originalDescription: 'PAGAMENTO FORNECEDOR',
    ...overrides,
  };
}

function installment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'installment-1',
    installmentNumber: 1,
    paidAmount: 1000,
    balanceAmount: 0,
    paidAt: new Date('2026-07-03'),
    dueDate: new Date('2026-07-03'),
    payable: {
      code: 'CP-0001',
      description: 'Compra de carnes',
      supplier: { legalName: 'Frigorífico São José Ltda', tradeName: null },
    },
    ...overrides,
  };
}

function buildService(
  options: {
    transactions?: Record<string, unknown>[];
    settings?: Record<string, unknown>;
    installments?: Record<string, unknown>[];
    reconciliation?: Record<string, unknown> | null;
    suggestion?: Record<string, unknown> | null;
  } = {},
) {
  const transactions = options.transactions ?? [transaction()];
  const installments = options.installments ?? [installment()];

  const created: Record<string, unknown>[] = [];
  const updatedTransactions: Record<string, unknown>[] = [];
  const history: Record<string, unknown>[] = [];

  const tx = {
    reconciliation: {
      create: jest.fn((args: any) => {
        created.push(args.data);
        return Promise.resolve({ id: 'rec-1', ...args.data });
      }),
      update: jest.fn((args: any) =>
        Promise.resolve({ id: args.where.id, ...args.data }),
      ),
    },
    bankTransaction: {
      update: jest.fn((args: any) => {
        updatedTransactions.push({ id: args.where.id, ...args.data });
        return Promise.resolve({ id: args.where.id, ...args.data });
      }),
    },
    reconciliationHistory: {
      create: jest.fn((args: any) => {
        history.push(args.data);
        return Promise.resolve(args.data);
      }),
    },
    reconciliationMatchSuggestion: {
      update: jest.fn(() => Promise.resolve({})),
      updateMany: jest.fn(() => Promise.resolve({ count: 0 })),
    },
  };

  const prisma = {
    $transaction: jest.fn((callback: any) => callback(tx)),
    bankTransaction: {
      findMany: jest.fn(({ where }: any) =>
        Promise.resolve(
          transactions.filter((item) =>
            where.id.in.includes(item.id as string),
          ),
        ),
      ),
      findFirstOrThrow: jest.fn(({ where }: any) => {
        const found = transactions.find((item) => item.id === where.id);
        if (!found) return Promise.reject(new Error('não encontrado'));
        return Promise.resolve(found);
      }),
      findUnique: jest.fn(({ where }: any) =>
        Promise.resolve(
          transactions.find((item) => item.id === where.id) ?? null,
        ),
      ),
    },
    accountsPayableInstallment: {
      findUnique: jest.fn(({ where }: any) =>
        Promise.resolve(
          installments.find((item) => item.id === where.id) ?? null,
        ),
      ),
    },
    accountsPayable: { findUnique: jest.fn(() => Promise.resolve(null)) },
    paymentSchedule: { findUnique: jest.fn(() => Promise.resolve(null)) },
    paymentBatch: { findUnique: jest.fn(() => Promise.resolve(null)) },
    reconciliation: {
      findFirstOrThrow: jest.fn(() =>
        options.reconciliation
          ? Promise.resolve(options.reconciliation)
          : Promise.resolve({
              id: 'rec-1',
              organizationId: 'org-1',
              companyId: 'company-1',
              financialAccountId: 'account-1',
              status: ReconciliationStatus.ACTIVE,
              totalBankAmount: 1000,
              items: [
                {
                  id: 'item-1',
                  bankTransactionId: 'tx-1',
                  entityType:
                    ReconcilableEntityType.ACCOUNTS_PAYABLE_INSTALLMENT,
                  entityId: 'installment-1',
                  bankAmount: 1000,
                  allocatedAmount: 1000,
                  bankTransaction: transaction({
                    reconciledAmount: 1000,
                    reconciliationStatus:
                      BankTransactionReconciliationStatus.MANUALLY_MATCHED,
                  }),
                },
              ],
              comments: [],
              history: [],
              company: {},
              financialAccount: {},
            }),
      ),
      findMany: jest.fn(() => Promise.resolve([])),
      count: jest.fn(() => Promise.resolve(0)),
      update: jest.fn(() => Promise.resolve({})),
    },
    reconciliationMatchSuggestion: {
      findFirstOrThrow: jest.fn(() =>
        options.suggestion
          ? Promise.resolve(options.suggestion)
          : Promise.reject(new Error('sem sugestão')),
      ),
    },
    reconciliationComment: {
      create: jest.fn((args: any) => Promise.resolve(args.data)),
      findMany: jest.fn(() => Promise.resolve([])),
    },
  };

  const audit = { log: jest.fn(() => Promise.resolve()) };
  const settings = {
    resolve: jest.fn(() =>
      Promise.resolve({ ...defaultSettings, ...options.settings }),
    ),
  };

  const service = new ReconciliationService(
    prisma as never,
    audit as never,
    settings as never,
  );

  return {
    service,
    prisma,
    audit,
    settings,
    created,
    updatedTransactions,
    history,
    tx,
  };
}

describe('ReconciliationService.create', () => {
  it('registra conciliação um-para-um e fecha a movimentação', async () => {
    const { service, created, updatedTransactions } = buildService();

    await service.create(
      {
        bankTransactionIds: ['tx-1'],
        entries: [
          {
            entityType: ReconcilableEntityType.ACCOUNTS_PAYABLE_INSTALLMENT,
            entityId: 'installment-1',
            allocatedAmount: 1000,
          },
        ],
      },
      actor,
    );

    expect(created[0].reconciliationType).toBe(ReconciliationType.ONE_TO_ONE);
    expect(created[0].differenceAmount).toBe(0);
    expect(updatedTransactions[0].reconciliationStatus).toBe(
      BankTransactionReconciliationStatus.MANUALLY_MATCHED,
    );
    expect(updatedTransactions[0].reconciledAmount).toBe(1000);
  });

  it('registra um-para-muitos com um item por lançamento', async () => {
    const { service, created } = buildService({
      installments: [
        installment({ id: 'installment-1', paidAmount: 600 }),
        installment({ id: 'installment-2', paidAmount: 400 }),
      ],
    });

    await service.create(
      {
        bankTransactionIds: ['tx-1'],
        entries: [
          {
            entityType: ReconcilableEntityType.ACCOUNTS_PAYABLE_INSTALLMENT,
            entityId: 'installment-1',
            allocatedAmount: 600,
          },
          {
            entityType: ReconcilableEntityType.ACCOUNTS_PAYABLE_INSTALLMENT,
            entityId: 'installment-2',
            allocatedAmount: 400,
          },
        ],
      },
      actor,
    );

    expect(created[0].reconciliationType).toBe(ReconciliationType.ONE_TO_MANY);
    expect((created[0].items as any).create).toHaveLength(2);
  });

  it('registra muitos-para-um consumindo as duas movimentações', async () => {
    const { service, created, updatedTransactions } = buildService({
      transactions: [
        transaction({ id: 'tx-1', amount: 600 }),
        transaction({ id: 'tx-2', amount: 400 }),
      ],
    });

    await service.create(
      {
        bankTransactionIds: ['tx-1', 'tx-2'],
        entries: [
          {
            entityType: ReconcilableEntityType.ACCOUNTS_PAYABLE_INSTALLMENT,
            entityId: 'installment-1',
            allocatedAmount: 1000,
          },
        ],
      },
      actor,
    );

    expect(created[0].reconciliationType).toBe(ReconciliationType.MANY_TO_ONE);
    expect(updatedTransactions).toHaveLength(2);
    expect(
      updatedTransactions.every(
        (item) =>
          item.reconciliationStatus ===
          BankTransactionReconciliationStatus.MANUALLY_MATCHED,
      ),
    ).toBe(true);
  });

  /**
   * Sobra bancária além da tolerância é conciliação parcial: parte do valor continua
   * esperando um lançamento, e a transação não pode ser dada por encerrada.
   */
  it('marca como parcial e mantém o saldo restante disponível', async () => {
    const { service, created, updatedTransactions } = buildService();

    await service.create(
      {
        bankTransactionIds: ['tx-1'],
        entries: [
          {
            entityType: ReconcilableEntityType.ACCOUNTS_PAYABLE_INSTALLMENT,
            entityId: 'installment-1',
            allocatedAmount: 600,
          },
        ],
        differenceReason: 'Pagamento parcial acordado com o fornecedor.',
      },
      actor,
    );

    expect(created[0].isPartial).toBe(true);
    expect(created[0].reconciliationType).toBe(ReconciliationType.PARTIAL);
    expect(updatedTransactions[0].reconciledAmount).toBe(600);
    expect(updatedTransactions[0].reconciliationStatus).toBe(
      BankTransactionReconciliationStatus.PARTIALLY_MATCHED,
    );
  });

  it('exige justificativa quando a diferença passa da tolerância', async () => {
    const { service } = buildService();

    await expect(
      service.create(
        {
          bankTransactionIds: ['tx-1'],
          entries: [
            {
              entityType: ReconcilableEntityType.ACCOUNTS_PAYABLE_INSTALLMENT,
              entityId: 'installment-1',
              allocatedAmount: 600,
            },
          ],
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  /** Dentro da tolerância a diferença é absorvida e a transação fecha inteira. */
  it('absorve a diferença que cabe na tolerância sem exigir justificativa', async () => {
    const { service, created, updatedTransactions } = buildService({
      settings: { amountTolerance: 1 },
    });

    await service.create(
      {
        bankTransactionIds: ['tx-1'],
        entries: [
          {
            entityType: ReconcilableEntityType.ACCOUNTS_PAYABLE_INSTALLMENT,
            entityId: 'installment-1',
            allocatedAmount: 999.5,
          },
        ],
      },
      actor,
    );

    expect(created[0].isPartial).toBe(false);
    expect(updatedTransactions[0].reconciledAmount).toBe(1000);
    expect(updatedTransactions[0].reconciliationStatus).toBe(
      BankTransactionReconciliationStatus.MANUALLY_MATCHED,
    );
  });

  it('recusa conciliar movimentações de contas diferentes', async () => {
    const { service } = buildService({
      transactions: [
        transaction({ id: 'tx-1' }),
        transaction({ id: 'tx-2', financialAccountId: 'account-2' }),
      ],
    });

    await expect(
      service.create(
        {
          bankTransactionIds: ['tx-1', 'tx-2'],
          entries: [
            {
              entityType: ReconcilableEntityType.ACCOUNTS_PAYABLE_INSTALLMENT,
              entityId: 'installment-1',
              allocatedAmount: 1000,
            },
          ],
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa misturar entrada e saída na mesma conciliação', async () => {
    const { service } = buildService({
      transactions: [
        transaction({ id: 'tx-1' }),
        transaction({ id: 'tx-2', direction: BankTransactionDirection.IN }),
      ],
    });

    await expect(
      service.create(
        {
          bankTransactionIds: ['tx-1', 'tx-2'],
          entries: [
            {
              entityType: ReconcilableEntityType.ACCOUNTS_PAYABLE_INSTALLMENT,
              entityId: 'installment-1',
              allocatedAmount: 1000,
            },
          ],
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  /**
   * Um crédito bancário conciliado contra uma conta a pagar registra um pagamento que nunca
   * saiu. Sentido é regra dura, não critério de pontuação.
   */
  it('recusa conciliar entrada bancária contra conta a pagar', async () => {
    const { service } = buildService({
      transactions: [
        transaction({ id: 'tx-1', direction: BankTransactionDirection.IN }),
      ],
    });

    await expect(
      service.create(
        {
          bankTransactionIds: ['tx-1'],
          entries: [
            {
              entityType: ReconcilableEntityType.ACCOUNTS_PAYABLE_INSTALLMENT,
              entityId: 'installment-1',
              allocatedAmount: 1000,
            },
          ],
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa conciliar movimentação já conciliada', async () => {
    const { service } = buildService({
      transactions: [
        transaction({
          reconciliationStatus: BankTransactionReconciliationStatus.MATCHED,
        }),
      ],
    });

    await expect(
      service.create(
        {
          bankTransactionIds: ['tx-1'],
          entries: [
            {
              entityType: ReconcilableEntityType.ACCOUNTS_PAYABLE_INSTALLMENT,
              entityId: 'installment-1',
              allocatedAmount: 1000,
            },
          ],
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa conciliar movimentação marcada como duplicidade exata', async () => {
    const { service } = buildService({
      transactions: [transaction({ duplicateStatus: 'EXACT' })],
    });

    await expect(
      service.create(
        {
          bankTransactionIds: ['tx-1'],
          entries: [
            {
              entityType: ReconcilableEntityType.ACCOUNTS_PAYABLE_INSTALLMENT,
              entityId: 'installment-1',
              allocatedAmount: 1000,
            },
          ],
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa o mesmo lançamento repetido na mesma conciliação', async () => {
    const { service } = buildService();

    await expect(
      service.create(
        {
          bankTransactionIds: ['tx-1'],
          entries: [
            {
              entityType: ReconcilableEntityType.ACCOUNTS_PAYABLE_INSTALLMENT,
              entityId: 'installment-1',
              allocatedAmount: 500,
            },
            {
              entityType: ReconcilableEntityType.ACCOUNTS_PAYABLE_INSTALLMENT,
              entityId: 'installment-1',
              allocatedAmount: 500,
            },
          ],
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  /** Tipo sem resolvedor viraria um vínculo apontando para lugar nenhum. */
  it('recusa tipo de lançamento cujo módulo ainda não existe', async () => {
    const { service } = buildService();

    await expect(
      service.create(
        {
          bankTransactionIds: ['tx-1'],
          entries: [
            {
              entityType: ReconcilableEntityType.ACCOUNTS_RECEIVABLE,
              entityId: 'receivable-1',
              allocatedAmount: 1000,
            },
          ],
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa conciliação múltipla quando o parâmetro está desligado', async () => {
    const { service } = buildService({
      settings: { multipleMatchEnabled: false },
    });

    await expect(
      service.create(
        {
          bankTransactionIds: ['tx-1'],
          entries: [
            {
              entityType: ReconcilableEntityType.ACCOUNTS_PAYABLE_INSTALLMENT,
              entityId: 'installment-1',
              allocatedAmount: 500,
            },
            {
              entityType: ReconcilableEntityType.ACCOUNTS_PAYABLE_INSTALLMENT,
              entityId: 'installment-2',
              allocatedAmount: 500,
            },
          ],
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa conciliação parcial quando o parâmetro está desligado', async () => {
    const { service } = buildService({
      settings: { partialMatchEnabled: false },
    });

    await expect(
      service.create(
        {
          bankTransactionIds: ['tx-1'],
          entries: [
            {
              entityType: ReconcilableEntityType.ACCOUNTS_PAYABLE_INSTALLMENT,
              entityId: 'installment-1',
              allocatedAmount: 600,
            },
          ],
          differenceReason: 'Parcial.',
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa conciliar quando a conta já teve todo o valor conciliado', async () => {
    const { service } = buildService({
      transactions: [
        transaction({
          reconciledAmount: 1000,
          reconciliationStatus:
            BankTransactionReconciliationStatus.PARTIALLY_MATCHED,
        }),
      ],
    });

    await expect(
      service.create(
        {
          bankTransactionIds: ['tx-1'],
          entries: [
            {
              entityType: ReconcilableEntityType.ACCOUNTS_PAYABLE_INSTALLMENT,
              entityId: 'installment-1',
              allocatedAmount: 100,
            },
          ],
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  /** Trilha completa: usuário, IP e dispositivo em cada conciliação. */
  it('registra usuário, IP e dispositivo no histórico', async () => {
    const { service, history } = buildService();

    await service.create(
      {
        bankTransactionIds: ['tx-1'],
        entries: [
          {
            entityType: ReconcilableEntityType.ACCOUNTS_PAYABLE_INSTALLMENT,
            entityId: 'installment-1',
            allocatedAmount: 1000,
          },
        ],
      },
      actor,
    );

    expect(history[0].performedBy).toBe('user-1');
    expect(history[0].ipAddress).toBe('10.0.0.9');
    expect(history[0].deviceInfo).toBe('jest/1.0');
  });
});

describe('ReconciliationService.acceptSuggestion', () => {
  const suggestion = {
    id: 'sug-1',
    organizationId: 'org-1',
    companyId: 'company-1',
    bankTransactionId: 'tx-1',
    candidateEntityType: ReconcilableEntityType.ACCOUNTS_PAYABLE_INSTALLMENT,
    candidateEntityId: 'installment-1',
    score: 90,
    status: MatchSuggestionStatus.PENDING,
    bankTransaction: transaction(),
  };

  it('cria a conciliação com o score da sugestão aceita', async () => {
    const { service, created, tx } = buildService({ suggestion });

    await service.acceptSuggestion('sug-1', actor);

    expect(created[0].confidenceScore).toBe(90);
    expect(created[0].isManual).toBe(false);
    expect(tx.reconciliationMatchSuggestion.update).toHaveBeenCalled();
  });

  /** As demais sugestões da mesma transação caducam: a disputa já foi decidida. */
  it('expira as sugestões concorrentes da mesma movimentação', async () => {
    const { service, tx } = buildService({ suggestion });

    await service.acceptSuggestion('sug-1', actor);

    expect(tx.reconciliationMatchSuggestion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: MatchSuggestionStatus.EXPIRED },
      }),
    );
  });

  it('recusa aceitar sugestão já revisada', async () => {
    const { service } = buildService({
      suggestion: { ...suggestion, status: MatchSuggestionStatus.DISMISSED },
    });

    await expect(
      service.acceptSuggestion('sug-1', actor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ReconciliationService.unmatch', () => {
  it('preserva o registro e devolve a movimentação para a fila', async () => {
    const { service, tx, updatedTransactions } = buildService();

    await service.unmatch(
      'rec-1',
      { reason: 'Conciliado no título errado.' },
      actor,
    );

    expect(tx.reconciliation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ReconciliationStatus.UNMATCHED,
          unmatchReason: 'Conciliado no título errado.',
          unmatchedBy: 'user-1',
        }),
      }),
    );

    expect(updatedTransactions[0].reconciledAmount).toBe(0);
    expect(updatedTransactions[0].reconciliationStatus).toBe(
      BankTransactionReconciliationStatus.AVAILABLE,
    );
  });

  it('recusa desfazer duas vezes', async () => {
    const { service } = buildService({
      reconciliation: {
        id: 'rec-1',
        organizationId: 'org-1',
        companyId: 'company-1',
        financialAccountId: 'account-1',
        status: ReconciliationStatus.UNMATCHED,
        items: [],
      },
    });

    await expect(
      service.unmatch('rec-1', { reason: 'De novo.' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa desfazer quando o parâmetro está desligado', async () => {
    const { service } = buildService({ settings: { unmatchEnabled: false } });

    await expect(
      service.unmatch('rec-1', { reason: 'Erro.' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ReconciliationService.linkTransfer', () => {
  const pair = [
    transaction({ id: 'tx-out', direction: BankTransactionDirection.OUT }),
    transaction({
      id: 'tx-in',
      direction: BankTransactionDirection.IN,
      financialAccountId: 'account-2',
    }),
  ];

  it('liga as duas pontas e fecha as duas movimentações', async () => {
    const { service, created, updatedTransactions } = buildService({
      transactions: pair,
    });

    await service.linkTransfer(
      { outgoingTransactionId: 'tx-out', incomingTransactionId: 'tx-in' },
      actor,
    );

    expect(created[0].reconciliationType).toBe(ReconciliationType.TRANSFER);
    expect((created[0].items as any).create).toHaveLength(2);
    expect(updatedTransactions).toHaveLength(2);
  });

  it('recusa transferência dentro da mesma conta', async () => {
    const { service } = buildService({
      transactions: [
        transaction({ id: 'tx-out' }),
        transaction({ id: 'tx-in', direction: BankTransactionDirection.IN }),
      ],
    });

    await expect(
      service.linkTransfer(
        { outgoingTransactionId: 'tx-out', incomingTransactionId: 'tx-in' },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa quando os sentidos não formam saída e entrada', async () => {
    const { service } = buildService({
      transactions: [
        transaction({ id: 'tx-out' }),
        transaction({ id: 'tx-in', financialAccountId: 'account-2' }),
      ],
    });

    await expect(
      service.linkTransfer(
        { outgoingTransactionId: 'tx-out', incomingTransactionId: 'tx-in' },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  /** Diferença legítima é a tarifa; fora da tolerância alguém precisa dizer o que é. */
  it('exige explicação quando as pontas têm valores diferentes', async () => {
    const { service } = buildService({
      transactions: [
        transaction({ id: 'tx-out', amount: 1000 }),
        transaction({
          id: 'tx-in',
          amount: 990,
          direction: BankTransactionDirection.IN,
          financialAccountId: 'account-2',
        }),
      ],
    });

    await expect(
      service.linkTransfer(
        { outgoingTransactionId: 'tx-out', incomingTransactionId: 'tx-in' },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa ligar a movimentação a ela mesma', async () => {
    const { service } = buildService({ transactions: pair });

    await expect(
      service.linkTransfer(
        { outgoingTransactionId: 'tx-out', incomingTransactionId: 'tx-out' },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
