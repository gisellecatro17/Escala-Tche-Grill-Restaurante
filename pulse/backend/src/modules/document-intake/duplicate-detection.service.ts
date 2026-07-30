import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  IntakeDuplicateDecision,
  IntakeDuplicateMatchType,
  IntakeDuplicateStatus,
  IntakeProcessingStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from '../../common/types/authenticated-request';
import { AuditService } from '../audit/audit.service';

/**
 * Detecção de duplicidade de documentos (seções 25, 42 e 43).
 *
 * Pagar duas vezes o mesmo boleto é um dos erros mais caros de um BPO financeiro, e o mais
 * fácil de cometer: o mesmo documento chega por e-mail e por WhatsApp, ou o fornecedor
 * reenvia a fatura. Por isso a detecção usa vários critérios independentes — se um falhar
 * (o arquivo foi re-gerado, então o hash muda), outro pega.
 *
 * O serviço **classifica**, não decide. Confirmar ou liberar é sempre ação humana, e
 * liberar uma semelhança alta exige justificativa.
 */

/**
 * Peso de cada critério, em pontos de similaridade.
 *
 * Hash idêntico é prova: é literalmente o mesmo arquivo. Linha digitável idêntica também
 * é praticamente prova, porque carrega banco, valor e vencimento. Valor + vencimento
 * iguais, isoladamente, é coincidência plausível — duas contas de luz de meses diferentes
 * podem ter o mesmo valor —, então pesa pouco e só acusa em conjunto.
 */
const MATCH_WEIGHTS: Record<IntakeDuplicateMatchType, number> = {
  FILE_HASH: 100,
  DIGITABLE_LINE: 98,
  BARCODE: 97,
  ACCESS_KEY: 96,
  DOCUMENT_NUMBER: 70,
  BENEFICIARY_AND_AMOUNT: 65,
  AMOUNT_AND_DUE_DATE: 45,
  FILE_NAME: 25,
  CONTENT_SIMILARITY: 40,
  RELATED_DOCUMENT: 30,
};

/** Faixas da classificação da seção 42. */
const EXACT_THRESHOLD = 96;
const HIGH_THRESHOLD = 75;
const POSSIBLE_THRESHOLD = 40;

/** Acima disto, liberar como "não é duplicado" exige justificativa (seção 25). */
const JUSTIFICATION_THRESHOLD = 75;

export interface DuplicateCheckResult {
  status: IntakeDuplicateStatus;
  /** A maior similaridade encontrada, de 0 a 100. */
  highestScore: number;
  matches: {
    id: string;
    matchedDocumentId: string;
    matchType: IntakeDuplicateMatchType;
    similarityScore: number;
    matchingFields: string[];
  }[];
}

@Injectable()
export class DuplicateDetectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Procura duplicidades de um documento e grava os achados.
   *
   * Idempotente: chamada duas vezes não cria matches repetidos, porque cada par
   * documento/documento+critério é gravado uma única vez. Isso importa porque a etapa roda
   * dentro da fila, que pode repetir um job.
   */
  async check(documentId: string): Promise<DuplicateCheckResult> {
    const document = await this.prisma.intakeDocument.findFirstOrThrow({
      where: { id: documentId, deletedAt: null },
    });

    // O universo de comparação é a organização inteira, não só a empresa: o mesmo boleto
    // enviado para a empresa errada continua sendo o mesmo boleto, e é justamente esse
    // caso que precisa ser pego.
    const scope: Prisma.IntakeDocumentWhereInput = {
      organizationId: document.organizationId,
      deletedAt: null,
      id: { not: documentId },
      // Documento rejeitado não conta como duplicidade: já foi descartado.
      processingStatus: { notIn: [IntakeProcessingStatus.REJECTED] },
    };

    const found = new Map<
      string,
      {
        matchedDocumentId: string;
        matchType: IntakeDuplicateMatchType;
        fields: string[];
      }
    >();

    const remember = (
      matchedDocumentId: string,
      matchType: IntakeDuplicateMatchType,
      fields: string[],
    ) => {
      const key = `${matchedDocumentId}:${matchType}`;
      if (!found.has(key))
        found.set(key, { matchedDocumentId, matchType, fields });
    };

    // 1. Hash do arquivo — o critério mais forte.
    if (document.fileHash) {
      const sameFile = await this.prisma.intakeDocument.findMany({
        where: { ...scope, fileHash: document.fileHash },
        select: { id: true },
        take: 10,
      });
      for (const other of sameFile)
        remember(other.id, 'FILE_HASH', ['fileHash']);
    }

    // 2. Linha digitável e código de barras normalizados.
    if (document.normalizedDigitableLine) {
      const sameLine = await this.prisma.intakeDocument.findMany({
        where: {
          ...scope,
          normalizedDigitableLine: document.normalizedDigitableLine,
        },
        select: { id: true },
        take: 10,
      });
      for (const other of sameLine)
        remember(other.id, 'DIGITABLE_LINE', ['digitableLine']);
    }

    if (document.normalizedBarcode) {
      const sameBarcode = await this.prisma.intakeDocument.findMany({
        where: { ...scope, normalizedBarcode: document.normalizedBarcode },
        select: { id: true },
        take: 10,
      });
      for (const other of sameBarcode)
        remember(other.id, 'BARCODE', ['barcode']);
    }

    // 3. Chave fiscal — para NF-e e CT-e, é única por documento no país.
    if (document.accessKey) {
      const sameKey = await this.prisma.intakeDocument.findMany({
        where: { ...scope, accessKey: document.accessKey },
        select: { id: true },
        take: 10,
      });
      for (const other of sameKey)
        remember(other.id, 'ACCESS_KEY', ['accessKey']);
    }

    // 4. Número + série + emitente: a mesma nota do mesmo fornecedor.
    if (document.documentNumber && document.issuerDocument) {
      const sameNumber = await this.prisma.intakeDocument.findMany({
        where: {
          ...scope,
          documentNumber: document.documentNumber,
          issuerDocument: document.issuerDocument,
          ...(document.documentSeries
            ? { documentSeries: document.documentSeries }
            : {}),
        },
        select: { id: true },
        take: 10,
      });
      for (const other of sameNumber) {
        remember(other.id, 'DOCUMENT_NUMBER', [
          'documentNumber',
          'issuerDocument',
        ]);
      }
    }

    // 5. Beneficiário + valor: pega o boleto reemitido com código novo.
    if (document.issuerDocument && document.grossAmount) {
      const sameBeneficiary = await this.prisma.intakeDocument.findMany({
        where: {
          ...scope,
          issuerDocument: document.issuerDocument,
          grossAmount: document.grossAmount,
        },
        select: { id: true, dueDate: true },
        take: 10,
      });
      for (const other of sameBeneficiary) {
        // Beneficiário + valor + vencimento é bem mais forte que só os dois primeiros.
        const alsoSameDueDate =
          document.dueDate &&
          other.dueDate &&
          sameDay(document.dueDate, other.dueDate);

        remember(
          other.id,
          alsoSameDueDate ? 'BENEFICIARY_AND_AMOUNT' : 'AMOUNT_AND_DUE_DATE',
          alsoSameDueDate
            ? ['issuerDocument', 'grossAmount', 'dueDate']
            : ['issuerDocument', 'grossAmount'],
        );
      }
    }

    // 6. Nome do arquivo idêntico: sinal fraco, mas útil quando nada mais foi extraído.
    if (document.originalFileName && found.size === 0) {
      const sameName = await this.prisma.intakeDocument.findMany({
        where: { ...scope, originalFileName: document.originalFileName },
        select: { id: true },
        take: 5,
      });
      for (const other of sameName)
        remember(other.id, 'FILE_NAME', ['originalFileName']);
    }

    // Grava os achados, sem duplicar o que já existe.
    const matches: DuplicateCheckResult['matches'] = [];

    for (const entry of found.values()) {
      const score = MATCH_WEIGHTS[entry.matchType];

      const existing = await this.prisma.intakeDocumentDuplicateMatch.findFirst(
        {
          where: {
            documentId,
            matchedDocumentId: entry.matchedDocumentId,
            matchType: entry.matchType,
          },
        },
      );

      const record = existing
        ? await this.prisma.intakeDocumentDuplicateMatch.update({
            where: { id: existing.id },
            data: { similarityScore: score, matchingFields: entry.fields },
          })
        : await this.prisma.intakeDocumentDuplicateMatch.create({
            data: {
              documentId,
              matchedDocumentId: entry.matchedDocumentId,
              matchType: entry.matchType,
              similarityScore: score,
              matchingFields: entry.fields,
              status: classify(score),
            },
          });

      matches.push({
        id: record.id,
        matchedDocumentId: entry.matchedDocumentId,
        matchType: entry.matchType,
        similarityScore: score,
        matchingFields: entry.fields,
      });
    }

    const highestScore = matches.reduce(
      (highest, match) => Math.max(highest, match.similarityScore),
      0,
    );
    const status =
      matches.length === 0
        ? IntakeDuplicateStatus.NO_DUPLICATE
        : classify(highestScore);

    await this.prisma.intakeDocument.update({
      where: { id: documentId },
      data: { duplicateStatus: status },
    });

    return {
      status,
      highestScore,
      matches: matches.sort((a, b) => b.similarityScore - a.similarityScore),
    };
  }

  /** Duplicidades de um documento, com o documento comparado para a tela lado a lado. */
  findMatches(documentId: string) {
    return this.prisma.intakeDocumentDuplicateMatch.findMany({
      where: { documentId },
      orderBy: { similarityScore: 'desc' },
      include: {
        matchedDocument: {
          select: {
            id: true,
            originalFileName: true,
            documentType: true,
            documentNumber: true,
            issuerName: true,
            issuerDocument: true,
            grossAmount: true,
            netAmount: true,
            dueDate: true,
            issueDate: true,
            fileHash: true,
            normalizedDigitableLine: true,
            processingStatus: true,
            receivedAt: true,
          },
        },
      },
    });
  }

  /**
   * Comparação campo a campo entre o documento atual e o suspeito (seção 43).
   *
   * Devolve o par de valores por campo, para a tabela comparativa — em vez de só dizer
   * "são parecidos", mostra exatamente **onde** são iguais e onde diferem.
   */
  async compare(documentId: string, matchId: string) {
    const match = await this.prisma.intakeDocumentDuplicateMatch.findFirst({
      where: { id: matchId, documentId },
      include: { document: true, matchedDocument: true },
    });

    if (!match?.matchedDocument) {
      throw new NotFoundException('Comparação de duplicidade não encontrada.');
    }

    const current = match.document;
    const other = match.matchedDocument;

    const rows = [
      ['Arquivo', current.originalFileName, other.originalFileName],
      ['Tipo', current.documentType, other.documentType],
      ['Emitente', current.issuerName, other.issuerName],
      ['Documento do emitente', current.issuerDocument, other.issuerDocument],
      ['Número', current.documentNumber, other.documentNumber],
      ['Série', current.documentSeries, other.documentSeries],
      ['Chave de acesso', current.accessKey, other.accessKey],
      ['Emissão', isoDate(current.issueDate), isoDate(other.issueDate)],
      ['Vencimento', isoDate(current.dueDate), isoDate(other.dueDate)],
      [
        'Valor bruto',
        decimalToString(current.grossAmount),
        decimalToString(other.grossAmount),
      ],
      [
        'Valor líquido',
        decimalToString(current.netAmount),
        decimalToString(other.netAmount),
      ],
      [
        'Linha digitável',
        current.normalizedDigitableLine,
        other.normalizedDigitableLine,
      ],
      ['Hash do arquivo', current.fileHash, other.fileHash],
    ] as const;

    return {
      matchId: match.id,
      matchType: match.matchType,
      similarityScore: Number(match.similarityScore),
      requiresJustificationToDismiss:
        Number(match.similarityScore) >= JUSTIFICATION_THRESHOLD,
      fields: rows.map(([label, currentValue, otherValue]) => ({
        label,
        current: currentValue ?? null,
        existing: otherValue ?? null,
        equal:
          normalizeForComparison(currentValue) ===
          normalizeForComparison(otherValue),
      })),
    };
  }

  /** Confirma a duplicidade: o documento atual passa a `DUPLICATE` e não segue adiante. */
  async confirm(
    documentId: string,
    matchId: string,
    reason: string | undefined,
    actor: RequestUser,
  ) {
    const match = await this.findMatchOrThrow(documentId, matchId);

    const [record] = await this.prisma.$transaction([
      this.prisma.intakeDocumentDuplicateMatch.update({
        where: { id: match.id },
        data: {
          decision: IntakeDuplicateDecision.CONFIRMED,
          status: IntakeDuplicateStatus.CONFIRMED_DUPLICATE,
          decisionReason: reason ?? null,
          decidedBy: actor.id,
          decidedAt: new Date(),
        },
      }),
      this.prisma.intakeDocument.update({
        where: { id: documentId },
        data: {
          duplicateStatus: IntakeDuplicateStatus.CONFIRMED_DUPLICATE,
          processingStatus: IntakeProcessingStatus.DUPLICATE,
        },
      }),
      this.prisma.intakeDocumentStatusHistory.create({
        data: {
          documentId,
          newProcessingStatus: IntakeProcessingStatus.DUPLICATE,
          reason: reason ?? 'Duplicidade confirmada.',
          changedBy: actor.id,
        },
      }),
    ]);

    await this.audit.log({
      organizationId: match.document.organizationId,
      companyId: match.document.companyId,
      userId: actor.id,
      action: 'CONFIRM_INTAKE_DUPLICATE',
      entity: 'IntakeDocument',
      entityId: documentId,
      newValue: {
        matchId,
        matchType: match.matchType,
        score: Number(match.similarityScore),
      },
      reason: reason ?? null,
    });

    return record;
  }

  /**
   * Libera a suspeita: o documento **não** é duplicado e segue o fluxo.
   *
   * Quando a semelhança é alta, exige justificativa. É o ponto em que alguém assume a
   * responsabilidade de dizer "são documentos diferentes" — sem isso, a liberação seria um
   * clique sem rastro, e a detecção perderia o sentido.
   */
  async dismiss(
    documentId: string,
    matchId: string,
    reason: string | undefined,
    actor: RequestUser,
  ) {
    const match = await this.findMatchOrThrow(documentId, matchId);
    const score = Number(match.similarityScore);

    if (score >= JUSTIFICATION_THRESHOLD && !reason?.trim()) {
      throw new BadRequestException(
        'A semelhança entre os documentos é alta. Informe a justificativa para liberar como não duplicado.',
      );
    }

    const record = await this.prisma.intakeDocumentDuplicateMatch.update({
      where: { id: match.id },
      data: {
        decision: IntakeDuplicateDecision.DISMISSED,
        status: IntakeDuplicateStatus.DISMISSED,
        decisionReason: reason?.trim() ?? null,
        decidedBy: actor.id,
        decidedAt: new Date(),
      },
    });

    // O documento só volta a "sem duplicidade" quando **todas** as suspeitas foram
    // resolvidas: liberar uma de três não limpa o documento.
    const pending = await this.prisma.intakeDocumentDuplicateMatch.count({
      where: { documentId, decision: IntakeDuplicateDecision.PENDING },
    });

    if (pending === 0) {
      await this.prisma.intakeDocument.update({
        where: { id: documentId },
        data: { duplicateStatus: IntakeDuplicateStatus.DISMISSED },
      });
    }

    await this.audit.log({
      organizationId: match.document.organizationId,
      companyId: match.document.companyId,
      userId: actor.id,
      action: 'DISMISS_INTAKE_DUPLICATE',
      entity: 'IntakeDocument',
      entityId: documentId,
      newValue: { matchId, score, remainingPending: pending },
      reason: reason?.trim() ?? null,
    });

    return record;
  }

  /**
   * Substitui o documento anterior por este, mantendo o histórico.
   *
   * O anterior vai para `ARCHIVED`, não é excluído, e a relação `REPLACES` fica gravada —
   * quem olhar depois consegue reconstruir que houve substituição e qual documento saiu.
   */
  async replace(
    documentId: string,
    matchId: string,
    reason: string | undefined,
    actor: RequestUser,
  ) {
    const match = await this.findMatchOrThrow(documentId, matchId);
    if (!match.matchedDocumentId) {
      throw new BadRequestException(
        'Esta suspeita não aponta para outro documento e não pode ser substituída.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.intakeDocumentDuplicateMatch.update({
        where: { id: match.id },
        data: {
          decision: IntakeDuplicateDecision.REPLACED,
          decisionReason: reason ?? null,
          decidedBy: actor.id,
          decidedAt: new Date(),
        },
      }),
      this.prisma.intakeDocument.update({
        where: { id: match.matchedDocumentId },
        data: {
          processingStatus: IntakeProcessingStatus.ARCHIVED,
          archivedAt: new Date(),
        },
      }),
      this.prisma.intakeDocument.update({
        where: { id: documentId },
        data: { duplicateStatus: IntakeDuplicateStatus.DISMISSED },
      }),
      this.prisma.intakeDocumentRelation.create({
        data: {
          sourceDocumentId: documentId,
          targetDocumentId: match.matchedDocumentId,
          relationType: 'REPLACES',
          notes: reason ?? 'Substituição por duplicidade.',
          createdBy: actor.id,
        },
      }),
      this.prisma.intakeDocumentStatusHistory.create({
        data: {
          documentId: match.matchedDocumentId,
          newProcessingStatus: IntakeProcessingStatus.ARCHIVED,
          reason:
            `Substituído pelo documento ${documentId}. ${reason ?? ''}`.trim(),
          changedBy: actor.id,
        },
      }),
    ]);

    await this.audit.log({
      organizationId: match.document.organizationId,
      companyId: match.document.companyId,
      userId: actor.id,
      action: 'REPLACE_INTAKE_DOCUMENT',
      entity: 'IntakeDocument',
      entityId: documentId,
      oldValue: { archivedDocumentId: match.matchedDocumentId },
      reason: reason ?? null,
    });

    return { replacedDocumentId: match.matchedDocumentId };
  }

  private async findMatchOrThrow(documentId: string, matchId: string) {
    const match = await this.prisma.intakeDocumentDuplicateMatch.findFirst({
      where: { id: matchId, documentId },
      include: {
        document: { select: { organizationId: true, companyId: true } },
      },
    });

    if (!match)
      throw new NotFoundException('Suspeita de duplicidade não encontrada.');
    return match;
  }
}

// ── Auxiliares ──────────────────────────────────────────────────────────────

function classify(score: number): IntakeDuplicateStatus {
  if (score >= EXACT_THRESHOLD) return IntakeDuplicateStatus.EXACT_DUPLICATE;
  if (score >= HIGH_THRESHOLD) return IntakeDuplicateStatus.HIGH_PROBABILITY;
  if (score >= POSSIBLE_THRESHOLD)
    return IntakeDuplicateStatus.POSSIBLE_DUPLICATE;
  return IntakeDuplicateStatus.NO_DUPLICATE;
}

function sameDay(a: Date, b: Date): boolean {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

function isoDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function decimalToString(value: Prisma.Decimal | null): string | null {
  return value === null ? null : value.toFixed(2);
}

/**
 * Os valores comparados na tabela são sempre primitivos (as datas e decimais já vêm
 * convertidos para texto acima), então o tipo é explícito — `unknown` deixaria um objeto
 * passar e virar "[object Object]" na comparação.
 */
function normalizeForComparison(
  value: string | number | null | undefined,
): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
}
