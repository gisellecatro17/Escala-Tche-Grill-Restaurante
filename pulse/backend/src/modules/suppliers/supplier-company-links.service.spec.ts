/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await -- mocks usam `any` propositalmente nos testes */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SupplierLinkStatus } from '@prisma/client';

import { SupplierCompanyLinksService } from './supplier-company-links.service';

const actor = {
  id: 'user-1',
  name: 'Usuária de Teste',
  email: 'teste@pulse.app',
} as any;

function buildDuplicateLinkError() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: ['supplier_id', 'company_id'] },
  });
}

function buildService(prismaOverrides: Record<string, unknown> = {}) {
  const prisma = {
    supplier: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: 'fornecedor-1', organizationId: 'org-1' }),
    },
    company: { findFirst: jest.fn().mockResolvedValue({ id: 'company-1' }) },
    supplierCompanyLink: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    supplierStatusHistory: { create: jest.fn() },
    supplierDefaultAllocation: { create: jest.fn() },
    $transaction: jest.fn(async (cb: any) => cb(prismaMock)),
    ...prismaOverrides,
  };
  const prismaMock = prisma as any;

  const audit = { log: jest.fn() } as any;
  const service = new SupplierCompanyLinksService(prismaMock, audit);
  return { service, prisma: prismaMock, audit };
}

describe('SupplierCompanyLinksService', () => {
  it('impede vincular o mesmo fornecedor duas vezes à mesma empresa', async () => {
    const { service, prisma } = buildService();
    prisma.supplierCompanyLink.create.mockRejectedValue(
      buildDuplicateLinkError(),
    );

    await expect(
      service.createLink(
        'fornecedor-1',
        { companyId: 'company-1' } as any,
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lança NotFoundException ao consultar um vínculo inexistente', async () => {
    const { service, prisma } = buildService();
    prisma.supplierCompanyLink.findFirst.mockResolvedValue(null);

    await expect(service.getLink('vinculo-inexistente')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('exige motivo ao bloquear um vínculo', async () => {
    const { service, prisma } = buildService();
    prisma.supplierCompanyLink.findFirst.mockResolvedValue({
      id: 'vinculo-1',
      companyId: 'company-1',
      status: SupplierLinkStatus.ACTIVE,
      supplier: { organizationId: 'org-1' },
    });

    await expect(service.block('vinculo-1', {}, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('valida que a soma dos rateios não ultrapasse 100%', async () => {
    const { service, prisma } = buildService();
    prisma.supplierCompanyLink.findFirst.mockResolvedValue({
      id: 'vinculo-1',
      companyId: 'company-1',
      status: SupplierLinkStatus.ACTIVE,
      supplier: { organizationId: 'org-1' },
      allocations: [
        { allocationType: 'PERCENTAGE', percentage: 70, status: 'ACTIVE' },
      ],
    });

    await expect(
      service.addAllocation(
        'vinculo-1',
        { allocationType: 'PERCENTAGE', percentage: 40 } as any,
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('permite um rateio percentual quando a soma não ultrapassa 100%', async () => {
    const { service, prisma } = buildService();
    prisma.supplierCompanyLink.findFirst.mockResolvedValue({
      id: 'vinculo-1',
      companyId: 'company-1',
      status: SupplierLinkStatus.ACTIVE,
      supplier: { organizationId: 'org-1' },
      allocations: [
        { allocationType: 'PERCENTAGE', percentage: 70, status: 'ACTIVE' },
      ],
    });
    prisma.supplierDefaultAllocation.create.mockResolvedValue({
      id: 'rateio-1',
    });

    const result = await service.addAllocation(
      'vinculo-1',
      { allocationType: 'PERCENTAGE', percentage: 30 } as any,
      actor,
    );

    expect(result.id).toBe('rateio-1');
  });

  it('impede a exclusão de um vínculo que não está em rascunho', async () => {
    const { service, prisma } = buildService();
    prisma.supplierCompanyLink.findFirst.mockResolvedValue({
      id: 'vinculo-1',
      companyId: 'company-1',
      status: SupplierLinkStatus.ACTIVE,
      supplier: { organizationId: 'org-1' },
      contracts: [],
    });

    await expect(service.remove('vinculo-1', actor)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('impede duplicar o vínculo para a mesma empresa de origem', async () => {
    const { service, prisma } = buildService();
    prisma.supplierCompanyLink.findFirst.mockResolvedValue({
      id: 'vinculo-1',
      companyId: 'company-1',
      supplierId: 'fornecedor-1',
      status: SupplierLinkStatus.ACTIVE,
      supplier: { organizationId: 'org-1' },
      taxWithholdings: [],
      allocations: [],
      contracts: [],
    });

    await expect(
      service.duplicate(
        'vinculo-1',
        { targetCompanyId: 'company-1', aspects: ['DEFAULT_CATEGORY'] } as any,
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
