/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await -- mocks usam `any` propositalmente nos testes */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SupplierSystemStatus } from '@prisma/client';

import { SuppliersService } from './suppliers.service';

const actorWithoutBankPermission = {
  id: 'user-1',
  name: 'Usuária de Teste',
  email: 'teste@pulse.app',
  isPlatformAdmin: false,
  memberships: [],
  organizationMemberships: [],
} as any;

const actorWithThirdPartyPermission = {
  ...actorWithoutBankPermission,
  id: 'user-2',
  memberships: [
    {
      companyId: 'company-1',
      permissions: [
        'supplier.allow_third_party_bank_account',
        'supplier.view_bank_data',
      ],
    },
  ],
};

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
    supplier: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    supplierBankAccount: { create: jest.fn(), update: jest.fn() },
    supplierPixKey: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    },
    supplierStatusHistory: { create: jest.fn() },
    supplierRegistryQuery: { create: jest.fn() },
    attachment: { count: jest.fn().mockResolvedValue(0) },
    $transaction: jest.fn(async (cb: any) => cb(prismaMock)),
    ...prismaOverrides,
  };
  const prismaMock = prisma as any;

  const audit = { log: jest.fn() } as any;
  const storage = { uploadDocument: jest.fn() } as any;
  const registryProvider = { name: 'mock', queryDocument: jest.fn() } as any;

  const service = new SuppliersService(
    prismaMock,
    audit,
    storage,
    registryProvider,
  );
  return { service, prisma: prismaMock, audit };
}

describe('SuppliersService', () => {
  it('impede o cadastro de dois fornecedores com o mesmo CNPJ (duplicidade)', async () => {
    const { service, prisma } = buildService();
    prisma.supplier.create.mockRejectedValue(buildDuplicateDocumentError());

    await expect(
      service.create(
        {
          organizationId: 'org-1',
          personType: 'LEGAL_ENTITY',
          legalName: 'Fornecedor Teste Ltda.',
          displayName: 'Fornecedor Teste',
          documentNumber: '11222333000181',
        } as any,
        actorWithoutBankPermission,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lança NotFoundException ao criar fornecedor em organização inexistente', async () => {
    const { service, prisma } = buildService();
    prisma.organization.findUnique.mockResolvedValue(null);

    await expect(
      service.create(
        {
          organizationId: 'org-inexistente',
          personType: 'LEGAL_ENTITY',
          legalName: 'Fornecedor Teste Ltda.',
          displayName: 'Fornecedor Teste',
          documentNumber: '11222333000181',
        } as any,
        actorWithoutBankPermission,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lança NotFoundException ao consultar um fornecedor inexistente', async () => {
    const { service } = buildService();
    await expect(
      service.findOne('fornecedor-inexistente'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('detecta duplicidade de documento antes de consultar o provider externo', async () => {
    const { service, prisma } = buildService();
    prisma.supplier.findFirst.mockResolvedValue({
      id: 'fornecedor-existente',
      displayName: 'Fornecedor já cadastrado',
      legalName: 'Fornecedor já cadastrado Ltda.',
      systemStatus: SupplierSystemStatus.ACTIVE,
    });

    const result = await service.queryDocument(
      { documentNumber: '11222333000181' },
      actorWithoutBankPermission,
    );

    expect(result.duplicate).toBe(true);
    if (result.duplicate) {
      expect(result.supplier.id).toBe('fornecedor-existente');
    }
  });

  it('mascara os dados bancários quando o usuário não possui a permissão de visualização completa', async () => {
    const { service, prisma } = buildService();
    prisma.supplier.findFirst.mockResolvedValue({
      id: 'fornecedor-1',
      bankAccounts: [
        {
          branchNumber: '1234',
          accountNumber: '567894',
          holderDocument: '11222333000181',
        },
      ],
      pixKeys: [
        { pixKey: 'financeiro@empresa.com', holderDocument: '11222333000181' },
      ],
    });

    const result = await service.findOne(
      'fornecedor-1',
      actorWithoutBankPermission,
    );

    expect(result.bankAccounts[0].accountNumber).not.toBe('567894');
    expect(result.bankAccounts[0].accountNumber.endsWith('4')).toBe(true);
    expect(result.pixKeys[0].pixKey).not.toBe('financeiro@empresa.com');
  });

  it('exige confirmação de conta de terceiro quando o titular difere do fornecedor', async () => {
    const { service, prisma } = buildService();
    prisma.supplier.findFirst.mockResolvedValue({
      id: 'fornecedor-1',
      organizationId: 'org-1',
      normalizedDocumentNumber: '11222333000181',
      bankAccounts: [],
      pixKeys: [],
    });

    await expect(
      service.addBankAccount(
        'fornecedor-1',
        {
          branchNumber: '1234',
          accountNumber: '56789',
          accountType: 'CHECKING',
          holderName: 'João da Silva',
          holderDocument: '98765432100',
        } as any,
        actorWithoutBankPermission,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('bloqueia conta de terceiro quando o usuário não possui a permissão específica', async () => {
    const { service, prisma } = buildService();
    prisma.supplier.findFirst.mockResolvedValue({
      id: 'fornecedor-1',
      organizationId: 'org-1',
      normalizedDocumentNumber: '11222333000181',
      bankAccounts: [],
      pixKeys: [],
    });

    await expect(
      service.addBankAccount(
        'fornecedor-1',
        {
          branchNumber: '1234',
          accountNumber: '56789',
          accountType: 'CHECKING',
          holderName: 'João da Silva',
          holderDocument: '98765432100',
          isThirdParty: true,
          thirdPartyReason: 'Pagamento autorizado ao representante legal.',
        } as any,
        actorWithoutBankPermission,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('permite conta de terceiro quando o usuário possui a permissão específica', async () => {
    const { service, prisma } = buildService();
    prisma.supplier.findFirst.mockResolvedValue({
      id: 'fornecedor-1',
      organizationId: 'org-1',
      normalizedDocumentNumber: '11222333000181',
      bankAccounts: [],
      pixKeys: [],
    });
    prisma.supplierBankAccount.create.mockResolvedValue({
      id: 'conta-1',
      isThirdParty: true,
    });

    const result = await service.addBankAccount(
      'fornecedor-1',
      {
        branchNumber: '1234',
        accountNumber: '56789',
        accountType: 'CHECKING',
        holderName: 'João da Silva',
        holderDocument: '98765432100',
        isThirdParty: true,
        thirdPartyReason: 'Pagamento autorizado ao representante legal.',
      } as any,
      actorWithThirdPartyPermission,
    );

    expect(result.id).toBe('conta-1');
  });

  it('impede o cadastro de uma chave PIX já vinculada a outro fornecedor', async () => {
    const { service, prisma } = buildService();
    prisma.supplier.findFirst.mockResolvedValue({
      id: 'fornecedor-1',
      organizationId: 'org-1',
      normalizedDocumentNumber: '11222333000181',
      bankAccounts: [],
      pixKeys: [],
    });
    prisma.supplierPixKey.findFirst.mockResolvedValue({
      id: 'pix-1',
      supplierId: 'outro-fornecedor',
      supplier: {
        displayName: 'Outro Fornecedor',
        legalName: 'Outro Fornecedor Ltda.',
      },
    });

    await expect(
      service.addPixKey(
        'fornecedor-1',
        {
          pixType: 'CNPJ',
          pixKey: '11222333000181',
          holderName: 'Fornecedor Teste',
          holderDocument: '11222333000181',
        } as any,
        actorWithoutBankPermission,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('impede a exclusão de um fornecedor que já possui vínculo com empresas', async () => {
    const { service, prisma } = buildService();
    prisma.supplier.findFirst.mockResolvedValue({
      id: 'fornecedor-1',
      organizationId: 'org-1',
      systemStatus: SupplierSystemStatus.DRAFT,
      companyLinks: [{ id: 'link-1' }],
      bankAccounts: [],
      pixKeys: [],
    });

    await expect(
      service.remove('fornecedor-1', actorWithoutBankPermission),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('permite excluir um rascunho de fornecedor sem vínculos', async () => {
    const { service, prisma } = buildService();
    prisma.supplier.findFirst.mockResolvedValue({
      id: 'fornecedor-1',
      organizationId: 'org-1',
      displayName: 'Rascunho',
      normalizedDocumentNumber: null,
      systemStatus: SupplierSystemStatus.DRAFT,
      companyLinks: [],
      bankAccounts: [],
      pixKeys: [],
    });
    prisma.supplier.delete.mockResolvedValue({});

    await expect(
      service.remove('fornecedor-1', actorWithoutBankPermission),
    ).resolves.toEqual({
      id: 'fornecedor-1',
    });
  });
});
