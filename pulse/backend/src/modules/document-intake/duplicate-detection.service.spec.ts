/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment -- mocks do jest sao `any` por natureza; os testes leem mock.calls propositalmente */
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { RequestUser } from '../../common/types/authenticated-request';
import { DuplicateDetectionService } from './duplicate-detection.service';

const actor = {
  id: 'user-1',
  isPlatformAdmin: false,
  organizationMemberships: [],
  memberships: [],
} as unknown as RequestUser;

/**
 * Cenários de duplicidade das seções 25, 42 e 43.
 *
 * Pagar duas vezes o mesmo boleto é o erro mais caro de um BPO, e o mais fácil de cometer:
 * o mesmo documento chega por e-mail e por WhatsApp. Estes testes verificam que cada
 * critério pega o caso que os outros deixariam passar.
 */
describe('DuplicateDetectionService', () => {
  function buildService(
    options: {
      document?: Record<string, unknown>;
      matchesByCriterion?: Record<string, { id: string; dueDate?: Date }[]>;
    } = {},
  ) {
    const document = {
      id: 'doc-1',
      organizationId: 'org-1',
      companyId: 'company-1',
      fileHash: 'hash-atual',
      normalizedDigitableLine: null,
      normalizedBarcode: null,
      accessKey: null,
      documentNumber: null,
      documentSeries: null,
      issuerDocument: null,
      grossAmount: null,
      dueDate: null,
      originalFileName: 'boleto.pdf',
      ...options.document,
    };

    const created: Record<string, unknown>[] = [];
    let updatedDocument: Record<string, unknown> | null = null;

    /** Devolve o resultado programado para o critério que a consulta representa. */
    const findMany = jest.fn((args: { where: Record<string, unknown> }) => {
      const where = args.where;
      const matches = options.matchesByCriterion ?? {};

      if ('fileHash' in where) return Promise.resolve(matches.fileHash ?? []);
      if ('normalizedDigitableLine' in where)
        return Promise.resolve(matches.digitableLine ?? []);
      if ('normalizedBarcode' in where)
        return Promise.resolve(matches.barcode ?? []);
      if ('accessKey' in where) return Promise.resolve(matches.accessKey ?? []);
      if ('documentNumber' in where)
        return Promise.resolve(matches.documentNumber ?? []);
      if ('grossAmount' in where)
        return Promise.resolve(matches.beneficiary ?? []);
      if ('originalFileName' in where)
        return Promise.resolve(matches.fileName ?? []);
      return Promise.resolve([]);
    });

    const prisma = {
      intakeDocument: {
        findFirstOrThrow: jest.fn().mockResolvedValue(document),
        findMany,
        update: jest.fn((args: { data: Record<string, unknown> }) => {
          updatedDocument = args.data;
          return Promise.resolve({});
        }),
      },
      intakeDocumentDuplicateMatch: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn((args: { data: Record<string, unknown> }) => {
          const record = { id: `match-${created.length + 1}`, ...args.data };
          created.push(record);
          return Promise.resolve(record);
        }),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
      },
      intakeDocumentStatusHistory: { create: jest.fn() },
      intakeDocumentRelation: { create: jest.fn() },
      $transaction: jest.fn((operations: unknown[]) =>
        Promise.resolve(operations),
      ),
    };

    return {
      service: new DuplicateDetectionService(
        prisma as any,
        { log: jest.fn() } as any,
      ),
      prisma,
      created,
      getUpdatedDocument: () => updatedDocument,
    };
  }

  describe('detecção por critério', () => {
    it('hash idêntico é duplicidade exata', async () => {
      const { service } = buildService({
        matchesByCriterion: { fileHash: [{ id: 'doc-2' }] },
      });

      const result = await service.check('doc-1');

      expect(result.status).toBe('EXACT_DUPLICATE');
      expect(result.highestScore).toBe(100);
      expect(result.matches[0].matchType).toBe('FILE_HASH');
    });

    it('linha digitável idêntica é duplicidade exata mesmo com arquivo diferente', async () => {
      // Boleto reemitido: o PDF muda, o código não.
      const { service } = buildService({
        document: {
          fileHash: 'hash-novo',
          normalizedDigitableLine: '001905009540144816069',
        },
        matchesByCriterion: { digitableLine: [{ id: 'doc-2' }] },
      });

      const result = await service.check('doc-1');

      expect(result.status).toBe('EXACT_DUPLICATE');
      expect(result.matches[0].matchType).toBe('DIGITABLE_LINE');
    });

    it('chave fiscal idêntica é duplicidade exata', async () => {
      const { service } = buildService({
        document: { accessKey: '2926081234567800019955001000001234' },
        matchesByCriterion: { accessKey: [{ id: 'doc-2' }] },
      });

      const result = await service.check('doc-1');

      expect(result.matches[0].matchType).toBe('ACCESS_KEY');
      expect(result.status).toBe('EXACT_DUPLICATE');
    });

    it('número e emitente iguais dão alta probabilidade, não certeza', async () => {
      const { service } = buildService({
        document: { documentNumber: '1234', issuerDocument: '12345678000199' },
        matchesByCriterion: { documentNumber: [{ id: 'doc-2' }] },
      });

      const result = await service.check('doc-1');

      expect(result.matches[0].matchType).toBe('DOCUMENT_NUMBER');
      // 70 pontos fica na faixa de possível duplicidade, não de certeza.
      expect(result.status).toBe('POSSIBLE_DUPLICATE');
      expect(result.highestScore).toBe(70);
    });

    it('beneficiário, valor e vencimento iguais pesam mais que só valor', async () => {
      const dueDate = new Date('2026-08-10T00:00:00Z');
      const { service } = buildService({
        document: {
          issuerDocument: '12345678000199',
          grossAmount: new Prisma.Decimal(2450),
          dueDate,
        },
        matchesByCriterion: { beneficiary: [{ id: 'doc-2', dueDate }] },
      });

      const result = await service.check('doc-1');

      expect(result.matches[0].matchType).toBe('BENEFICIARY_AND_AMOUNT');
      expect(result.highestScore).toBe(65);
    });

    it('mesmo valor em vencimentos diferentes pesa pouco — é coincidência plausível', async () => {
      const { service } = buildService({
        document: {
          issuerDocument: '12345678000199',
          grossAmount: new Prisma.Decimal(389.9),
          dueDate: new Date('2026-08-10T00:00:00Z'),
        },
        matchesByCriterion: {
          beneficiary: [
            { id: 'doc-2', dueDate: new Date('2026-09-10T00:00:00Z') },
          ],
        },
      });

      const result = await service.check('doc-1');

      expect(result.matches[0].matchType).toBe('AMOUNT_AND_DUE_DATE');
      expect(result.highestScore).toBe(45);
      expect(result.status).toBe('POSSIBLE_DUPLICATE');
    });

    it('sem nenhum critério, declara que não há duplicidade', async () => {
      const { service, getUpdatedDocument } = buildService();

      const result = await service.check('doc-1');

      expect(result.status).toBe('NO_DUPLICATE');
      expect(result.matches).toHaveLength(0);
      expect(getUpdatedDocument()).toMatchObject({
        duplicateStatus: 'NO_DUPLICATE',
      });
    });

    it('ordena as suspeitas da mais forte para a mais fraca', async () => {
      const dueDate = new Date('2026-08-10T00:00:00Z');
      const { service } = buildService({
        document: {
          normalizedDigitableLine: '001905009540144816069',
          issuerDocument: '12345678000199',
          grossAmount: new Prisma.Decimal(2450),
          dueDate,
        },
        matchesByCriterion: {
          fileHash: [{ id: 'doc-2' }],
          digitableLine: [{ id: 'doc-3' }],
          beneficiary: [{ id: 'doc-4', dueDate }],
        },
      });

      const result = await service.check('doc-1');
      const scores = result.matches.map((match) => match.similarityScore);

      expect(scores).toEqual([...scores].sort((a, b) => b - a));
      expect(result.matches[0].matchType).toBe('FILE_HASH');
    });

    it('não empilha matches repetidos quando roda de novo', async () => {
      const { service, prisma } = buildService({
        matchesByCriterion: { fileHash: [{ id: 'doc-2' }] },
      });

      prisma.intakeDocumentDuplicateMatch.findFirst.mockResolvedValue({
        id: 'match-existente',
      });

      await service.check('doc-1');

      expect(prisma.intakeDocumentDuplicateMatch.create).not.toHaveBeenCalled();
      expect(prisma.intakeDocumentDuplicateMatch.update).toHaveBeenCalled();
    });

    it('procura na organização inteira, não só na empresa do documento', async () => {
      // O mesmo boleto enviado para a empresa errada continua sendo o mesmo boleto.
      const { service, prisma } = buildService({
        matchesByCriterion: { fileHash: [{ id: 'doc-2' }] },
      });

      await service.check('doc-1');

      const where = prisma.intakeDocument.findMany.mock.calls[0][0].where;
      expect(where.organizationId).toBe('org-1');
      expect(where).not.toHaveProperty('companyId');
    });

    it('ignora documentos já rejeitados', async () => {
      const { service, prisma } = buildService({
        matchesByCriterion: { fileHash: [{ id: 'doc-2' }] },
      });

      await service.check('doc-1');

      const call = prisma.intakeDocument.findMany.mock.calls[0]?.[0] as {
        where: { processingStatus: { notIn: string[] } };
      };
      const where = call.where;
      expect(where.processingStatus.notIn).toContain('REJECTED');
    });
  });

  describe('decisão humana (seção 25)', () => {
    function buildWithMatch(similarityScore: number) {
      const prisma = {
        intakeDocumentDuplicateMatch: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'match-1',
            documentId: 'doc-1',
            matchedDocumentId: 'doc-2',
            matchType: 'DIGITABLE_LINE',
            similarityScore: new Prisma.Decimal(similarityScore),
            document: { organizationId: 'org-1', companyId: 'company-1' },
          }),
          update: jest.fn().mockResolvedValue({ id: 'match-1' }),
          count: jest.fn().mockResolvedValue(0),
        },
        intakeDocument: { update: jest.fn().mockResolvedValue({}) },
        intakeDocumentStatusHistory: { create: jest.fn() },
        intakeDocumentRelation: { create: jest.fn() },
        $transaction: jest.fn((operations: unknown[]) =>
          Promise.resolve(operations),
        ),
      };

      return {
        service: new DuplicateDetectionService(
          prisma as any,
          { log: jest.fn() } as any,
        ),
        prisma,
      };
    }

    it('exige justificativa para liberar semelhança alta', async () => {
      const { service, prisma } = buildWithMatch(98);

      await expect(
        service.dismiss('doc-1', 'match-1', undefined, actor),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.intakeDocumentDuplicateMatch.update).not.toHaveBeenCalled();
    });

    it('recusa justificativa em branco', async () => {
      const { service } = buildWithMatch(98);

      await expect(
        service.dismiss('doc-1', 'match-1', '   ', actor),
      ).rejects.toThrow(BadRequestException);
    });

    it('aceita liberar semelhança baixa sem justificativa', async () => {
      const { service, prisma } = buildWithMatch(45);

      await service.dismiss('doc-1', 'match-1', undefined, actor);

      expect(prisma.intakeDocumentDuplicateMatch.update).toHaveBeenCalled();
    });

    it('libera semelhança alta com justificativa e registra o motivo', async () => {
      const { service, prisma } = buildWithMatch(98);

      await service.dismiss(
        'doc-1',
        'match-1',
        'Boletos de meses diferentes.',
        actor,
      );

      const data = prisma.intakeDocumentDuplicateMatch.update.mock.calls[0][0]
        .data as Record<string, unknown>;
      expect(data.decision).toBe('DISMISSED');
      expect(data.decisionReason).toBe('Boletos de meses diferentes.');
      expect(data.decidedBy).toBe('user-1');
    });

    it('só limpa o documento quando todas as suspeitas foram resolvidas', async () => {
      const { service, prisma } = buildWithMatch(45);
      // Ainda resta uma suspeita pendente.
      prisma.intakeDocumentDuplicateMatch.count.mockResolvedValue(1);

      await service.dismiss('doc-1', 'match-1', undefined, actor);

      expect(prisma.intakeDocument.update).not.toHaveBeenCalled();
    });

    it('confirmar duplicidade coloca o documento em DUPLICATE', async () => {
      const { service, prisma } = buildWithMatch(98);

      await service.confirm(
        'doc-1',
        'match-1',
        'Mesmo boleto reenviado.',
        actor,
      );

      const operations = prisma.$transaction.mock.calls[0][0];
      expect(operations).toHaveLength(3);
      expect(prisma.intakeDocument.update).toHaveBeenCalled();
    });

    it('substituir arquiva o anterior e grava a relação, sem excluir', async () => {
      const { service, prisma } = buildWithMatch(98);

      const result = await service.replace(
        'doc-1',
        'match-1',
        'Versão corrigida.',
        actor,
      );

      expect(result.replacedDocumentId).toBe('doc-2');
      expect(prisma.intakeDocumentRelation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ relationType: 'REPLACES' }),
        }),
      );
    });
  });

  describe('comparação lado a lado (seção 43)', () => {
    it('marca campo por campo o que é igual e o que difere', async () => {
      const prisma = {
        intakeDocumentDuplicateMatch: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'match-1',
            matchType: 'BENEFICIARY_AND_AMOUNT',
            similarityScore: new Prisma.Decimal(65),
            document: {
              originalFileName: 'boleto-agosto.pdf',
              documentType: 'BOLETO',
              issuerName: 'Coelba',
              issuerDocument: '15139629000194',
              documentNumber: '1234',
              documentSeries: null,
              accessKey: null,
              issueDate: new Date('2026-07-25T00:00:00Z'),
              dueDate: new Date('2026-08-10T00:00:00Z'),
              grossAmount: new Prisma.Decimal(2450),
              netAmount: new Prisma.Decimal(2450),
              normalizedDigitableLine: '00190000000000',
              fileHash: 'hash-a',
            },
            matchedDocument: {
              originalFileName: 'boleto-coelba.pdf',
              documentType: 'BOLETO',
              issuerName: 'Coelba',
              issuerDocument: '15139629000194',
              documentNumber: '1234',
              documentSeries: null,
              accessKey: null,
              issueDate: new Date('2026-07-25T00:00:00Z'),
              dueDate: new Date('2026-08-10T00:00:00Z'),
              grossAmount: new Prisma.Decimal(2450),
              netAmount: new Prisma.Decimal(2450),
              normalizedDigitableLine: '00190000000000',
              fileHash: 'hash-b',
            },
          }),
        },
      };

      const service = new DuplicateDetectionService(
        prisma as any,
        { log: jest.fn() } as any,
      );
      const comparison = await service.compare('doc-1', 'match-1');

      const byLabel = new Map(
        comparison.fields.map((field) => [field.label, field]),
      );
      expect(byLabel.get('Emitente')?.equal).toBe(true);
      expect(byLabel.get('Valor bruto')?.equal).toBe(true);
      expect(byLabel.get('Vencimento')?.equal).toBe(true);
      // O arquivo é outro, mas o documento é o mesmo — exatamente o caso do reenvio.
      expect(byLabel.get('Arquivo')?.equal).toBe(false);
      expect(byLabel.get('Hash do arquivo')?.equal).toBe(false);
    });

    it('informa quando a liberação vai exigir justificativa', async () => {
      const prisma = {
        intakeDocumentDuplicateMatch: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'match-1',
            matchType: 'FILE_HASH',
            similarityScore: new Prisma.Decimal(100),
            document: {},
            matchedDocument: {},
          }),
        },
      };

      const service = new DuplicateDetectionService(
        prisma as any,
        { log: jest.fn() } as any,
      );
      const comparison = await service.compare('doc-1', 'match-1');

      expect(comparison.requiresJustificationToDismiss).toBe(true);
    });
  });
});
