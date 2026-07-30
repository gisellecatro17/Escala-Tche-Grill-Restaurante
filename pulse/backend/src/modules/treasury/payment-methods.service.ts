import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentMethodType, RecordStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from '../../common/types/authenticated-request';
import { AuditService } from '../audit/audit.service';
import {
  CreatePaymentMethodDto,
  CreateReceiptMethodDto,
  MethodQueryDto,
  UpdatePaymentMethodDto,
  UpdateReceiptMethodDto,
} from './dto/methods.dto';

/**
 * Exigências implícitas de cada meio de pagamento (seção 42). São aplicadas como
 * **piso**: o usuário pode endurecer a regra, nunca afrouxá-la — um boleto sem linha
 * digitável não tem como ser pago.
 */
const PAYMENT_METHOD_REQUIREMENTS: Partial<
  Record<PaymentMethodType, Partial<Record<string, boolean>>>
> = {
  [PaymentMethodType.PIX]: { requiresBeneficiary: true },
  [PaymentMethodType.BOLETO]: { requiresDigitableLine: true },
  [PaymentMethodType.BANK_TRANSFER]: {
    requiresBeneficiary: true,
    requiresBankData: true,
  },
  [PaymentMethodType.TED]: {
    requiresBeneficiary: true,
    requiresBankData: true,
  },
  [PaymentMethodType.DOC]: {
    requiresBeneficiary: true,
    requiresBankData: true,
  },
  [PaymentMethodType.CREDIT_CARD]: { requiresFinancialAccount: true },
  [PaymentMethodType.DEBIT_CARD]: { requiresFinancialAccount: true },
};

@Injectable()
export class PaymentMethodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Formas de pagamento ───────────────────────────────────────────────────

  findPaymentMethods(organizationId: string, query: MethodQueryDto) {
    return this.prisma.paymentMethodCatalog.findMany({
      where: {
        organizationId,
        deletedAt: null,
        // Sem empresa selecionada, mostra as compartilhadas; com empresa, soma as dela.
        ...(query.companyId
          ? { OR: [{ companyId: query.companyId }, { companyId: null }] }
          : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { code: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findPaymentMethod(id: string) {
    const method = await this.prisma.paymentMethodCatalog.findFirst({
      where: { id, deletedAt: null },
    });
    if (!method)
      throw new NotFoundException('Forma de pagamento não encontrada.');
    return method;
  }

  async createPaymentMethod(dto: CreatePaymentMethodDto, actor: RequestUser) {
    await this.assertPaymentCodeIsFree(
      dto.organizationId,
      dto.companyId ?? null,
      dto.code,
    );

    const method = await this.prisma.paymentMethodCatalog.create({
      data: {
        ...this.buildPaymentPayload(dto),
        organizationId: dto.organizationId,
        companyId: dto.companyId ?? null,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        methodType: dto.methodType,
        ...this.applyPaymentRequirements(dto.methodType, dto),
        createdBy: actor.id,
      },
    });

    await this.audit.log({
      organizationId: dto.organizationId,
      companyId: dto.companyId ?? null,
      userId: actor.id,
      action: 'CREATE',
      entity: 'PaymentMethod',
      entityId: method.id,
      newValue: {
        code: method.code,
        name: method.name,
        methodType: method.methodType,
      },
    });

    return method;
  }

  async updatePaymentMethod(
    id: string,
    dto: UpdatePaymentMethodDto,
    actor: RequestUser,
  ) {
    const current = await this.findPaymentMethod(id);

    if (dto.code && dto.code.trim().toUpperCase() !== current.code) {
      await this.assertPaymentCodeIsFree(
        current.organizationId,
        current.companyId,
        dto.code,
        id,
      );
    }

    const method = await this.prisma.paymentMethodCatalog.update({
      where: { id },
      data: {
        ...this.buildPaymentPayload(dto),
        code: dto.code?.trim().toUpperCase(),
        name: dto.name?.trim(),
        methodType: dto.methodType,
        ...this.applyPaymentRequirements(
          dto.methodType ?? current.methodType,
          dto,
        ),
        updatedBy: actor.id,
      },
    });

    await this.audit.log({
      organizationId: current.organizationId,
      companyId: current.companyId,
      userId: actor.id,
      action: 'UPDATE',
      entity: 'PaymentMethod',
      entityId: id,
      oldValue: { name: current.name, status: current.status },
      newValue: { name: method.name, status: method.status },
    });

    return method;
  }

  async setPaymentMethodStatus(
    id: string,
    status: RecordStatus,
    actor: RequestUser,
  ) {
    const current = await this.findPaymentMethod(id);

    const method = await this.prisma.paymentMethodCatalog.update({
      where: { id },
      data: { status, updatedBy: actor.id },
    });

    await this.audit.log({
      organizationId: current.organizationId,
      companyId: current.companyId,
      userId: actor.id,
      action: status === RecordStatus.ACTIVE ? 'ACTIVATE' : 'DEACTIVATE',
      entity: 'PaymentMethod',
      entityId: id,
      oldValue: { status: current.status },
      newValue: { status },
    });

    return method;
  }

  async removePaymentMethod(id: string, actor: RequestUser) {
    const current = await this.findPaymentMethod(id);

    if (current.isSystem) {
      throw new ConflictException(
        'Esta forma de pagamento é padrão do sistema e não pode ser excluída. Utilize a opção Inativar.',
      );
    }

    await this.prisma.paymentMethodCatalog.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: actor.id },
    });

    await this.audit.log({
      organizationId: current.organizationId,
      companyId: current.companyId,
      userId: actor.id,
      action: 'DELETE',
      entity: 'PaymentMethod',
      entityId: id,
      oldValue: { code: current.code, name: current.name },
    });

    return { id };
  }

  /** Uso da forma de pagamento. Sem lançamentos ainda, o único vínculo é ser do sistema. */
  async paymentMethodUsage(id: string) {
    const method = await this.findPaymentMethod(id);

    return {
      id,
      inUse: method.isSystem,
      canDelete: !method.isSystem,
      total: 0,
      relations: [] as { label: string; count: number }[],
      // Lançamentos financeiros ainda não existem; quando existirem, entram aqui.
      note: 'A contagem de lançamentos será incluída com o módulo financeiro.',
    };
  }

  /**
   * Aplica as exigências mínimas do meio. `requiresDigitableLine` em um boleto não é
   * negociável: sem ela não há como pagar.
   */
  private applyPaymentRequirements(
    methodType: PaymentMethodType,
    dto: Partial<CreatePaymentMethodDto>,
  ) {
    const required = PAYMENT_METHOD_REQUIREMENTS[methodType] ?? {};
    const result: Record<string, boolean> = {};

    for (const [field, value] of Object.entries(required)) {
      const informed = (dto as Record<string, unknown>)[field];
      result[field] = value === true ? true : (informed as boolean);
    }

    return result;
  }

  private buildPaymentPayload(
    dto: CreatePaymentMethodDto | UpdatePaymentMethodDto,
  ) {
    return {
      description: dto.description,
      requiresFinancialAccount: dto.requiresFinancialAccount,
      requiresBeneficiary: dto.requiresBeneficiary,
      requiresBankData: dto.requiresBankData,
      requiresPixKey: dto.requiresPixKey,
      requiresBarcode: dto.requiresBarcode,
      requiresDigitableLine: dto.requiresDigitableLine,
      requiresAttachment: dto.requiresAttachment,
      requiresApproval: dto.requiresApproval,
      allowsScheduling: dto.allowsScheduling,
      allowsInstallments: dto.allowsInstallments,
      allowsRecurrence: dto.allowsRecurrence,
      allowsIntegration: dto.allowsIntegration,
      allowsBatchPayment: dto.allowsBatchPayment,
      confirmationThreshold: dto.confirmationThreshold,
      settlementDays: dto.settlementDays,
      defaultFeeCategoryId: dto.defaultFeeCategoryId,
      sortOrder: dto.sortOrder,
      status: dto.status,
    };
  }

  private async assertPaymentCodeIsFree(
    organizationId: string,
    companyId: string | null,
    code: string,
    ignoreId?: string,
  ) {
    const existing = await this.prisma.paymentMethodCatalog.findFirst({
      where: {
        organizationId,
        companyId,
        code: code.trim().toUpperCase(),
        deletedAt: null,
        ...(ignoreId ? { id: { not: ignoreId } } : {}),
      },
      select: { id: true, name: true },
    });

    if (existing) {
      throw new ConflictException(
        `Já existe uma forma de pagamento com o código "${code}": "${existing.name}".`,
      );
    }
  }

  // ── Formas de recebimento ─────────────────────────────────────────────────

  findReceiptMethods(organizationId: string, query: MethodQueryDto) {
    return this.prisma.receiptMethod.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(query.companyId
          ? { OR: [{ companyId: query.companyId }, { companyId: null }] }
          : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { code: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        defaultFinancialAccount: {
          select: { id: true, displayName: true, name: true },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findReceiptMethod(id: string) {
    const method = await this.prisma.receiptMethod.findFirst({
      where: { id, deletedAt: null },
      include: {
        defaultFinancialAccount: {
          select: { id: true, displayName: true, name: true },
        },
      },
    });
    if (!method)
      throw new NotFoundException('Forma de recebimento não encontrada.');
    return method;
  }

  async createReceiptMethod(dto: CreateReceiptMethodDto, actor: RequestUser) {
    await this.assertReceiptCodeIsFree(
      dto.organizationId,
      dto.companyId ?? null,
      dto.code,
    );
    this.assertInstallmentsCoherent(dto);
    await this.assertAccountBelongsToScope(
      dto.defaultFinancialAccountId,
      dto.companyId,
    );

    const method = await this.prisma.receiptMethod.create({
      data: {
        ...this.buildReceiptPayload(dto),
        organizationId: dto.organizationId,
        companyId: dto.companyId ?? null,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        methodType: dto.methodType,
        createdBy: actor.id,
      },
    });

    await this.audit.log({
      organizationId: dto.organizationId,
      companyId: dto.companyId ?? null,
      userId: actor.id,
      action: 'CREATE',
      entity: 'ReceiptMethod',
      entityId: method.id,
      newValue: {
        code: method.code,
        name: method.name,
        percentageFee: method.percentageFee?.toString() ?? null,
      },
    });

    return method;
  }

  async updateReceiptMethod(
    id: string,
    dto: UpdateReceiptMethodDto,
    actor: RequestUser,
  ) {
    const current = await this.findReceiptMethod(id);
    this.assertInstallmentsCoherent({
      ...current,
      ...dto,
    } as CreateReceiptMethodDto);

    if (dto.code && dto.code.trim().toUpperCase() !== current.code) {
      await this.assertReceiptCodeIsFree(
        current.organizationId,
        current.companyId,
        dto.code,
        id,
      );
    }

    if (dto.defaultFinancialAccountId) {
      await this.assertAccountBelongsToScope(
        dto.defaultFinancialAccountId,
        current.companyId ?? undefined,
      );
    }

    const method = await this.prisma.receiptMethod.update({
      where: { id },
      data: {
        ...this.buildReceiptPayload(dto),
        code: dto.code?.trim().toUpperCase(),
        name: dto.name?.trim(),
        methodType: dto.methodType,
        updatedBy: actor.id,
      },
    });

    await this.audit.log({
      organizationId: current.organizationId,
      companyId: current.companyId,
      userId: actor.id,
      action: 'UPDATE',
      entity: 'ReceiptMethod',
      entityId: id,
      oldValue: {
        percentageFee: current.percentageFee?.toString() ?? null,
        settlementDays: current.settlementDays,
      },
      newValue: {
        percentageFee: method.percentageFee?.toString() ?? null,
        settlementDays: method.settlementDays,
      },
    });

    return method;
  }

  async setReceiptMethodStatus(
    id: string,
    status: RecordStatus,
    actor: RequestUser,
  ) {
    const current = await this.findReceiptMethod(id);

    const method = await this.prisma.receiptMethod.update({
      where: { id },
      data: { status, updatedBy: actor.id },
    });

    await this.audit.log({
      organizationId: current.organizationId,
      companyId: current.companyId,
      userId: actor.id,
      action: status === RecordStatus.ACTIVE ? 'ACTIVATE' : 'DEACTIVATE',
      entity: 'ReceiptMethod',
      entityId: id,
      oldValue: { status: current.status },
      newValue: { status },
    });

    return method;
  }

  async removeReceiptMethod(id: string, actor: RequestUser) {
    const current = await this.findReceiptMethod(id);

    if (current.isSystem) {
      throw new ConflictException(
        'Esta forma de recebimento é padrão do sistema e não pode ser excluída. Utilize a opção Inativar.',
      );
    }

    await this.prisma.receiptMethod.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: actor.id },
    });

    await this.audit.log({
      organizationId: current.organizationId,
      companyId: current.companyId,
      userId: actor.id,
      action: 'DELETE',
      entity: 'ReceiptMethod',
      entityId: id,
      oldValue: { code: current.code, name: current.name },
    });

    return { id };
  }

  async receiptMethodUsage(id: string) {
    const method = await this.findReceiptMethod(id);

    return {
      id,
      inUse: method.isSystem,
      canDelete: !method.isSystem,
      total: 0,
      relations: [] as { label: string; count: number }[],
      note: 'A contagem de lançamentos será incluída com o módulo financeiro.',
    };
  }

  private buildReceiptPayload(
    dto: CreateReceiptMethodDto | UpdateReceiptMethodDto,
  ) {
    return {
      description: dto.description,
      defaultFinancialAccountId: dto.defaultFinancialAccountId,
      requiresCustomer: dto.requiresCustomer,
      requiresDocument: dto.requiresDocument,
      requiresIdentifier: dto.requiresIdentifier,
      allowsRecurrence: dto.allowsRecurrence,
      allowsInstallments: dto.allowsInstallments,
      maximumInstallments: dto.maximumInstallments,
      settlementDays: dto.settlementDays,
      fixedFee: dto.fixedFee,
      percentageFee: dto.percentageFee,
      anticipationAllowed: dto.anticipationAllowed,
      anticipationFeePercentage: dto.anticipationFeePercentage,
      defaultFeeCategoryId: dto.defaultFeeCategoryId,
      defaultInterestCategoryId: dto.defaultInterestCategoryId,
      acquirerSupplierId: dto.acquirerSupplierId,
      integrationProvider: dto.integrationProvider,
      sortOrder: dto.sortOrder,
      status: dto.status,
    };
  }

  /** Parcelamento desligado com número máximo de parcelas é contradição. */
  private assertInstallmentsCoherent(dto: Partial<CreateReceiptMethodDto>) {
    if (dto.maximumInstallments && dto.allowsInstallments === false) {
      throw new BadRequestException(
        'Informe o número máximo de parcelas apenas quando o parcelamento estiver habilitado.',
      );
    }
  }

  private async assertAccountBelongsToScope(
    accountId: string | undefined,
    companyId: string | undefined,
  ) {
    if (!accountId || !companyId) return;

    const account = await this.prisma.financialAccount.findFirst({
      where: { id: accountId, deletedAt: null },
      select: { companyId: true },
    });

    if (!account)
      throw new NotFoundException('Conta financeira não encontrada.');
    if (account.companyId !== companyId) {
      throw new BadRequestException(
        'A conta de recebimento informada pertence a outra empresa.',
      );
    }
  }

  private async assertReceiptCodeIsFree(
    organizationId: string,
    companyId: string | null,
    code: string,
    ignoreId?: string,
  ) {
    const existing = await this.prisma.receiptMethod.findFirst({
      where: {
        organizationId,
        companyId,
        code: code.trim().toUpperCase(),
        deletedAt: null,
        ...(ignoreId ? { id: { not: ignoreId } } : {}),
      },
      select: { id: true, name: true },
    });

    if (existing) {
      throw new ConflictException(
        `Já existe uma forma de recebimento com o código "${code}": "${existing.name}".`,
      );
    }
  }
}
