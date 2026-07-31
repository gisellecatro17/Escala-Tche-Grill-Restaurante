import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AccountsPayableAdjustmentSource,
  AccountsPayableAdjustmentType,
  AccountsPayableEntryStatus,
  AccountsPayableHistoryAction,
  AccountsPayableInstallmentStatus,
  AccountsPayableStatus,
  Prisma,
  SupplierAdvanceStatus,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '../../common/dto/pagination-query.dto';
import type { RequestActor } from '../../common/decorators/current-actor.decorator';
import { AuditService } from '../audit/audit.service';
import { PayableBalanceService } from './payable-balance.service';
import { cents, fromCents, sum } from './money.util';
import type {
  AdjustmentDto,
  AdvanceQueryDto,
  ApplyAdvanceDto,
  CreateAdvanceDto,
  PartialPaymentDto,
  RenegotiateDto,
  ReasonDto,
} from './dto/accounts-payable.dto';

/**
 * Situações em que o título não recebe mais movimento financeiro.
 *
 * Cancelado e renegociado são decisões: aceitar pagamento neles produziria dinheiro saindo
 * contra uma obrigação que a empresa declarou não existir mais.
 */
const CLOSED_FOR_MOVEMENT: AccountsPayableStatus[] = [
  AccountsPayableStatus.CANCELLED,
  AccountsPayableStatus.RENEGOTIATED,
];

/** Parcelas que ainda podem receber pagamento ou ajuste. */
const LIVE_INSTALLMENTS: AccountsPayableInstallmentStatus[] = [
  AccountsPayableInstallmentStatus.OPEN,
  AccountsPayableInstallmentStatus.SCHEDULED,
  AccountsPayableInstallmentStatus.BANK_SCHEDULED,
  AccountsPayableInstallmentStatus.AWAITING_PAYMENT,
  AccountsPayableInstallmentStatus.PARTIALLY_PAID,
  AccountsPayableInstallmentStatus.REVERSED,
];

/**
 * Movimento financeiro do título: baixa, ajuste, renegociação e adiantamento.
 *
 * Nada aqui **executa** pagamento. Registrar a baixa é dizer "isto já saiu do caixa"; quem
 * vai mandar a ordem para o banco é o módulo de Pagamentos, que ainda não existe — e quando
 * existir vai gravar exatamente nestas mesmas linhas.
 */
@Injectable()
export class PayableSettlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly balance: PayableBalanceService,
  ) {}

  // ── Pagamentos parciais (seção 8) ─────────────────────────────────────────

  /**
   * Registra uma baixa, total ou parcial.
   *
   * Sem `installmentId` o valor é distribuído pelas parcelas em aberto, da mais antiga para
   * a mais nova — que é como o dinheiro efetivamente é aplicado quando o fornecedor recebe
   * um valor "por conta" sem dizer qual parcela quitou.
   */
  async registerPayment(
    id: string,
    dto: PartialPaymentDto,
    actor: RequestActor,
  ) {
    const payable = await this.loadForMovement(id);

    const settings = await this.prisma.accountsPayableSettings.findUnique({
      where: { companyId: payable.companyId },
    });

    const amountCents = cents(dto.amount);
    const balanceCents = cents(payable.balanceAmount);

    if (balanceCents === 0) {
      throw new BadRequestException('Este título não tem saldo em aberto.');
    }

    if (amountCents > balanceCents) {
      throw new BadRequestException(
        `O pagamento de ${brl(dto.amount)} é maior que o saldo de ${brl(Number(payable.balanceAmount))}.`,
      );
    }

    if (
      settings &&
      !settings.allowPartialPayment &&
      amountCents < balanceCents
    ) {
      throw new BadRequestException(
        'A empresa não permite baixa parcial. Registre o valor total do saldo.',
      );
    }

    const targets = dto.installmentId
      ? [this.installmentOf(payable, dto.installmentId)]
      : payable.installments
          .filter(
            (installment) =>
              LIVE_INSTALLMENTS.includes(installment.status) &&
              cents(installment.balanceAmount) > 0,
          )
          .sort(
            (left, right) => left.dueDate.getTime() - right.dueDate.getTime(),
          );

    if (targets.length === 0) {
      throw new BadRequestException(
        'Não há parcela em aberto para receber o pagamento.',
      );
    }

    if (dto.installmentId) {
      const target = targets[0];
      if (amountCents > cents(target.balanceAmount)) {
        throw new BadRequestException(
          `O pagamento é maior que o saldo da parcela ${target.installmentNumber} (${brl(Number(target.balanceAmount))}).`,
        );
      }
    }

    // Encargos e desconto informados na baixa acompanham o pagamento e viram ajustes: é o
    // que faz o extrato do título explicar por que saíram R$ 1.083,20 de uma dívida de
    // R$ 1.000,00.
    const extras = {
      interest: cents(dto.interestAmount ?? 0),
      penalty: cents(dto.penaltyAmount ?? 0),
      discount: cents(dto.discountAmount ?? 0),
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      let remaining = amountCents;

      for (const installment of targets) {
        if (remaining <= 0) break;

        const applied = Math.min(remaining, cents(installment.balanceAmount));
        if (applied <= 0) continue;

        const share = applied / amountCents;

        await tx.accountsPayablePartialPayment.create({
          data: {
            payableId: payable.id,
            installmentId: installment.id,
            amount: fromCents(applied),
            interestAmount: fromCents(Math.round(extras.interest * share)),
            penaltyAmount: fromCents(Math.round(extras.penalty * share)),
            discountAmount: fromCents(Math.round(extras.discount * share)),
            settledAmount: fromCents(
              applied +
                Math.round(extras.interest * share) +
                Math.round(extras.penalty * share) -
                Math.round(extras.discount * share),
            ),
            paidAt: new Date(dto.paidAt),
            financialAccountId:
              dto.financialAccountId ?? installment.financialAccountId,
            paymentMethodId: dto.paymentMethodId ?? installment.paymentMethodId,
            receiptNumber: dto.receiptNumber,
            notes: dto.notes,
            registeredBy: actor.id,
          },
        });

        remaining -= applied;
      }

      await this.recordAdjustmentsFromPayment(
        tx,
        payable.id,
        dto,
        extras,
        actor,
      );

      const result = await this.balance.recompute(tx, payable.id);

      await tx.accountsPayableHistory.create({
        data: {
          payableId: payable.id,
          installmentId: dto.installmentId ?? null,
          action:
            cents(result.balanceAmount) === 0
              ? AccountsPayableHistoryAction.PAID
              : AccountsPayableHistoryAction.PARTIAL_PAYMENT,
          previousStatus: payable.status,
          newStatus: result.status,
          justification: dto.notes ?? null,
          field: 'balanceAmount',
          previousValue: String(payable.balanceAmount),
          newValue: String(result.balanceAmount),
          actorId: actor.id,
          ipAddress: actor.ipAddress,
          userAgent: actor.userAgent,
        },
      });

      return result;
    });

    await this.audit.log({
      organizationId: payable.organizationId,
      companyId: payable.companyId,
      userId: actor.id,
      action: 'accounts_payable.partial_payment',
      entity: 'AccountsPayable',
      entityId: payable.id,
      oldValue: { balanceAmount: Number(payable.balanceAmount) },
      newValue: {
        balanceAmount: Number(updated.balanceAmount),
        paid: dto.amount,
        paidAt: dto.paidAt,
      },
      reason: dto.notes,
    });

    return updated;
  }

  /** Estorna uma baixa: o valor volta a dever e o registro antigo continua legível. */
  async reversePayment(paymentId: string, dto: ReasonDto, actor: RequestActor) {
    const payment =
      await this.prisma.accountsPayablePartialPayment.findFirstOrThrow({
        where: { id: paymentId },
        include: { payable: true },
      });

    if (payment.status === AccountsPayableEntryStatus.REVERSED) {
      throw new BadRequestException('Este pagamento já foi estornado.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.accountsPayablePartialPayment.update({
        where: { id: paymentId },
        data: {
          status: AccountsPayableEntryStatus.REVERSED,
          reversalReason: dto.reason,
          reversedBy: actor.id,
          reversedAt: new Date(),
        },
      });

      const result = await this.balance.recompute(tx, payment.payableId);

      await tx.accountsPayableHistory.create({
        data: {
          payableId: payment.payableId,
          installmentId: payment.installmentId,
          action: AccountsPayableHistoryAction.REVERSED,
          previousStatus: payment.payable.status,
          newStatus: result.status,
          justification: dto.reason,
          field: 'partialPayment',
          previousValue: String(payment.amount),
          newValue: '0',
          actorId: actor.id,
          ipAddress: actor.ipAddress,
          userAgent: actor.userAgent,
        },
      });

      return result;
    });

    await this.audit.log({
      organizationId: payment.payable.organizationId,
      companyId: payment.payable.companyId,
      userId: actor.id,
      action: 'accounts_payable.payment_reversed',
      entity: 'AccountsPayablePartialPayment',
      entityId: paymentId,
      oldValue: { amount: Number(payment.amount) },
      reason: dto.reason,
    });

    return updated;
  }

  // ── Ajustes: juros, multa, desconto e correção ────────────────────────────

  async addAdjustment(id: string, dto: AdjustmentDto, actor: RequestActor) {
    const payable = await this.loadForMovement(id);

    if (dto.installmentId) this.installmentOf(payable, dto.installmentId);

    if (dto.type === AccountsPayableAdjustmentType.DISCOUNT) {
      const scope = dto.installmentId
        ? cents(this.installmentOf(payable, dto.installmentId).balanceAmount)
        : cents(payable.balanceAmount);

      if (cents(dto.amount) > scope) {
        throw new BadRequestException(
          `O desconto de ${brl(dto.amount)} é maior que o saldo de ${brl(fromCents(scope))}.`,
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.accountsPayableAdjustment.create({
        data: {
          payableId: payable.id,
          installmentId: dto.installmentId ?? null,
          type: dto.type,
          source: AccountsPayableAdjustmentSource.MANUAL,
          amount: dto.amount,
          calculationBase: dto.calculationBase ?? null,
          rate: dto.rate ?? null,
          overdueDays: dto.overdueDays ?? null,
          reason: dto.reason,
          appliedBy: actor.id,
        },
      });

      const result = await this.balance.recompute(tx, payable.id);

      await tx.accountsPayableHistory.create({
        data: {
          payableId: payable.id,
          installmentId: dto.installmentId ?? null,
          action: AccountsPayableHistoryAction.ADJUSTMENT_ADDED,
          justification: dto.reason,
          field: dto.type,
          previousValue: String(payable.netAmount),
          newValue: String(result.netAmount),
          actorId: actor.id,
          ipAddress: actor.ipAddress,
          userAgent: actor.userAgent,
        },
      });

      return result;
    });

    await this.audit.log({
      organizationId: payable.organizationId,
      companyId: payable.companyId,
      userId: actor.id,
      action: 'accounts_payable.adjustment_added',
      entity: 'AccountsPayable',
      entityId: payable.id,
      newValue: { type: dto.type, amount: dto.amount },
      reason: dto.reason,
    });

    return updated;
  }

  /** Estorna um ajuste. Ajuste não se edita — some do saldo e continua no extrato. */
  async reverseAdjustment(
    adjustmentId: string,
    dto: ReasonDto,
    actor: RequestActor,
  ) {
    const adjustment =
      await this.prisma.accountsPayableAdjustment.findFirstOrThrow({
        where: { id: adjustmentId },
        include: { payable: true },
      });

    if (adjustment.status === AccountsPayableEntryStatus.REVERSED) {
      throw new BadRequestException('Este ajuste já foi estornado.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.accountsPayableAdjustment.update({
        where: { id: adjustmentId },
        data: {
          status: AccountsPayableEntryStatus.REVERSED,
          reversalReason: dto.reason,
          reversedBy: actor.id,
          reversedAt: new Date(),
        },
      });

      const result = await this.balance.recompute(tx, adjustment.payableId);

      await tx.accountsPayableHistory.create({
        data: {
          payableId: adjustment.payableId,
          installmentId: adjustment.installmentId,
          action: AccountsPayableHistoryAction.ADJUSTMENT_ADDED,
          justification: dto.reason,
          field: `${adjustment.type}_REVERSED`,
          previousValue: String(adjustment.amount),
          newValue: '0',
          actorId: actor.id,
          ipAddress: actor.ipAddress,
          userAgent: actor.userAgent,
        },
      });

      return result;
    });

    await this.audit.log({
      organizationId: adjustment.payable.organizationId,
      companyId: adjustment.payable.companyId,
      userId: actor.id,
      action: 'accounts_payable.adjustment_reversed',
      entity: 'AccountsPayableAdjustment',
      entityId: adjustmentId,
      reason: dto.reason,
    });

    return updated;
  }

  /**
   * Calcula juros e multa sugeridos pelo atraso, sem gravar nada.
   *
   * Sugerir e aplicar são coisas separadas: a memória de cálculo aparece na tela e alguém
   * decide. Aplicar sozinho faria o saldo do título mudar todo dia sem ato humano nenhum —
   * e um saldo que muda sozinho é um saldo que ninguém consegue conferir com o fornecedor.
   */
  async previewLateCharges(id: string, referenceDate = new Date()) {
    const payable = await this.prisma.accountsPayable.findFirstOrThrow({
      where: { id, deletedAt: null },
      include: { installments: { orderBy: { installmentNumber: 'asc' } } },
    });

    const settings = await this.prisma.accountsPayableSettings.findUnique({
      where: { companyId: payable.companyId },
    });

    const monthlyRate = Number(settings?.defaultMonthlyInterestRate ?? 0);
    const penaltyRate = Number(settings?.defaultPenaltyRate ?? 0);
    const grace = settings?.gracePeriodDays ?? 0;

    const lines = payable.installments
      .filter(
        (installment) =>
          LIVE_INSTALLMENTS.includes(installment.status) &&
          cents(installment.balanceAmount) > 0,
      )
      .map((installment) => {
        const overdueDays =
          daysBetween(installment.dueDate, referenceDate) - grace;

        if (overdueDays <= 0) {
          return {
            installmentId: installment.id,
            installmentNumber: installment.installmentNumber,
            overdueDays: 0,
            interest: 0,
            penalty: 0,
          };
        }

        const base = Number(installment.balanceAmount);

        return {
          installmentId: installment.id,
          installmentNumber: installment.installmentNumber,
          overdueDays,
          interest: fromCents(
            Math.round((cents(base) * monthlyRate * overdueDays) / (100 * 30)),
          ),
          penalty: fromCents(Math.round((cents(base) * penaltyRate) / 100)),
        };
      });

    return {
      referenceDate,
      monthlyRate,
      penaltyRate,
      gracePeriodDays: grace,
      lines,
      totalInterest: sum(lines.map((line) => line.interest)),
      totalPenalty: sum(lines.map((line) => line.penalty)),
    };
  }

  // ── Renegociação (seção 9) ────────────────────────────────────────────────

  /**
   * Renegocia o título: novo cronograma, encargos e desconto do acordo.
   *
   * O cronograma anterior é fotografado em `previous_schedule` antes de qualquer escrita. A
   * seção 9 exige nunca apagar o histórico original — e as parcelas em aberto são de fato
   * substituídas, então sem a fotografia o acordo anterior deixaria de existir.
   *
   * Parcelas já pagas não entram na renegociação: renegociar o que já foi pago mudaria o
   * passado.
   */
  async renegotiate(id: string, dto: RenegotiateDto, actor: RequestActor) {
    const payable = await this.loadForMovement(id);

    const open = payable.installments.filter(
      (installment) =>
        LIVE_INSTALLMENTS.includes(installment.status) &&
        cents(installment.balanceAmount) > 0,
    );

    if (open.length === 0) {
      throw new BadRequestException(
        'Não há parcela em aberto para renegociar. O título já está quitado.',
      );
    }

    const newTotal = cents(
      sum(dto.installments.map((installment) => installment.amount)),
    );
    const openBalance = open.reduce(
      (total, installment) => total + cents(installment.balanceAmount),
      0,
    );

    const expected =
      openBalance +
      cents(dto.interestAdded ?? 0) +
      cents(dto.penaltyAdded ?? 0) -
      cents(dto.discountGranted ?? 0);

    if (newTotal !== expected) {
      throw new BadRequestException(
        `O novo cronograma soma ${brl(fromCents(newTotal))}, mas o acordo resulta em ${brl(fromCents(expected))}. ` +
          'Ajuste as parcelas, os encargos ou o desconto.',
      );
    }

    const snapshot = payable.installments.map((installment) => ({
      installmentNumber: installment.installmentNumber,
      dueDate: installment.dueDate.toISOString(),
      originalAmount: Number(installment.originalAmount),
      netAmount: Number(installment.netAmount),
      paidAmount: Number(installment.paidAmount),
      balanceAmount: Number(installment.balanceAmount),
      status: installment.status,
    }));

    const paidCount = payable.installments.length - open.length;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.accountsPayableRenegotiation.create({
        data: {
          payableId: payable.id,
          reason: dto.reason,
          previousSchedule: snapshot,
          previousNetAmount: payable.netAmount,
          newNetAmount: fromCents(cents(payable.paidAmount) + newTotal),
          interestAdded: dto.interestAdded ?? 0,
          penaltyAdded: dto.penaltyAdded ?? 0,
          discountGranted: dto.discountGranted ?? 0,
          effectiveAt: dto.effectiveAt ? new Date(dto.effectiveAt) : new Date(),
          createdBy: actor.id,
        },
      });

      // As parcelas em aberto saem de cena como renegociadas — não apagadas. Quem abrir o
      // título daqui a um ano vê as duas versões do cronograma.
      await tx.accountsPayableInstallment.updateMany({
        where: { id: { in: open.map((installment) => installment.id) } },
        data: { status: AccountsPayableInstallmentStatus.RENEGOTIATED },
      });

      const total = paidCount + dto.installments.length;

      for (const [index, line] of dto.installments.entries()) {
        await tx.accountsPayableInstallment.create({
          data: {
            payableId: payable.id,
            installmentNumber: payable.installments.length + index + 1,
            totalInstallments: total,
            dueDate: new Date(line.dueDate),
            originalDueDate: new Date(line.dueDate),
            originalAmount: line.amount,
            netAmount: line.amount,
            balanceAmount: line.amount,
            status: AccountsPayableInstallmentStatus.OPEN,
            barcode: line.barcode,
            digitableLine: line.digitableLine,
            notes: line.notes,
            financialAccountId: payable.financialAccountId,
            paymentMethodId: payable.paymentMethodId,
          },
        });
      }

      await tx.accountsPayable.update({
        where: { id: payable.id },
        data: { renegotiatedAt: new Date(), updatedBy: actor.id },
      });

      const result = await this.balance.recompute(tx, payable.id);

      await tx.accountsPayableHistory.create({
        data: {
          payableId: payable.id,
          action: AccountsPayableHistoryAction.RENEGOTIATED,
          previousStatus: payable.status,
          newStatus: result.status,
          justification: dto.reason,
          field: 'schedule',
          previousValue: `${open.length} parcela(s) — ${brl(fromCents(openBalance))}`,
          newValue: `${dto.installments.length} parcela(s) — ${brl(fromCents(newTotal))}`,
          actorId: actor.id,
          ipAddress: actor.ipAddress,
          userAgent: actor.userAgent,
        },
      });

      return result;
    });

    await this.audit.log({
      organizationId: payable.organizationId,
      companyId: payable.companyId,
      userId: actor.id,
      action: 'accounts_payable.renegotiated',
      entity: 'AccountsPayable',
      entityId: payable.id,
      oldValue: { schedule: snapshot },
      newValue: {
        installments: dto.installments,
      } as unknown as Prisma.InputJsonValue,
      reason: dto.reason,
    });

    return updated;
  }

  // ── Adiantamentos (seção 10) ──────────────────────────────────────────────

  async createAdvance(dto: CreateAdvanceDto, actor: RequestActor) {
    const advance = await this.prisma.supplierAdvance.create({
      data: {
        organizationId: dto.organizationId,
        companyId: dto.companyId,
        supplierId: dto.supplierId,
        supplierContractId: dto.supplierContractId,
        type: dto.type,
        amount: dto.amount,
        remainingAmount: dto.amount,
        grantedAt: new Date(dto.grantedAt),
        reference: dto.reference,
        financialAccountId: dto.financialAccountId,
        paymentMethodId: dto.paymentMethodId,
        notes: dto.notes,
        createdBy: actor.id,
      },
    });

    await this.audit.log({
      organizationId: dto.organizationId,
      companyId: dto.companyId,
      userId: actor.id,
      action: 'accounts_payable.advance_created',
      entity: 'SupplierAdvance',
      entityId: advance.id,
      newValue: { amount: dto.amount, supplierId: dto.supplierId },
    });

    return advance;
  }

  async findAdvances(query: AdvanceQueryDto) {
    const where = {
      deletedAt: null,
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.withBalance ? { remainingAmount: { gt: 0 } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.supplierAdvance.findMany({
        where,
        include: {
          supplier: { select: { id: true, legalName: true, tradeName: true } },
          applications: {
            where: { status: AccountsPayableEntryStatus.ACTIVE },
            include: { payable: { select: { id: true, code: true } } },
          },
        },
        orderBy: { grantedAt: 'desc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.supplierAdvance.count({ where }),
    ]);

    return paginate(items, total, query.page, query.perPage);
  }

  /**
   * Abate um adiantamento no título.
   *
   * O adiantamento tem de ser do mesmo fornecedor e da mesma empresa. Sem essa checagem, o
   * saldo de um fornecedor pagaria a dívida de outro — e o acerto de contas de cada um
   * deixaria de fechar.
   */
  async applyAdvance(id: string, dto: ApplyAdvanceDto, actor: RequestActor) {
    const payable = await this.loadForMovement(id);

    const advance = await this.prisma.supplierAdvance.findFirstOrThrow({
      where: { id: dto.advanceId, deletedAt: null },
    });

    if (advance.companyId !== payable.companyId) {
      throw new BadRequestException(
        'O adiantamento pertence a outra empresa e não pode abater este título.',
      );
    }

    if (payable.supplierId && advance.supplierId !== payable.supplierId) {
      throw new BadRequestException(
        'O adiantamento é de outro fornecedor e não pode abater este título.',
      );
    }

    if (advance.status === SupplierAdvanceStatus.CANCELLED) {
      throw new BadRequestException('Este adiantamento foi cancelado.');
    }

    const amountCents = cents(dto.amount);

    if (amountCents > cents(advance.remainingAmount)) {
      throw new BadRequestException(
        `O adiantamento tem apenas ${brl(Number(advance.remainingAmount))} disponíveis.`,
      );
    }

    const scopeBalance = dto.installmentId
      ? cents(this.installmentOf(payable, dto.installmentId).balanceAmount)
      : cents(payable.balanceAmount);

    if (amountCents > scopeBalance) {
      throw new BadRequestException(
        `O abatimento de ${brl(dto.amount)} é maior que o saldo de ${brl(fromCents(scopeBalance))}.`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.accountsPayableAdvanceApplication.create({
        data: {
          advanceId: advance.id,
          payableId: payable.id,
          installmentId: dto.installmentId ?? null,
          amount: dto.amount,
          notes: dto.notes,
          appliedBy: actor.id,
        },
      });

      const applied = cents(advance.appliedAmount) + amountCents;
      const remaining = cents(advance.amount) - applied;

      await tx.supplierAdvance.update({
        where: { id: advance.id },
        data: {
          appliedAmount: fromCents(applied),
          remainingAmount: fromCents(remaining),
          status:
            remaining === 0
              ? SupplierAdvanceStatus.APPLIED
              : SupplierAdvanceStatus.PARTIALLY_APPLIED,
        },
      });

      const result = await this.balance.recompute(tx, payable.id);

      await tx.accountsPayableHistory.create({
        data: {
          payableId: payable.id,
          installmentId: dto.installmentId ?? null,
          action: AccountsPayableHistoryAction.ADVANCE_APPLIED,
          previousStatus: payable.status,
          newStatus: result.status,
          justification:
            dto.notes ?? `Adiantamento ${advance.reference ?? advance.id}.`,
          field: 'advanceAmount',
          previousValue: String(payable.advanceAmount),
          newValue: String(result.advanceAmount),
          actorId: actor.id,
          ipAddress: actor.ipAddress,
          userAgent: actor.userAgent,
        },
      });

      return result;
    });

    await this.audit.log({
      organizationId: payable.organizationId,
      companyId: payable.companyId,
      userId: actor.id,
      action: 'accounts_payable.advance_applied',
      entity: 'AccountsPayable',
      entityId: payable.id,
      newValue: { advanceId: advance.id, amount: dto.amount },
    });

    return updated;
  }

  // ── Apoio ─────────────────────────────────────────────────────────────────

  /** Carrega o título e recusa movimento em quem já saiu de cena. */
  private async loadForMovement(id: string) {
    const payable = await this.prisma.accountsPayable.findFirstOrThrow({
      where: { id, deletedAt: null },
      include: { installments: { orderBy: { installmentNumber: 'asc' } } },
    });

    if (CLOSED_FOR_MOVEMENT.includes(payable.status)) {
      throw new BadRequestException(
        payable.status === AccountsPayableStatus.CANCELLED
          ? 'Este título está cancelado. Reabra-o antes de movimentar.'
          : 'Este título foi renegociado. Movimente o cronograma vigente.',
      );
    }

    if (payable.blockedAt) {
      throw new BadRequestException(
        'Este título está bloqueado. Libere o bloqueio antes de movimentar.',
      );
    }

    return payable;
  }

  private installmentOf(
    payable: { installments: { id: string; installmentNumber: number }[] },
    installmentId: string,
  ) {
    const installment = payable.installments.find(
      (item) => item.id === installmentId,
    );

    if (!installment) {
      throw new BadRequestException(
        'A parcela informada não pertence a este título.',
      );
    }

    return installment as (typeof payable.installments)[number] & {
      balanceAmount: Prisma.Decimal;
      status: AccountsPayableInstallmentStatus;
      financialAccountId: string | null;
      paymentMethodId: string | null;
      dueDate: Date;
    };
  }

  /** Transforma os encargos informados na baixa em ajustes rastreáveis. */
  private async recordAdjustmentsFromPayment(
    tx: Prisma.TransactionClient,
    payableId: string,
    dto: PartialPaymentDto,
    extras: { interest: number; penalty: number; discount: number },
    actor: RequestActor,
  ) {
    const rows: {
      type: AccountsPayableAdjustmentType;
      amount: number;
    }[] = [];

    if (extras.interest > 0) {
      rows.push({
        type: AccountsPayableAdjustmentType.INTEREST,
        amount: fromCents(extras.interest),
      });
    }
    if (extras.penalty > 0) {
      rows.push({
        type: AccountsPayableAdjustmentType.PENALTY,
        amount: fromCents(extras.penalty),
      });
    }
    if (extras.discount > 0) {
      rows.push({
        type: AccountsPayableAdjustmentType.DISCOUNT,
        amount: fromCents(extras.discount),
      });
    }

    for (const row of rows) {
      await tx.accountsPayableAdjustment.create({
        data: {
          payableId,
          installmentId: dto.installmentId ?? null,
          type: row.type,
          source: AccountsPayableAdjustmentSource.AUTOMATIC,
          amount: row.amount,
          reason: 'Informado no registro do pagamento.',
          appliedBy: actor.id,
        },
      });
    }
  }
}

/** Diferença em dias entre duas datas, ignorando a hora. */
function daysBetween(from: Date, to: Date): number {
  const start = Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate(),
  );
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.floor((end - start) / 86_400_000);
}

function brl(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export { daysBetween };
