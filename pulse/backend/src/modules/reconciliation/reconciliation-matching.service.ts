import { Injectable } from '@nestjs/common';
import {
  AccountsPayableInstallmentStatus,
  AccountsPayableStatus,
  BankTransactionDirection,
  MatchConfidenceLevel,
  PaymentScheduleStatus,
  Prisma,
  ReconcilableEntityType,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { cents, fromCents } from '../accounts-payable/money.util';
import { normalizeText } from './bank-transaction-normalization.service';

/** Um critério que bateu, quanto valeu e por quê. */
export interface MatchCriterion {
  criterion: string;
  points: number;
  detail: string;
}

export interface MatchCandidate {
  entityType: ReconcilableEntityType;
  entityId: string;
  /** Rótulo curto para a tela: código do título, número do documento. */
  label: string;
  description: string;
  amount: number;
  referenceDate: Date | null;
  supplierName: string | null;
  documentNumber: string | null;
}

export interface ScoredMatch extends MatchCandidate {
  score: number;
  confidenceLevel: MatchConfidenceLevel;
  criteria: MatchCriterion[];
  differenceAmount: number;
  differenceDays: number;
}

/**
 * Pesos dos critérios (seção 29).
 *
 * Ficam aqui, nomeados, em vez de espalhados em números mágicos pelo código: quando o
 * Prompt 12B tornar os pesos configuráveis, o que muda é a origem deste objeto — não a
 * lógica que o consome.
 */
export const MATCH_WEIGHTS = {
  exactAmount: 40,
  toleratedAmount: 25,
  exactDate: 20,
  nearDate: 10,
  documentNumber: 20,
  supplierName: 10,
  paymentIdentifier: 15,
  paymentMethod: 5,
} as const;

interface MatchContext {
  companyId: string;
  financialAccountId: string;
  direction: BankTransactionDirection;
  amount: number;
  transactionDate: Date;
  normalizedDescription: string;
  documentNumber: string | null;
  pixEndToEndId: string | null;
  /** Dias de folga entre a data bancária e a do lançamento. */
  dateToleranceDays: number;
  amountTolerance: number;
  percentageTolerance: number;
}

/**
 * Motor inicial de correspondência (seção 28).
 *
 * **Determinístico e auditável.** Nada de aprendizado, nada de peso ajustado sozinho: os
 * mesmos dados produzem sempre o mesmo score, e cada ponto atribuído fica registrado com o
 * motivo. Quem revisa precisa saber se a sugestão veio do valor exato ou de um nome
 * parecido — a confiança nas duas coisas é muito diferente.
 *
 * **Nada é conciliado automaticamente nesta etapa.** O motor sugere; a confirmação é
 * humana, sempre.
 */
@Injectable()
export class ReconciliationMatchingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Gera as sugestões para uma transação, ordenadas da mais provável para a menos.
   *
   * Dois critérios são **obrigatórios** e não valem ponto: mesma conta financeira e
   * sentido compatível. Um crédito conciliado contra uma conta a pagar é dinheiro
   * inventado, e nenhuma soma de pontos deveria poder produzir isso.
   */
  async findCandidates(
    context: MatchContext,
    limit = 10,
  ): Promise<ScoredMatch[]> {
    const candidates =
      context.direction === BankTransactionDirection.OUT
        ? await this.outgoingCandidates(context)
        : await this.incomingCandidates(context);

    const scored = candidates
      .map((candidate) => this.score(candidate, context))
      .filter((match) => match.score > 0)
      .sort((left, right) => right.score - left.score);

    return scored.slice(0, limit);
  }

  /**
   * Candidatos para uma **saída** bancária.
   *
   * Nesta etapa: parcelas a pagar em aberto, programações de pagamento e títulos. As
   * demais entidades da seção 27 têm o tipo declarado no enum e entram acrescentando um
   * resolvedor aqui — sem migração e sem mexer no cálculo do score.
   */
  private async outgoingCandidates(
    context: MatchContext,
  ): Promise<MatchCandidate[]> {
    const window = dateWindow(
      context.transactionDate,
      context.dateToleranceDays + 5,
    );

    const [installments, schedules] = await Promise.all([
      this.prisma.accountsPayableInstallment.findMany({
        where: {
          payable: {
            companyId: context.companyId,
            deletedAt: null,
            status: {
              notIn: [
                AccountsPayableStatus.CANCELLED,
                AccountsPayableStatus.RENEGOTIATED,
              ],
            },
          },
          status: {
            notIn: [
              AccountsPayableInstallmentStatus.CANCELLED,
              AccountsPayableInstallmentStatus.RENEGOTIATED,
            ],
          },
        },
        include: {
          payable: {
            select: {
              id: true,
              code: true,
              documentNumber: true,
              description: true,
              financialAccountId: true,
              supplier: { select: { legalName: true, tradeName: true } },
            },
          },
        },
        // A janela é sobre a data de vencimento **ou** a de pagamento: um título pago
        // com atraso tem vencimento longe da data bancária, e filtrar só por vencimento
        // esconderia justamente os atrasados — que são os que mais precisam conciliar.
        take: 400,
        orderBy: { dueDate: 'desc' },
      }),
      this.prisma.paymentSchedule.findMany({
        where: {
          companyId: context.companyId,
          deletedAt: null,
          status: {
            notIn: [PaymentScheduleStatus.CANCELLED],
          },
          scheduledDate: { gte: window.from, lte: window.to },
        },
        include: {
          payable: {
            select: {
              id: true,
              code: true,
              documentNumber: true,
              description: true,
              supplier: { select: { legalName: true, tradeName: true } },
            },
          },
        },
        take: 200,
        orderBy: { scheduledDate: 'desc' },
      }),
    ]);

    const fromInstallments = installments
      .filter((installment) => {
        // Conta correta é obrigatório. Quando o título não define conta, ele entra —
        // não definir não é o mesmo que definir outra.
        const account =
          installment.financialAccountId ??
          installment.payable.financialAccountId;
        return account === null || account === context.financialAccountId;
      })
      .filter((installment) => {
        const relevant = [installment.dueDate, installment.paidAt].filter(
          (date): date is Date => date !== null,
        );
        return relevant.some(
          (date) => date >= window.from && date <= window.to,
        );
      })
      .map<MatchCandidate>((installment) => ({
        entityType: ReconcilableEntityType.ACCOUNTS_PAYABLE_INSTALLMENT,
        entityId: installment.id,
        label: `${installment.payable.code} — parcela ${installment.installmentNumber}`,
        description: installment.payable.description ?? '',
        // Uma parcela já paga é conciliada pelo que saiu, não pelo que resta.
        amount: Number(
          cents(installment.paidAmount) > 0
            ? installment.paidAmount
            : installment.balanceAmount,
        ),
        referenceDate: installment.paidAt ?? installment.dueDate,
        supplierName:
          installment.payable.supplier?.tradeName ??
          installment.payable.supplier?.legalName ??
          null,
        documentNumber: installment.payable.documentNumber,
      }));

    const fromSchedules = schedules
      .filter(
        (schedule) =>
          schedule.financialAccountId === null ||
          schedule.financialAccountId === context.financialAccountId,
      )
      .map<MatchCandidate>((schedule) => ({
        entityType: ReconcilableEntityType.PAYMENT_SCHEDULE,
        entityId: schedule.id,
        label: `${schedule.code} — ${schedule.payable.code}`,
        description: schedule.payable.description ?? '',
        amount: Number(schedule.totalAmount),
        referenceDate: schedule.scheduledDate,
        supplierName:
          schedule.payable.supplier?.tradeName ??
          schedule.payable.supplier?.legalName ??
          null,
        documentNumber: schedule.payable.documentNumber,
      }));

    return [...fromInstallments, ...fromSchedules];
  }

  /**
   * Candidatos para uma **entrada** bancária.
   *
   * Contas a Receber ainda não existe como módulo. O que dá para casar hoje é
   * transferência interna: um crédito nesta conta contra um débito de outra conta da mesma
   * empresa. Devolver lista vazia seria mais simples e esconderia o caso mais comum de
   * entrada em empresa que ainda não fatura pelo Pulse.
   */
  private async incomingCandidates(
    context: MatchContext,
  ): Promise<MatchCandidate[]> {
    const window = dateWindow(
      context.transactionDate,
      context.dateToleranceDays,
    );

    const counterparts = await this.prisma.bankTransaction.findMany({
      where: {
        companyId: context.companyId,
        deletedAt: null,
        direction: BankTransactionDirection.OUT,
        financialAccountId: { not: context.financialAccountId },
        amount: context.amount,
        transactionDate: { gte: window.from, lte: window.to },
        reconciliationStatus: {
          in: ['IMPORTED', 'AVAILABLE', 'MATCH_SUGGESTED'],
        },
      },
      include: {
        financialAccount: { select: { name: true, displayName: true } },
      },
      take: 50,
    });

    return counterparts.map<MatchCandidate>((counterpart) => ({
      entityType: ReconcilableEntityType.INTERNAL_TRANSFER,
      entityId: counterpart.id,
      label: `Transferência de ${counterpart.financialAccount.displayName ?? counterpart.financialAccount.name}`,
      description: counterpart.originalDescription,
      amount: Number(counterpart.amount),
      referenceDate: counterpart.transactionDate,
      supplierName: null,
      documentNumber: counterpart.documentNumber,
    }));
  }

  /** Aplica os pesos e devolve o score com a memória de cálculo. */
  score(candidate: MatchCandidate, context: MatchContext): ScoredMatch {
    const criteria: MatchCriterion[] = [];

    const bankCents = cents(context.amount);
    const candidateCents = cents(candidate.amount);
    const differenceCents = Math.abs(bankCents - candidateCents);

    const toleranceCents = Math.max(
      cents(context.amountTolerance),
      Math.round((candidateCents * context.percentageTolerance) / 100),
    );

    if (differenceCents === 0) {
      criteria.push({
        criterion: 'valor exato',
        points: MATCH_WEIGHTS.exactAmount,
        detail: `Ambos os valores são ${brl(context.amount)}.`,
      });
    } else if (differenceCents <= toleranceCents && toleranceCents > 0) {
      criteria.push({
        criterion: 'valor dentro da tolerância',
        points: MATCH_WEIGHTS.toleratedAmount,
        detail: `Diferença de ${brl(fromCents(differenceCents))}, dentro da tolerância configurada.`,
      });
    }

    const differenceDays =
      candidate.referenceDate === null
        ? Number.POSITIVE_INFINITY
        : daysBetween(candidate.referenceDate, context.transactionDate);

    if (differenceDays === 0) {
      criteria.push({
        criterion: 'data exata',
        points: MATCH_WEIGHTS.exactDate,
        detail: 'A data bancária é a mesma do lançamento.',
      });
    } else if (differenceDays <= context.dateToleranceDays) {
      criteria.push({
        criterion: 'data próxima',
        points: MATCH_WEIGHTS.nearDate,
        detail: `Diferença de ${differenceDays} dia(s), dentro da tolerância.`,
      });
    }

    if (
      candidate.documentNumber &&
      context.documentNumber &&
      normalizeText(candidate.documentNumber) ===
        normalizeText(context.documentNumber)
    ) {
      criteria.push({
        criterion: 'documento igual',
        points: MATCH_WEIGHTS.documentNumber,
        detail: `Documento ${candidate.documentNumber} em ambos.`,
      });
    } else if (
      candidate.documentNumber &&
      context.normalizedDescription.includes(
        normalizeText(candidate.documentNumber),
      )
    ) {
      criteria.push({
        criterion: 'documento no histórico',
        points: MATCH_WEIGHTS.documentNumber,
        detail: `O histórico bancário cita o documento ${candidate.documentNumber}.`,
      });
    }

    if (candidate.supplierName) {
      const supplier = normalizeText(candidate.supplierName);
      const significant = supplier
        .split(' ')
        .filter((word) => word.length >= 4 && !GENERIC_WORDS.includes(word));

      const matched = significant.filter((word) =>
        context.normalizedDescription.includes(word),
      );

      if (
        matched.length > 0 &&
        matched.length >= Math.ceil(significant.length / 2)
      ) {
        criteria.push({
          criterion: 'fornecedor compatível',
          points: MATCH_WEIGHTS.supplierName,
          detail: `O histórico cita "${matched.join(' ')}", do fornecedor ${candidate.supplierName}.`,
        });
      }
    }

    if (
      context.pixEndToEndId &&
      candidate.description &&
      normalizeText(candidate.description).includes(
        normalizeText(context.pixEndToEndId),
      )
    ) {
      criteria.push({
        criterion: 'identificador PIX',
        points: MATCH_WEIGHTS.paymentIdentifier,
        detail: 'O identificador do PIX consta no lançamento.',
      });
    }

    const score = Math.min(
      100,
      criteria.reduce((total, item) => total + item.points, 0),
    );

    return {
      ...candidate,
      score,
      confidenceLevel: confidenceOf(score),
      criteria,
      differenceAmount: fromCents(bankCents - candidateCents),
      differenceDays: Number.isFinite(differenceDays) ? differenceDays : 0,
    };
  }
}

/**
 * Palavras que aparecem em quase todo nome empresarial.
 *
 * Sem esta lista, "LTDA" bateria com qualquer fornecedor e o critério de nome viraria
 * ruído puro — dez pontos distribuídos para todo mundo.
 */
const GENERIC_WORDS = [
  'LTDA',
  'MEI',
  'EIRELI',
  'COMERCIO',
  'INDUSTRIA',
  'SERVICOS',
  'DISTRIBUIDORA',
  'EMPRESA',
  'BRASIL',
  'NACIONAL',
];

export function confidenceOf(score: number): MatchConfidenceLevel {
  if (score >= 95) return MatchConfidenceLevel.VERY_HIGH;
  if (score >= 80) return MatchConfidenceLevel.HIGH;
  if (score >= 60) return MatchConfidenceLevel.MEDIUM;
  return MatchConfidenceLevel.LOW;
}

export function dateWindow(reference: Date, days: number) {
  const from = new Date(reference);
  from.setUTCDate(from.getUTCDate() - days);

  const to = new Date(reference);
  to.setUTCDate(to.getUTCDate() + days);

  return { from, to };
}

export function daysBetween(left: Date, right: Date): number {
  const a = Date.UTC(
    left.getUTCFullYear(),
    left.getUTCMonth(),
    left.getUTCDate(),
  );
  const b = Date.UTC(
    right.getUTCFullYear(),
    right.getUTCMonth(),
    right.getUTCDate(),
  );
  return Math.abs(Math.round((a - b) / 86_400_000));
}

function brl(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export type { MatchContext };
export type ReconciliationWhere = Prisma.BankTransactionWhereInput;
