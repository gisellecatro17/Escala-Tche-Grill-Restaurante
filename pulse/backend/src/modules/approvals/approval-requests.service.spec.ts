/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- mocks do jest sao `any` por natureza */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';

import type { RequestUser } from '../../common/types/authenticated-request';
import { ApprovalRequestsService } from './approval-requests.service';

const ACTOR = { id: 'user-1' } as RequestUser;

function buildEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'entry-1',
    organizationId: 'org-1',
    companyId: 'company-1',
    netAmount: 5000,
    direction: 'PAYABLE',
    categoryId: 'cat-1',
    costCenterId: 'cc-1',
    projectId: null,
    businessUnitId: null,
    financialNatureId: null,
    supplierId: 'sup-1',
    supplierCompanyLinkId: 'link-1',
    paymentMethodId: null,
    sourceIntakeDocumentId: 'doc-1',
    createdBy: 'quem-criou',
    ...overrides,
  } as never;
}

function buildSettings(overrides: Record<string, unknown> = {}) {
  return {
    id: 'settings-1',
    organizationId: 'org-1',
    companyId: 'company-1',
    requireApprovalForAll: false,
    mandatoryAboveAmount: null,
    blockSelfApprovalGlobally: true,
    enforceIndividualLimit: true,
    expireOverdueRequests: true,
    defaultDeadlineHours: 48,
    ...overrides,
  };
}

function buildService(
  options: {
    flow?: unknown;
    settings?: Record<string, unknown>;
    liveRequest?: unknown;
    request?: Record<string, unknown>;
    eligibility?: Record<string, unknown>;
    previousAttempts?: number;
    existingApproval?: unknown;
  } = {},
) {
  const settings = buildSettings(options.settings);

  const created = {
    id: 'request-1',
    companyId: 'company-1',
    organizationId: 'org-1',
    steps: [],
  };

  const tx = {
    approvalRequest: {
      create: jest.fn().mockResolvedValue(created),
      update: jest.fn().mockResolvedValue(created),
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({ startedAt: new Date(), status: 'IN_PROGRESS' }),
    },
    approvalRequestStep: {
      updateMany: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    approvalStepApproval: { create: jest.fn().mockResolvedValue({}) },
    approvalHistory: { create: jest.fn().mockResolvedValue({}) },
    approvalComment: { create: jest.fn().mockResolvedValue({}) },
  };

  const storedRequest = {
    id: 'request-1',
    organizationId: 'org-1',
    companyId: 'company-1',
    entryId: 'entry-1',
    status: 'IN_PROGRESS',
    priority: 'NORMAL',
    amount: 5000,
    requestedBy: 'quem-criou',
    startedAt: new Date(),
    entry: buildEntry(),
    steps: [
      {
        id: 'rstep-1',
        stepOrder: 1,
        status: 'IN_PROGRESS',
        requiredApprovals: 1,
        approvalsGiven: 0,
        blockSelfApproval: true,
        approverType: 'ANY_WITH_PERMISSION',
        approverUserId: null,
        approverRoleId: null,
      },
    ],
    ...options.request,
  };

  const prisma = {
    approvalSettings: {
      findUnique: jest.fn().mockResolvedValue(settings),
      create: jest.fn().mockResolvedValue(settings),
      update: jest.fn().mockResolvedValue(settings),
    },
    approvalRequest: {
      findFirst: jest.fn().mockResolvedValue(options.liveRequest ?? null),
      findFirstOrThrow: jest.fn().mockResolvedValue(storedRequest),
      // Lido depois da transação, para saber se a solicitação inteira foi aprovada e o
      // título a pagar deve nascer.
      findUnique: jest.fn().mockResolvedValue({
        status: 'IN_PROGRESS',
        entryId: storedRequest.entryId,
      }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(options.previousAttempts ?? 0),
      update: jest.fn().mockResolvedValue(storedRequest),
      updateMany: jest.fn().mockResolvedValue({}),
    },
    approvalStepApproval: {
      findFirst: jest.fn().mockResolvedValue(options.existingApproval ?? null),
    },
    financialEntry: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    approvalComment: {
      create: jest.fn().mockResolvedValue({ id: 'comment-1' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    approvalHistory: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
    approvalRequestStep: { update: jest.fn().mockResolvedValue({}) },
    intakeDocument: {
      findUnique: jest.fn().mockResolvedValue({ documentType: 'NFE' }),
    },
    supplierContract: { findMany: jest.fn().mockResolvedValue([]) },
    userCompanyRole: { findFirst: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn((argument: unknown) =>
      typeof argument === 'function'
        ? (argument as (client: unknown) => unknown)(tx)
        : Promise.all(argument as Promise<unknown>[]),
    ),
  };

  const audit = { log: jest.fn().mockResolvedValue(undefined) };

  const flows = {
    resolve: jest.fn().mockResolvedValue(options.flow ?? null),
    applicableSteps: jest.fn(
      (steps: { minimumAmount: number | null }[], amount: number) =>
        steps.map((step) => ({
          step,
          applies: step.minimumAmount === null || amount >= step.minimumAmount,
        })),
    ),
  };

  const approvers = {
    check: jest.fn().mockResolvedValue({
      allowed: true,
      reason: null,
      delegation: null,
      onBehalfOf: null,
      ...options.eligibility,
    }),
  };

  // O título a pagar é gerado fora deste serviço; aqui só interessa que a aprovação
  // concluída chame a geração exatamente uma vez.
  const payables = { generateFromEntry: jest.fn().mockResolvedValue(null) };

  const service = new ApprovalRequestsService(
    prisma as never,
    audit as never,
    flows as never,
    approvers as never,
    payables as never,
  );

  return {
    service,
    prisma,
    tx,
    audit,
    flows,
    approvers,
    payables,
    storedRequest,
  };
}

function buildFlow(steps: Record<string, unknown>[]) {
  return {
    id: 'flow-1',
    name: 'Compra de alimentos',
    defaultDeadlineHours: 24,
    steps: steps.map((step, index) => ({
      id: `step-${index + 1}`,
      stepOrder: index + 1,
      name: `Etapa ${index + 1}`,
      approverType: 'ROLE',
      approverUserId: null,
      approverRoleId: 'role-1',
      requiredApprovals: 1,
      isMandatory: true,
      blockSelfApproval: true,
      minimumAmount: null,
      maximumAmount: null,
      deadlineHours: null,
      ...step,
    })),
  };
}

describe('Abertura da solicitação de aprovação', () => {
  it('não abre quando nenhum fluxo casa e a empresa não exige aprovação', async () => {
    const { service } = buildService({ flow: null });

    await expect(service.openFor(buildEntry(), ACTOR)).resolves.toBeNull();
  });

  it('recusa quando a empresa exige aprovação e nenhum fluxo corresponde', async () => {
    const { service } = buildService({
      flow: null,
      settings: { requireApprovalForAll: true },
    });

    await expect(service.openFor(buildEntry(), ACTOR)).rejects.toThrow(
      'nenhum fluxo de aprovação corresponde',
    );
  });

  it('exige aprovação acima do valor configurado mesmo sem fluxo específico', async () => {
    const { service } = buildService({
      flow: null,
      settings: { mandatoryAboveAmount: 1000 },
    });

    await expect(
      service.openFor(buildEntry({ netAmount: 5000 }), ACTOR),
    ).rejects.toThrow('nenhum fluxo de aprovação corresponde');
  });

  it('recusa segunda solicitação viva para o mesmo lançamento', async () => {
    const { service } = buildService({ liveRequest: { id: 'ja-existe' } });

    await expect(service.openFor(buildEntry(), ACTOR)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('materializa as etapas do fluxo na solicitação', async () => {
    const { service, tx } = buildService({
      flow: buildFlow([{}, {}, {}]),
    });

    await service.openFor(buildEntry(), ACTOR);

    const data = tx.approvalRequest.create.mock.calls[0][0].data;

    expect(data.steps.create).toHaveLength(3);
    expect(data.status).toBe('IN_PROGRESS');
    expect(data.currentStepOrder).toBe(1);
  });

  it('marca como dispensadas as etapas fora da faixa de valor', async () => {
    const { service, tx } = buildService({
      flow: buildFlow([{ minimumAmount: null }, { minimumAmount: 100_000 }]),
    });

    await service.openFor(buildEntry({ netAmount: 5000 }), ACTOR);

    const steps = tx.approvalRequest.create.mock.calls[0][0].data.steps.create;

    expect(steps[0].status).toBe('PENDING');
    expect(steps[1].status).toBe('SKIPPED');
  });

  it('recusa fluxo sem nenhuma etapa obrigatória para o valor', async () => {
    const { service } = buildService({
      flow: buildFlow([{ minimumAmount: 100_000 }]),
    });

    await expect(
      service.openFor(buildEntry({ netAmount: 500 }), ACTOR),
    ).rejects.toThrow('nenhuma etapa obrigatória');
  });

  it('copia o valor do lançamento para a solicitação', async () => {
    const { service, tx } = buildService({ flow: buildFlow([{}]) });

    await service.openFor(buildEntry({ netAmount: 8900 }), ACTOR);

    expect(tx.approvalRequest.create.mock.calls[0][0].data.amount).toBe(8900);
  });

  it('numera a tentativa a partir das solicitações anteriores', async () => {
    const { service, tx } = buildService({
      flow: buildFlow([{}]),
      previousAttempts: 2,
    });

    await service.openFor(buildEntry(), ACTOR);

    expect(tx.approvalRequest.create.mock.calls[0][0].data.attempt).toBe(3);
  });

  it('registra na auditoria que nada foi autorizado no banco', async () => {
    const { service, audit } = buildService({ flow: buildFlow([{}]) });

    await service.openFor(buildEntry(), ACTOR);

    expect(audit.log.mock.calls[0][0].newValue.note).toContain(
      'Não autoriza pagamento',
    );
  });
});

describe('Decisões', () => {
  it('recusa aprovar sem elegibilidade', async () => {
    const { service } = buildService({
      eligibility: { allowed: false, reason: 'Sem alçada.' },
    });

    await expect(
      service.approve('request-1', {}, ACTOR),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('a mesma pessoa não assina duas vezes a mesma etapa', async () => {
    const { service } = buildService({
      existingApproval: { id: 'ja-aprovou' },
      request: {
        steps: [
          {
            id: 'rstep-1',
            stepOrder: 1,
            status: 'IN_PROGRESS',
            requiredApprovals: 2,
            approvalsGiven: 1,
            blockSelfApproval: true,
            approverType: 'ANY_WITH_PERMISSION',
          },
        ],
      },
    });

    await expect(service.approve('request-1', {}, ACTOR)).rejects.toThrow(
      'duas pessoas diferentes',
    );
  });

  it('dupla aprovação: a primeira assinatura não conclui a etapa', async () => {
    const { service, tx } = buildService({
      request: {
        steps: [
          {
            id: 'rstep-1',
            stepOrder: 1,
            status: 'IN_PROGRESS',
            requiredApprovals: 2,
            approvalsGiven: 0,
            blockSelfApproval: true,
            approverType: 'ANY_WITH_PERMISSION',
          },
        ],
      },
    });

    await service.approve('request-1', {}, ACTOR);

    const update = tx.approvalRequestStep.update.mock.calls[0][0].data;

    expect(update.approvalsGiven).toBe(1);
    expect(update.status).toBeUndefined();
  });

  it('a segunda assinatura conclui a etapa', async () => {
    const { service, tx } = buildService({
      request: {
        steps: [
          {
            id: 'rstep-1',
            stepOrder: 1,
            status: 'IN_PROGRESS',
            requiredApprovals: 2,
            approvalsGiven: 1,
            blockSelfApproval: true,
            approverType: 'ANY_WITH_PERMISSION',
          },
        ],
      },
    });

    await service.approve('request-1', {}, ACTOR);

    expect(tx.approvalRequestStep.update.mock.calls[0][0].data.status).toBe(
      'APPROVED',
    );
  });

  it('guarda quem assinou por delegação', async () => {
    const { service, tx } = buildService({
      eligibility: {
        allowed: true,
        onBehalfOf: 'gerente',
        delegation: { id: 'del-1' },
      },
    });

    await service.approve('request-1', {}, ACTOR);

    expect(tx.approvalStepApproval.create.mock.calls[0][0].data).toMatchObject({
      approvedBy: 'user-1',
      onBehalfOf: 'gerente',
      delegationId: 'del-1',
    });
  });

  it('reprovar encerra a solicitação inteira', async () => {
    const { service, tx } = buildService();

    await service.reject('request-1', { reason: 'Fora do orçamento.' }, ACTOR);

    expect(tx.approvalRequest.update.mock.calls[0][0].data).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'Fora do orçamento.',
    });
  });

  it('solicitar ajuste devolve sem reprovar', async () => {
    const { service, tx } = buildService();

    await service.requestChanges(
      'request-1',
      { reason: 'Falta a nota.' },
      ACTOR,
    );

    expect(tx.approvalRequest.update.mock.calls[0][0].data.status).toBe(
      'WAITING_INFORMATION',
    );
    expect(tx.approvalRequestStep.update.mock.calls[0][0].data.status).toBe(
      'WAITING_INFORMATION',
    );
  });

  it('pedido de documento fica marcado como tal no comentário', async () => {
    const { service, tx } = buildService();

    await service.requestChanges(
      'request-1',
      { reason: 'Envie o contrato.' },
      ACTOR,
      { documents: true },
    );

    expect(
      tx.approvalComment.create.mock.calls[0][0].data.isDocumentRequest,
    ).toBe(true);
  });

  it('não aceita decisão em solicitação já encerrada', async () => {
    const { service } = buildService({ request: { status: 'APPROVED' } });

    await expect(service.approve('request-1', {}, ACTOR)).rejects.toThrow(
      'já foi encerrada',
    );
  });

  it('não aceita decisão sem etapa em andamento', async () => {
    const { service } = buildService({ request: { steps: [] } });

    await expect(service.approve('request-1', {}, ACTOR)).rejects.toThrow(
      'não tem etapa em andamento',
    );
  });
});

describe('Ciclo de vida', () => {
  it('cancelar exige solicitação em andamento', async () => {
    const { service } = buildService({ request: { status: 'REJECTED' } });

    await expect(
      service.cancel('request-1', { reason: 'Desistência.' }, ACTOR),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('não reinicia solicitação já aprovada', async () => {
    const { service } = buildService({ request: { status: 'APPROVED' } });

    await expect(
      service.restart('request-1', { reason: 'Mudou o valor.' }, ACTOR),
    ).rejects.toThrow('não pode ser reiniciada');
  });

  it('reiniciar encerra a anterior e abre outra', async () => {
    const { service, tx } = buildService({ flow: buildFlow([{}]) });

    await service.restart(
      'request-1',
      { reason: 'Trocou o fornecedor.' },
      ACTOR,
    );

    expect(tx.approvalRequest.update.mock.calls[0][0].data.status).toBe(
      'CANCELLED',
    );
    expect(tx.approvalRequest.create).toHaveBeenCalled();
  });

  it('só retoma solicitação que aguarda informações', async () => {
    const { service } = buildService({ request: { status: 'IN_PROGRESS' } });

    await expect(
      service.resume('request-1', { text: 'Segue a nota.' }, ACTOR),
    ).rejects.toThrow('aguardando informações');
  });

  it('hasPendingApproval enxerga apenas solicitações vivas', async () => {
    const { service, prisma } = buildService();
    prisma.approvalRequest.count.mockResolvedValue(1);

    await expect(service.hasPendingApproval('entry-1')).resolves.toBe(true);

    const where = prisma.approvalRequest.count.mock.calls[0][0].where;
    expect(where.status.in).toEqual([
      'PENDING',
      'IN_PROGRESS',
      'WAITING_INFORMATION',
    ]);
  });
});

describe('Aprovação em lote', () => {
  it('trata cada solicitação isoladamente e devolve as falhas', async () => {
    const { service } = buildService();

    jest
      .spyOn(service, 'approve')
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce(new Error('Sem alçada para este valor.'))
      .mockResolvedValueOnce({} as never);

    const result = await service.runBatch(
      { requestIds: ['a', 'b', 'c'], action: 'APPROVE' },
      ACTOR,
    );

    expect(result).toMatchObject({ succeeded: 2, total: 3 });
    expect(result.failed).toEqual([
      { id: 'b', reason: 'Sem alçada para este valor.' },
    ]);
  });

  it('uma falha não impede as demais de serem aprovadas', async () => {
    const { service } = buildService();

    jest
      .spyOn(service, 'approve')
      .mockRejectedValueOnce(new Error('Falhou.'))
      .mockResolvedValue({} as never);

    const result = await service.runBatch(
      { requestIds: ['a', 'b'], action: 'APPROVE' },
      ACTOR,
    );

    expect(result.succeeded).toBe(1);
  });
});
