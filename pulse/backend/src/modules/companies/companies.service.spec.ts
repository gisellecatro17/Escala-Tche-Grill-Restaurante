/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await -- mocks usam `any` propositalmente nos testes */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { CompanySystemStatus, Prisma } from '@prisma/client';
import { CompaniesService } from './companies.service';

const actor = {
  id: 'user-1',
  name: 'Usuária de Teste',
  email: 'teste@pulse.app',
  avatarUrl: null,
  isPlatformAdmin: false,
  memberships: [],
  organizationMemberships: [],
} as any;

function buildDuplicateDocumentError() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: ['normalized_document_number'] },
  });
}

function buildService(prismaOverrides: Record<string, unknown> = {}) {
  const prisma = {
    organization: { findUnique: jest.fn().mockResolvedValue({ id: 'org-1' }) },
    company: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    userCompanyRole: {
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn(async (cb: any) => cb(prismaMock)),
    ...prismaOverrides,
  };
  const prismaMock = prisma as any;

  const audit = { log: jest.fn() } as any;
  const storage = {
    uploadCompanyLogo: jest.fn(),
    removeCompanyLogo: jest.fn(),
  } as any;
  const registryProvider = { name: 'mock', queryDocument: jest.fn() } as any;
  const postalCodeProvider = {
    name: 'mock',
    queryPostalCode: jest.fn(),
  } as any;

  const service = new CompaniesService(
    prismaMock,
    audit,
    storage,
    registryProvider,
    postalCodeProvider,
  );
  return { service, prisma: prismaMock, audit };
}

describe('CompaniesService', () => {
  it('impede o cadastro de duas empresas com o mesmo CNPJ (duplicidade)', async () => {
    const { service, prisma } = buildService();
    prisma.company.create.mockRejectedValue(buildDuplicateDocumentError());

    await expect(
      service.create(
        {
          organizationId: 'org-1',
          personType: 'LEGAL_ENTITY',
          legalName: 'Empresa Teste Ltda.',
          displayName: 'Empresa Teste',
          documentNumber: '11222333000181',
        } as any,
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lança NotFoundException ao consultar uma empresa inexistente', async () => {
    const { service } = buildService();
    await expect(service.findOne('empresa-inexistente')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lança NotFoundException ao criar empresa em organização inexistente', async () => {
    const { service, prisma } = buildService();
    prisma.organization.findUnique.mockResolvedValue(null);

    await expect(
      service.create(
        {
          organizationId: 'org-inexistente',
          personType: 'LEGAL_ENTITY',
          legalName: 'Empresa Teste Ltda.',
          displayName: 'Empresa Teste',
          documentNumber: '11222333000181',
        } as any,
        actor,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lista as pendências que impedem a ativação de uma empresa incompleta', async () => {
    const { service, prisma } = buildService();
    prisma.company.findFirst.mockResolvedValue({
      id: 'company-1',
      normalizedDocumentNumber: null,
      legalName: null,
      displayName: null,
      organizationId: 'org-1',
      addresses: [],
      currencyCode: 'BRL',
      timezone: 'America/Bahia',
    });

    const pendencies = await service.getActivationPendencies('company-1');

    expect(pendencies).toContain('Documento (CPF/CNPJ) válido.');
    expect(pendencies).toContain('Razão social ou nome.');
    expect(pendencies).toContain('Nome de exibição.');
    expect(pendencies).toContain('Endereço principal.');
    expect(pendencies).toContain('Usuário administrador vinculado.');
  });

  it('bloqueia a ativação quando existem pendências', async () => {
    const { service, prisma } = buildService();
    prisma.company.findFirst.mockResolvedValue({
      id: 'company-1',
      normalizedDocumentNumber: null,
      legalName: null,
      displayName: null,
      organizationId: 'org-1',
      addresses: [],
      currencyCode: 'BRL',
      timezone: 'America/Bahia',
      systemStatus: CompanySystemStatus.DRAFT,
    });

    await expect(service.activate('company-1', actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('impede a exclusão de uma empresa que não está em rascunho', async () => {
    const { service, prisma } = buildService();
    prisma.company.findFirst.mockResolvedValue({
      id: 'company-1',
      organizationId: 'org-1',
      systemStatus: CompanySystemStatus.ACTIVE,
      addresses: [],
    });

    await expect(service.remove('company-1', actor)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('impede a exclusão de um rascunho que já possui usuários vinculados', async () => {
    const { service, prisma } = buildService();
    prisma.company.findFirst.mockResolvedValue({
      id: 'company-1',
      organizationId: 'org-1',
      systemStatus: CompanySystemStatus.DRAFT,
      addresses: [],
    });
    prisma.userCompanyRole.count.mockResolvedValue(1);

    await expect(service.remove('company-1', actor)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('permite excluir um rascunho sem vínculos', async () => {
    const { service, prisma } = buildService();
    prisma.company.findFirst.mockResolvedValue({
      id: 'company-1',
      organizationId: 'org-1',
      displayName: 'Rascunho',
      normalizedDocumentNumber: null,
      systemStatus: CompanySystemStatus.DRAFT,
      addresses: [],
    });
    prisma.company.count.mockResolvedValue(0);
    prisma.userCompanyRole.count.mockResolvedValue(0);
    prisma.company.delete.mockResolvedValue({});

    await expect(service.remove('company-1', actor)).resolves.toEqual({
      id: 'company-1',
    });
    expect(prisma.company.delete).toHaveBeenCalledWith({
      where: { id: 'company-1' },
    });
  });

  it('detecta duplicidade de documento antes de consultar o provider externo', async () => {
    const { service, prisma } = buildService();
    prisma.company.findFirst.mockResolvedValue({
      id: 'company-existente',
      displayName: 'Empresa já cadastrada',
      systemStatus: CompanySystemStatus.ACTIVE,
    });

    const result = await service.queryDocument(
      { documentNumber: '11222333000181' },
      actor,
    );

    expect(result.duplicate).toBe(true);
    if (result.duplicate) {
      expect(result.company.id).toBe('company-existente');
    }
  });
});
