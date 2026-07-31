import { Injectable } from '@nestjs/common';
import {
  BankStatementImportStatus,
  BankTransactionDirection,
  DuplicateStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { cents } from '../accounts-payable/money.util';
import type { ParsedTransaction } from './parsers/parsed-statement';

export interface FileDuplicateDiagnosis {
  status: DuplicateStatus;
  /** Importação anterior que se parece com esta, quando há uma. */
  previousImportId: string | null;
  previousFileName: string | null;
  previousImportedAt: Date | null;
  previousImportedBy: string | null;
  reasons: string[];
}

export interface TransactionDuplicateDiagnosis {
  status: DuplicateStatus;
  duplicateOfTransactionId: string | null;
  reasons: string[];
}

/** Importações que já colocaram transações no sistema. */
const LIVE_IMPORT_STATUSES: BankStatementImportStatus[] = [
  BankStatementImportStatus.IMPORTED,
  BankStatementImportStatus.PARTIALLY_IMPORTED,
  BankStatementImportStatus.REPROCESSED,
  BankStatementImportStatus.ARCHIVED,
];

/**
 * Detecção de duplicidade (seções 22 e 23).
 *
 * **Nada é bloqueado por um critério só.** Hash igual é certeza; mesmo valor no mesmo dia
 * é suspeita. Tratar os dois do mesmo jeito faria o sistema recusar tarifas legítimas que
 * se repetem — que é o caso mais comum de falso positivo em extrato bancário.
 */
@Injectable()
export class ReconciliationDuplicateService {
  constructor(private readonly prisma: PrismaService) {}

  /** O arquivo já foi importado nesta conta? */
  async checkFile(input: {
    companyId: string;
    financialAccountId: string;
    fileHash: string | null;
    fileName: string | null;
    startDate: Date | null;
    endDate: Date | null;
    transactionCount: number;
    ignoreImportId?: string;
  }): Promise<FileDuplicateDiagnosis> {
    const base: Prisma.BankStatementImportWhereInput = {
      companyId: input.companyId,
      financialAccountId: input.financialAccountId,
      deletedAt: null,
      status: { in: LIVE_IMPORT_STATUSES },
      ...(input.ignoreImportId ? { NOT: { id: input.ignoreImportId } } : {}),
    };

    // Hash igual: é o mesmo arquivo, byte a byte. Não há dúvida a resolver.
    if (input.fileHash) {
      const sameHash = await this.prisma.bankStatementImport.findFirst({
        where: { ...base, fileHash: input.fileHash },
        orderBy: { importedAt: 'desc' },
        select: {
          id: true,
          originalFileName: true,
          importedAt: true,
          importedBy: true,
        },
      });

      if (sameHash) {
        return {
          status: DuplicateStatus.EXACT,
          previousImportId: sameHash.id,
          previousFileName: sameHash.originalFileName,
          previousImportedAt: sameHash.importedAt,
          previousImportedBy: sameHash.importedBy,
          reasons: [
            'O conteúdo do arquivo é idêntico ao de uma importação anterior.',
          ],
        };
      }
    }

    if (!input.startDate || !input.endDate) {
      return notDuplicate();
    }

    // Período sobreposto: o arquivo é outro, mas cobre dias que já foram importados.
    const overlapping = await this.prisma.bankStatementImport.findFirst({
      where: {
        ...base,
        statementStartDate: { lte: input.endDate },
        statementEndDate: { gte: input.startDate },
      },
      orderBy: { importedAt: 'desc' },
      select: {
        id: true,
        originalFileName: true,
        importedAt: true,
        importedBy: true,
        statementStartDate: true,
        statementEndDate: true,
        transactionCount: true,
      },
    });

    if (!overlapping) return notDuplicate();

    const reasons = [
      'O período deste arquivo se sobrepõe ao de uma importação anterior.',
    ];

    const sameWindow =
      overlapping.statementStartDate?.getTime() === input.startDate.getTime() &&
      overlapping.statementEndDate?.getTime() === input.endDate.getTime();

    if (sameWindow) {
      reasons.push('O período é exatamente o mesmo.');
    }

    if (overlapping.transactionCount === input.transactionCount) {
      reasons.push('A quantidade de transações é a mesma.');
    }

    if (
      input.fileName &&
      overlapping.originalFileName &&
      input.fileName.toLowerCase() ===
        overlapping.originalFileName.toLowerCase()
    ) {
      reasons.push('O nome do arquivo é o mesmo.');
    }

    return {
      // Período idêntico **e** mesma contagem já é praticamente certeza; sobreposição
      // parcial é só um alerta — extratos por quinzena se sobrepõem legitimamente.
      status:
        sameWindow && overlapping.transactionCount === input.transactionCount
          ? DuplicateStatus.HIGH_PROBABILITY
          : DuplicateStatus.POSSIBLE,
      previousImportId: overlapping.id,
      previousFileName: overlapping.originalFileName,
      previousImportedAt: overlapping.importedAt,
      previousImportedBy: overlapping.importedBy,
      reasons,
    };
  }

  /**
   * Esta transação já existe na conta?
   *
   * O identificador bancário é forte, mas **não** decide sozinho: há bancos que repetem o
   * FITID entre extratos do mesmo mês. Sem os outros critérios, uma tarifa repetida seria
   * classificada como duplicada e sumiria do extrato.
   */
  async checkTransaction(input: {
    companyId: string;
    financialAccountId: string;
    transaction: ParsedTransaction;
    direction: BankTransactionDirection;
    amount: number;
    normalizedDescription: string;
    ignoreImportId?: string;
  }): Promise<TransactionDuplicateDiagnosis> {
    const { transaction } = input;

    if (!transaction.transactionDate) return notDuplicateTransaction();

    const externalId = transaction.fitId ?? transaction.externalTransactionId;

    if (externalId) {
      const sameId = await this.prisma.bankTransaction.findFirst({
        where: {
          companyId: input.companyId,
          financialAccountId: input.financialAccountId,
          deletedAt: null,
          OR: [{ fitId: externalId }, { externalTransactionId: externalId }],
          ...(input.ignoreImportId
            ? { NOT: { statementImportId: input.ignoreImportId } }
            : {}),
        },
        select: { id: true, amount: true, transactionDate: true },
      });

      if (sameId) {
        const sameAmount = cents(sameId.amount) === cents(input.amount);
        const sameDate =
          sameId.transactionDate.getTime() ===
          transaction.transactionDate.getTime();

        return {
          status:
            sameAmount && sameDate
              ? DuplicateStatus.EXACT
              : DuplicateStatus.HIGH_PROBABILITY,
          duplicateOfTransactionId: sameId.id,
          reasons: [
            'Já existe uma transação com o mesmo identificador bancário nesta conta.',
            ...(sameAmount ? ['O valor é o mesmo.'] : ['O valor é diferente.']),
            ...(sameDate ? ['A data é a mesma.'] : ['A data é diferente.']),
          ],
        };
      }
    }

    // Sem identificador: valor, data e sentido iguais é suspeita, não certeza.
    const similar = await this.prisma.bankTransaction.findMany({
      where: {
        companyId: input.companyId,
        financialAccountId: input.financialAccountId,
        deletedAt: null,
        amount: input.amount,
        direction: input.direction,
        transactionDate: transaction.transactionDate,
        ...(input.ignoreImportId
          ? { NOT: { statementImportId: input.ignoreImportId } }
          : {}),
      },
      select: {
        id: true,
        normalizedDescription: true,
        documentNumber: true,
      },
      take: 5,
    });

    if (similar.length === 0) return notDuplicateTransaction();

    const sameDescription = similar.find(
      (candidate) =>
        candidate.normalizedDescription === input.normalizedDescription,
    );

    if (sameDescription) {
      return {
        status: DuplicateStatus.HIGH_PROBABILITY,
        duplicateOfTransactionId: sameDescription.id,
        reasons: [
          'Já existe uma transação com o mesmo valor, data, sentido e histórico nesta conta.',
        ],
      };
    }

    const sameDocument =
      transaction.documentNumber !== null &&
      similar.find(
        (candidate) => candidate.documentNumber === transaction.documentNumber,
      );

    if (sameDocument) {
      return {
        status: DuplicateStatus.HIGH_PROBABILITY,
        duplicateOfTransactionId: sameDocument.id,
        reasons: [
          'Já existe uma transação com o mesmo valor, data e número de documento nesta conta.',
        ],
      };
    }

    return {
      status: DuplicateStatus.POSSIBLE,
      duplicateOfTransactionId: similar[0].id,
      reasons: [
        'Existe uma transação com o mesmo valor, data e sentido nesta conta, mas com histórico diferente.',
      ],
    };
  }
}

function notDuplicate(): FileDuplicateDiagnosis {
  return {
    status: DuplicateStatus.NOT_DUPLICATE,
    previousImportId: null,
    previousFileName: null,
    previousImportedAt: null,
    previousImportedBy: null,
    reasons: [],
  };
}

function notDuplicateTransaction(): TransactionDuplicateDiagnosis {
  return {
    status: DuplicateStatus.NOT_DUPLICATE,
    duplicateOfTransactionId: null,
    reasons: [],
  };
}
