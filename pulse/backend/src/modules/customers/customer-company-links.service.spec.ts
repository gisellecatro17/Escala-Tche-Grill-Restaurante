/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await -- mocks usam `any` propositalmente nos testes */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CustomerLinkStatus, Prisma } from '@prisma/client';

import { CustomerCompanyLinksService } from './customer-company-links.service';

const actor = {
  id: 'user-1',
  name: 'Usuária de Teste',
  email: 'teste@pulse.app',
  isPlatformAdmin: false,
  memberships: [],
  organizationMemberships: [],
} as any;

const actorWithCreditPermission = {
  ...actor,
  memberships: [
    {
      companyId: 'company-1',
      permissions: ['customer.view_credit_information'],
    },
  ],
};

function buildDuplicateLinkError() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: ['customer_id', 'company_id'] },
  });
}

function buildService(prismaOverrides: Record<string, unknown> = {}) {
  const prisma = {
    customer: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: 'cliente-1', organizationId: 'org-1' }),
    },
    company: { findFirst: jest.fn().mockResolvedValue({ id: 'company-1' }) },
    customerCompanyLink: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    customerContact: { findFirst: jest.fn().mockResolvedValue(null) },
    customerStatusHistory: { create: jest.fn() },
    customerContract: { create: jest.fn() },
    paymentPromise: { count: jest.fn().mockResolvedValue(0) },
    customerCollectionHistory: { count: jest.fn().mockResolvedValue(0) },
    $transaction: jest.fn(async (cb: any) => cb(prismaMock)),
    ...prismaOverrides,
  };
  const prismaMock = prisma as any;

  const audit = { log: jest.fn() } as any;
  const service = new CustomerCompanyLinksService(prismaMock, audit);
  return { service, prisma: prismaMock, audit };
}

describe('CustomerCompanyLinksService', () => {
  it('cria o vínculo como PROSPECT por padrão', async () => {
    const { service, prisma } = buildService();
    prisma.customerCompanyLink.create.mockResolvedValue({
      id: 'link-1',
      status: CustomerLinkStatus.PROSPECT,
    });

    await service.createLink('cliente-1', { companyId: 'company-1' }, actor);

    expect(prisma.customerCompanyLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: CustomerLinkStatus.PROSPECT }),
      }),
    );
  });

  it('impede vincular o mesmo cliente duas vezes à mesma empresa', async () => {
    const { service, prisma } = buildService();
    prisma.customerCompanyLink.create.mockRejectedValue(
      buildDuplicateLinkError(),
    );

    await expect(
      service.createLink('cliente-1', { companyId: 'company-1' } as any, actor),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lança NotFoundException ao consultar um vínculo inexistente', async () => {
    const { service, prisma } = buildService();
    prisma.customerCompanyLink.findFirst.mockResolvedValue(null);

    await expect(service.getLink('vinculo-inexistente')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('mascara informações de crédito quando o usuário não possui a permissão específica', async () => {
    const { service, prisma } = buildService();
    prisma.customerCompanyLink.findFirst.mockResolvedValue({
      id: 'vinculo-1',
      companyId: 'company-1',
      creditLimit: '20000.00',
      riskLevel: 'HIGH',
    });

    const result = await service.getLink('vinculo-1', actor);

    expect(result.creditLimit).toBeNull();
    expect(result.riskLevel).toBeNull();
  });

  it('não mascara informações de crédito quando o usuário possui a permissão', async () => {
    const { service, prisma } = buildService();
    prisma.customerCompanyLink.findFirst.mockResolvedValue({
      id: 'vinculo-1',
      companyId: 'company-1',
      creditLimit: '20000.00',
      riskLevel: 'HIGH',
    });

    const result = await service.getLink(
      'vinculo-1',
      actorWithCreditPermission,
    );

    expect(result.creditLimit).toBe('20000.00');
  });

  it('bloqueia a conversão de prospect quando faltam pendências mínimas', async () => {
    const { service, prisma } = buildService();
    prisma.customerCompanyLink.findFirst.mockResolvedValue({
      id: 'vinculo-1',
      companyId: 'company-1',
      customerId: 'cliente-1',
      status: CustomerLinkStatus.PROSPECT,
      defaultRevenueCategoryId: null,
      preferredPaymentMethod: null,
      billingFrequency: null,
      customer: {
        organizationId: 'org-1',
        legalName: 'Cliente Teste',
        displayName: 'Cliente Teste',
      },
    });

    await expect(
      service.convertProspect('vinculo-1', actor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('converte um prospect em cliente quando todas as pendências estão resolvidas', async () => {
    const { service, prisma } = buildService();
    prisma.customerCompanyLink.findFirst.mockResolvedValue({
      id: 'vinculo-1',
      companyId: 'company-1',
      customerId: 'cliente-1',
      status: CustomerLinkStatus.PROSPECT,
      defaultRevenueCategoryId: 'categoria-1',
      preferredPaymentMethod: 'PIX',
      billingFrequency: 'MONTHLY',
      customer: {
        organizationId: 'org-1',
        legalName: 'Cliente Teste',
        displayName: 'Cliente Teste',
      },
    });
    prisma.customerContact.findFirst.mockResolvedValue({ id: 'contato-1' });
    prisma.customerCompanyLink.update.mockResolvedValue({
      id: 'vinculo-1',
      status: CustomerLinkStatus.ACTIVE,
    });

    const result = await service.convertProspect('vinculo-1', actor);

    expect(result.status).toBe(CustomerLinkStatus.ACTIVE);
  });

  it('exige motivo ao bloquear um vínculo', async () => {
    const { service, prisma } = buildService();
    prisma.customerCompanyLink.findFirst.mockResolvedValue({
      id: 'vinculo-1',
      companyId: 'company-1',
      status: CustomerLinkStatus.ACTIVE,
      customer: { organizationId: 'org-1' },
    });

    await expect(service.block('vinculo-1', {}, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('impede um contrato com data final anterior à data inicial', async () => {
    const { service, prisma } = buildService();
    prisma.customerCompanyLink.findFirst.mockResolvedValue({
      id: 'vinculo-1',
      companyId: 'company-1',
      customer: { organizationId: 'org-1' },
    });

    await expect(
      service.addContract(
        'vinculo-1',
        { startDate: '2026-08-01', endDate: '2026-01-01' } as any,
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('impede a exclusão de um vínculo que não está em rascunho ou prospect', async () => {
    const { service, prisma } = buildService();
    prisma.customerCompanyLink.findFirst.mockResolvedValue({
      id: 'vinculo-1',
      companyId: 'company-1',
      status: CustomerLinkStatus.ACTIVE,
      customer: { organizationId: 'org-1' },
      contracts: [],
      recurringReceivables: [],
    });

    await expect(service.remove('vinculo-1', actor)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('impede duplicar o vínculo para a mesma empresa de origem', async () => {
    const { service, prisma } = buildService();
    prisma.customerCompanyLink.findFirst.mockResolvedValue({
      id: 'vinculo-1',
      companyId: 'company-1',
      customerId: 'cliente-1',
      status: CustomerLinkStatus.ACTIVE,
      customer: { organizationId: 'org-1' },
      billingRules: [],
      contracts: [],
      recurringReceivables: [],
    });

    await expect(
      service.duplicate(
        'vinculo-1',
        { targetCompanyId: 'company-1', aspects: ['REVENUE_CATEGORY'] } as any,
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
