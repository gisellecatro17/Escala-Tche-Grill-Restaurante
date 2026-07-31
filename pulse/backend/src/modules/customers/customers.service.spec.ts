/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await -- mocks usam `any` propositalmente nos testes */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CustomerSystemStatus, Prisma } from '@prisma/client';

import { CustomersService } from './customers.service';

const actorWithoutSensitiveContacts = {
  id: 'user-1',
  name: 'Usuária de Teste',
  email: 'teste@pulse.app',
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
    customer: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    customerAddress: { create: jest.fn() },
    customerContact: { create: jest.fn() },
    customerRegistryQuery: { create: jest.fn() },
    attachment: { count: jest.fn().mockResolvedValue(0) },
    $transaction: jest.fn(async (cb: any) => cb(prismaMock)),
    ...prismaOverrides,
  };
  const prismaMock = prisma as any;

  const audit = { log: jest.fn() } as any;
  const storage = { uploadDocument: jest.fn() } as any;
  const registryProvider = { name: 'mock', queryDocument: jest.fn() } as any;

  const service = new CustomersService(
    prismaMock,
    audit,
    storage,
    registryProvider,
  );
  return { service, prisma: prismaMock, audit };
}

describe('CustomersService', () => {
  it('impede o cadastro de dois clientes com o mesmo CNPJ (duplicidade)', async () => {
    const { service, prisma } = buildService();
    prisma.customer.create.mockRejectedValue(buildDuplicateDocumentError());

    await expect(
      service.create(
        {
          organizationId: 'org-1',
          personType: 'LEGAL_ENTITY',
          legalName: 'Cliente Teste Ltda.',
          displayName: 'Cliente Teste',
          documentNumber: '11222333000181',
        } as any,
        actorWithoutSensitiveContacts,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lança NotFoundException ao criar cliente em organização inexistente', async () => {
    const { service, prisma } = buildService();
    prisma.organization.findUnique.mockResolvedValue(null);

    await expect(
      service.create(
        {
          organizationId: 'org-inexistente',
          personType: 'LEGAL_ENTITY',
          legalName: 'Cliente Teste Ltda.',
          displayName: 'Cliente Teste',
          documentNumber: '11222333000181',
        } as any,
        actorWithoutSensitiveContacts,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lança NotFoundException ao consultar um cliente inexistente', async () => {
    const { service } = buildService();
    await expect(service.findOne('cliente-inexistente')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('detecta duplicidade de documento antes de consultar o provider externo', async () => {
    const { service, prisma } = buildService();
    prisma.customer.findFirst.mockResolvedValue({
      id: 'cliente-existente',
      displayName: 'Cliente já cadastrado',
      legalName: 'Cliente já cadastrado Ltda.',
      systemStatus: CustomerSystemStatus.ACTIVE,
    });

    const result = await service.queryDocument(
      { documentNumber: '11222333000181' },
      actorWithoutSensitiveContacts,
    );

    expect(result.duplicate).toBe(true);
    if (result.duplicate) {
      expect(result.customer.id).toBe('cliente-existente');
    }
  });

  it('mascara os dados de contatos sensíveis quando o usuário não possui a permissão de visualização completa', async () => {
    const { service, prisma } = buildService();
    prisma.customer.findFirst.mockResolvedValue({
      id: 'cliente-1',
      contacts: [{ phone: '75999998888', email: 'financeiro@empresa.com' }],
    });

    const result = await service.findOne(
      'cliente-1',
      actorWithoutSensitiveContacts,
    );

    expect(result.contacts[0].phone).not.toBe('75999998888');
    expect(result.contacts[0].email).not.toBe('financeiro@empresa.com');
  });

  it('impede a exclusão de um cliente que já possui vínculo com empresas', async () => {
    const { service, prisma } = buildService();
    prisma.customer.findFirst.mockResolvedValue({
      id: 'cliente-1',
      organizationId: 'org-1',
      systemStatus: CustomerSystemStatus.DRAFT,
      companyLinks: [{ id: 'link-1' }],
      contacts: [],
    });

    await expect(
      service.remove('cliente-1', actorWithoutSensitiveContacts),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('permite excluir um rascunho de cliente sem vínculos', async () => {
    const { service, prisma } = buildService();
    prisma.customer.findFirst.mockResolvedValue({
      id: 'cliente-1',
      organizationId: 'org-1',
      displayName: 'Rascunho',
      normalizedDocumentNumber: null,
      systemStatus: CustomerSystemStatus.DRAFT,
      companyLinks: [],
      contacts: [],
    });
    prisma.customer.delete.mockResolvedValue({});

    await expect(
      service.remove('cliente-1', actorWithoutSensitiveContacts),
    ).resolves.toEqual({
      id: 'cliente-1',
    });
  });
});
