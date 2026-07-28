/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument -- mocks usam `any` propositalmente nos testes */
import { ConflictException, NotFoundException } from '@nestjs/common';

import { Prisma } from '@prisma/client';
import { CompaniesService } from './companies.service';

const actor = {
  id: 'user-1',
  name: 'Usuária de Teste',
  email: 'teste@pulse.app',
  avatarUrl: null,
  isPlatformAdmin: false,
  memberships: [],
} as any;

function buildDuplicateDocumentError() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

describe('CompaniesService', () => {
  it('impede o cadastro de duas empresas com o mesmo CNPJ (duplicidade)', async () => {
    const prisma = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({ id: 'org-1' }),
      },
      company: {
        create: jest.fn().mockRejectedValue(buildDuplicateDocumentError()),
      },
    } as any;
    const audit = { log: jest.fn() } as any;

    const service = new CompaniesService(prisma, audit);

    await expect(
      service.create(
        {
          organizationId: 'org-1',
          name: 'Empresa Teste Ltda.',
          document: '11222333000181',
        } as any,
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lança NotFoundException ao consultar uma empresa inexistente', async () => {
    const prisma = {
      company: { findUnique: jest.fn().mockResolvedValue(null) },
    } as any;
    const audit = { log: jest.fn() } as any;

    const service = new CompaniesService(prisma, audit);

    await expect(service.findOne('empresa-inexistente')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
