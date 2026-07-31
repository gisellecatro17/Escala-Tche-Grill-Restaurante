import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomerLinkStatus, Prisma } from '@prisma/client';

import { paginate } from '../../common/dto/pagination-query.dto';
import type { RequestUser } from '../../common/types/authenticated-request';
import { hasPermissionAnywhere } from '../../common/utils/access-control.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BankIdentifierDto } from './dto/bank-identifier.dto';
import { BillingRuleDto } from './dto/billing-rule.dto';
import { ChangeLinkStatusDto } from './dto/change-link-status.dto';
import { CollectionHistoryDto } from './dto/collection-history.dto';
import { ContractAmendmentDto } from './dto/contract-amendment.dto';
import { ContractDto } from './dto/contract.dto';
import { CreateCompanyLinkDto } from './dto/create-company-link.dto';
import {
  DuplicateLinkAspect,
  DuplicateLinkDto,
} from './dto/duplicate-link.dto';
import { PaymentPromiseDto } from './dto/payment-promise.dto';
import { RecurringReceivableDto } from './dto/recurring-receivable.dto';
import { UpdateCompanyLinkDto } from './dto/update-company-link.dto';
import { UpdateCreditDto } from './dto/update-credit.dto';
import { UpdatePaymentPromiseDto } from './dto/update-payment-promise.dto';

const UNIQUE_CONSTRAINT_ERROR_CODE = 'P2002';

const LINK_DETAIL_INCLUDE = {
  customer: true,
  company: { select: { id: true, displayName: true, legalName: true } },
  defaultRevenueCategory: { select: { id: true, name: true } },
  defaultSubcategory: { select: { id: true, name: true } },
  defaultResultCenter: { select: { id: true, name: true } },
  billingRules: { where: { deletedAt: null } },
  contracts: {
    where: { deletedAt: null },
    include: { amendments: { where: { deletedAt: null } } },
  },
  recurringReceivables: { where: { deletedAt: null } },
} satisfies Prisma.CustomerCompanyLinkInclude;

const CREDIT_SENSITIVE_FIELDS = [
  'creditLimit',
  'estimatedMonthlyRevenue',
  'estimatedAnnualRevenue',
  'estimatedAverageTicket',
  'estimatedMarginPercentage',
  'riskLevel',
] as const;

@Injectable()
export class CustomerCompanyLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createLink(
    customerId: string,
    dto: CreateCompanyLinkDto,
    actor: RequestUser,
  ) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado.');

    const company = await this.prisma.company.findFirst({
      where: { id: dto.companyId, deletedAt: null },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada.');

    try {
      const link = await this.prisma.customerCompanyLink.create({
        data: {
          ...this.mapLinkScalars(dto),
          customerId,
          companyId: dto.companyId,
          status: CustomerLinkStatus.PROSPECT,
          createdBy: actor.id,
          updatedBy: actor.id,
        },
        include: LINK_DETAIL_INCLUDE,
      });

      await this.audit.log({
        organizationId: customer.organizationId,
        companyId: dto.companyId,
        userId: actor.id,
        action: 'CREATE_COMPANY_LINK',
        entity: 'CustomerCompanyLink',
        entityId: link.id,
        newValue: { customerId, companyId: dto.companyId },
      });

      return link;
    } catch (error) {
      this.rethrowIfDuplicateLink(error);
      throw error;
    }
  }

  async getLink(id: string, actor?: RequestUser) {
    const link = await this.prisma.customerCompanyLink.findFirst({
      where: { id, deletedAt: null },
      include: LINK_DETAIL_INCLUDE,
    });
    if (!link) throw new NotFoundException('Vínculo não encontrado.');

    if (
      actor &&
      !hasPermissionAnywhere(actor, 'customer.view_credit_information')
    ) {
      return this.maskCreditInformation(link);
    }

    return link;
  }

  async updateLink(id: string, dto: UpdateCompanyLinkDto, actor: RequestUser) {
    const existing = await this.getLink(id);

    const link = await this.prisma.customerCompanyLink.update({
      where: { id },
      data: { ...this.mapLinkScalars(dto), updatedBy: actor.id },
      include: LINK_DETAIL_INCLUDE,
    });

    await this.audit.log({
      organizationId: existing.customer.organizationId,
      companyId: existing.companyId,
      userId: actor.id,
      action: 'UPDATE_COMPANY_LINK',
      entity: 'CustomerCompanyLink',
      entityId: id,
    });

    return link;
  }

  /** Configuração de crédito e risco — protegida por permissão dedicada (seção 40-45). */
  async updateCredit(id: string, dto: UpdateCreditDto, actor: RequestUser) {
    const existing = await this.getLink(id);

    const link = await this.prisma.customerCompanyLink.update({
      where: { id },
      data: { ...dto, updatedBy: actor.id },
      include: LINK_DETAIL_INCLUDE,
    });

    await this.audit.log({
      organizationId: existing.customer.organizationId,
      companyId: existing.companyId,
      userId: actor.id,
      action: 'UPDATE_CREDIT',
      entity: 'CustomerCompanyLink',
      entityId: id,
      field: 'creditLimit',
      oldValue: {
        creditLimit: existing.creditLimit,
        riskLevel: existing.riskLevel,
      },
      newValue: { creditLimit: dto.creditLimit, riskLevel: dto.riskLevel },
    });

    return link;
  }

  /**
   * Converte um prospect em cliente ativo (seção 64-65). Valida os pré-requisitos mínimos
   * antes de promover o status — não duplica o cadastro, apenas altera o vínculo existente.
   */
  async convertProspect(id: string, actor: RequestUser) {
    const link = await this.getLink(id);

    if (link.status !== CustomerLinkStatus.PROSPECT) {
      throw new BadRequestException(
        'Apenas prospects podem ser convertidos em cliente.',
      );
    }

    const pendencies: string[] = [];
    if (!link.defaultRevenueCategoryId)
      pendencies.push('Categoria de receita padrão.');
    if (!link.preferredPaymentMethod && !link.billingFrequency) {
      pendencies.push('Condição de recebimento.');
    }
    const hasFinancialContact = await this.prisma.customerContact.findFirst({
      where: {
        customerId: link.customerId,
        isFinancialContact: true,
        deletedAt: null,
      },
    });
    if (!hasFinancialContact) pendencies.push('Contato financeiro.');
    if (!link.customer.legalName || !link.customer.displayName) {
      pendencies.push('Dados cadastrais completos.');
    }

    if (pendencies.length > 0) {
      throw new BadRequestException({
        message:
          'O prospect possui pendências e não pode ser convertido em cliente.',
        pendencies,
      });
    }

    const updated = await this.changeStatus(
      id,
      CustomerLinkStatus.ACTIVE,
      actor,
      {
        action: 'CONVERT_PROSPECT',
      },
    );

    await this.audit.log({
      organizationId: link.customer.organizationId,
      companyId: link.companyId,
      userId: actor.id,
      action: 'CONVERT_PROSPECT',
      entity: 'CustomerCompanyLink',
      entityId: id,
    });

    return updated;
  }

  async activate(id: string, actor: RequestUser) {
    return this.changeStatus(id, CustomerLinkStatus.ACTIVE, actor, {
      action: 'ACTIVATE_LINK',
      clearReasons: true,
    });
  }

  async deactivate(id: string, dto: ChangeLinkStatusDto, actor: RequestUser) {
    return this.changeStatus(id, CustomerLinkStatus.INACTIVE, actor, {
      action: 'DEACTIVATE_LINK',
      reason: dto.reason,
    });
  }

  async suspend(id: string, dto: ChangeLinkStatusDto, actor: RequestUser) {
    if (!dto.reason)
      throw new BadRequestException('Informe o motivo da suspensão.');
    return this.changeStatus(id, CustomerLinkStatus.SUSPENDED, actor, {
      action: 'SUSPEND_LINK',
      reason: dto.reason,
      reasonField: 'suspensionReason',
    });
  }

  async block(id: string, dto: ChangeLinkStatusDto, actor: RequestUser) {
    if (!dto.reason)
      throw new BadRequestException('Informe o motivo do bloqueio.');
    return this.changeStatus(id, CustomerLinkStatus.BLOCKED, actor, {
      action: 'BLOCK_LINK',
      reason: dto.reason,
      reasonField: 'blockReason',
    });
  }

  async unblock(id: string, actor: RequestUser) {
    return this.changeStatus(id, CustomerLinkStatus.ACTIVE, actor, {
      action: 'UNBLOCK_LINK',
      clearReasons: true,
    });
  }

  async remove(id: string, actor: RequestUser) {
    const link = await this.prisma.customerCompanyLink.findFirst({
      where: { id, deletedAt: null },
      include: {
        customer: true,
        contracts: { where: { deletedAt: null } },
        recurringReceivables: { where: { deletedAt: null } },
      },
    });
    if (!link) throw new NotFoundException('Vínculo não encontrado.');

    const notMovable =
      link.status !== CustomerLinkStatus.DRAFT &&
      link.status !== CustomerLinkStatus.PROSPECT;
    const [paymentPromisesCount, collectionHistoryCount] = await Promise.all([
      this.prisma.paymentPromise.count({
        where: { customerCompanyLinkId: id, deletedAt: null },
      }),
      this.prisma.customerCollectionHistory.count({
        where: { customerCompanyLinkId: id },
      }),
    ]);

    if (
      notMovable ||
      link.contracts.length > 0 ||
      link.recurringReceivables.length > 0 ||
      paymentPromisesCount > 0 ||
      collectionHistoryCount > 0
    ) {
      throw new ConflictException(
        'Este cliente possui registros vinculados e não pode ser excluído. Utilize a opção Inativar.',
      );
    }

    await this.prisma.customerCompanyLink.delete({ where: { id } });

    await this.audit.log({
      organizationId: link.customer.organizationId,
      companyId: link.companyId,
      userId: actor.id,
      action: 'DELETE_LINK',
      entity: 'CustomerCompanyLink',
      entityId: id,
    });

    return { id };
  }

  async duplicate(id: string, dto: DuplicateLinkDto, actor: RequestUser) {
    const source = await this.getLink(id);

    const targetCompany = await this.prisma.company.findFirst({
      where: { id: dto.targetCompanyId, deletedAt: null },
    });
    if (!targetCompany)
      throw new NotFoundException('Empresa de destino não encontrada.');

    if (source.companyId === dto.targetCompanyId) {
      throw new BadRequestException(
        'Selecione uma empresa de destino diferente da empresa de origem.',
      );
    }

    const copyData: Record<string, unknown> = {};

    const aspectMap: Record<DuplicateLinkAspect, () => void> = {
      REVENUE_CATEGORY: () =>
        (copyData.defaultRevenueCategoryId = source.defaultRevenueCategoryId),
      SUBCATEGORY: () =>
        (copyData.defaultSubcategoryId = source.defaultSubcategoryId),
      RESULT_CENTER: () =>
        (copyData.defaultResultCenterId = source.defaultResultCenterId),
      PRODUCT_SERVICE: () =>
        (copyData.defaultProductService = source.defaultProductService),
      PAYMENT_TERMS: () => {
        copyData.paymentTermDays = source.paymentTermDays;
        copyData.defaultDueDay = source.defaultDueDay;
        copyData.billingFrequency = source.billingFrequency;
      },
      PAYMENT_METHOD: () =>
        (copyData.preferredPaymentMethod = source.preferredPaymentMethod),
      INTEREST_AND_FEE_RULES: () => {
        copyData.defaultLateFeePercentage = source.defaultLateFeePercentage;
        copyData.defaultMonthlyInterestPercentage =
          source.defaultMonthlyInterestPercentage;
        copyData.defaultDiscountPercentage = source.defaultDiscountPercentage;
        copyData.earlyPaymentDiscountPercentage =
          source.earlyPaymentDiscountPercentage;
        copyData.earlyPaymentDays = source.earlyPaymentDays;
        copyData.gracePeriodDays = source.gracePeriodDays;
      },
      CREDIT_LIMIT: () => {
        copyData.creditLimit = source.creditLimit;
        copyData.riskLevel = source.riskLevel;
        copyData.allowOverCreditLimit = source.allowOverCreditLimit;
        copyData.requiresOverLimitApproval = source.requiresOverLimitApproval;
      },
      BILLING_RULES: () => undefined,
      BANK_IDENTIFIERS: () => undefined,
      CONTRACTS: () => undefined,
      RECURRING_RECEIVABLES: () => undefined,
    };

    dto.aspects.forEach((aspect) => aspectMap[aspect]());

    try {
      const newLink = await this.prisma.$transaction(async (tx) => {
        const created = await tx.customerCompanyLink.create({
          data: {
            customerId: source.customerId,
            companyId: dto.targetCompanyId,
            customerTypes: source.customerTypes,
            status: CustomerLinkStatus.PROSPECT,
            ...copyData,
            createdBy: actor.id,
            updatedBy: actor.id,
          },
          include: LINK_DETAIL_INCLUDE,
        });

        if (
          dto.aspects.includes('BILLING_RULES') &&
          source.billingRules.length > 0
        ) {
          await tx.customerBillingRule.createMany({
            data: source.billingRules.map((r) => ({
              customerCompanyLinkId: created.id,
              ruleType: r.ruleType,
              referenceEvent: r.referenceEvent,
              daysOffset: r.daysOffset,
              channel: r.channel,
              messageTemplateId: r.messageTemplateId,
              preferredHour: r.preferredHour,
              allowedWeekdays: r.allowedWeekdays,
              automatic: r.automatic,
              requiresApproval: r.requiresApproval,
              responsibleUserId: r.responsibleUserId,
              priority: r.priority,
            })),
          });
        }

        if (dto.aspects.includes('CONTRACTS') && source.contracts.length > 0) {
          await tx.customerContract.createMany({
            data: source.contracts.map((c) => ({
              customerCompanyLinkId: created.id,
              contractNumber: c.contractNumber,
              description: c.description,
              object: c.object,
              productService: c.productService,
              planName: c.planName,
              initialValue: c.initialValue,
              currentValue: c.currentValue,
              startDate: c.startDate,
              endDate: c.endDate,
              isIndefiniteTerm: c.isIndefiniteTerm,
              billingFrequency: c.billingFrequency,
              dueDay: c.dueDay,
              status: 'DRAFT',
            })),
          });
        }

        if (
          dto.aspects.includes('RECURRING_RECEIVABLES') &&
          source.recurringReceivables.length > 0
        ) {
          await tx.customerRecurringReceivable.createMany({
            data: source.recurringReceivables.map((r) => ({
              customerCompanyLinkId: created.id,
              description: r.description,
              amount: r.amount,
              frequency: r.frequency,
              startDate: r.startDate,
              endDate: r.endDate,
              fixedDueDay: r.fixedDueDay,
              revenueCategoryId: r.revenueCategoryId,
              resultCenterId: r.resultCenterId,
            })),
          });
        }

        if (dto.aspects.includes('BANK_IDENTIFIERS')) {
          const identifiers = await tx.customerBankIdentifier.findMany({
            where: {
              customerId: source.customerId,
              companyId: source.companyId,
            },
          });
          if (identifiers.length > 0) {
            await tx.customerBankIdentifier.createMany({
              data: identifiers.map((i) => ({
                customerId: source.customerId,
                companyId: dto.targetCompanyId,
                identifierType: i.identifierType,
                identifierValue: i.identifierValue,
                normalizedValue: i.normalizedValue,
                source: i.source,
                priority: i.priority,
                confidence: i.confidence,
              })),
            });
          }
        }

        return this.getLink(created.id);
      });

      await this.audit.log({
        organizationId: source.customer.organizationId,
        companyId: dto.targetCompanyId,
        userId: actor.id,
        action: 'DUPLICATE_LINK',
        entity: 'CustomerCompanyLink',
        entityId: newLink.id,
        newValue: { sourceLinkId: source.id, aspects: dto.aspects },
      });

      return newLink;
    } catch (error) {
      this.rethrowIfDuplicateLink(error);
      throw error;
    }
  }

  // ── Regras de cobrança, histórico, promessas, contratos e recorrências ─────

  async addBillingRule(
    linkId: string,
    dto: BillingRuleDto,
    actor: RequestUser,
  ) {
    const link = await this.getLink(linkId);

    const rule = await this.prisma.customerBillingRule.create({
      data: {
        customerCompanyLinkId: linkId,
        ...dto,
        createdBy: actor.id,
        updatedBy: actor.id,
      },
    });

    await this.audit.log({
      organizationId: link.customer.organizationId,
      companyId: link.companyId,
      userId: actor.id,
      action: 'ADD_BILLING_RULE',
      entity: 'CustomerCompanyLink',
      entityId: linkId,
      newValue: { ruleId: rule.id },
    });

    return rule;
  }

  async addCollectionHistory(
    linkId: string,
    dto: CollectionHistoryDto,
    actor: RequestUser,
  ) {
    const link = await this.getLink(linkId);

    const entry = await this.prisma.customerCollectionHistory.create({
      data: {
        customerCompanyLinkId: linkId,
        organizationId: link.customer.organizationId,
        companyId: link.companyId,
        contractId: dto.contractId,
        channel: dto.channel,
        recipientName: dto.recipientName,
        recipientAddress: dto.recipientAddress,
        subject: dto.subject,
        message: dto.message,
        deliveryStatus: dto.deliveryStatus,
        response: dto.response,
        notes: dto.notes,
        sentAt: new Date(),
        responsibleUserId: actor.id,
      },
    });

    await this.audit.log({
      organizationId: link.customer.organizationId,
      companyId: link.companyId,
      userId: actor.id,
      action: 'REGISTER_COLLECTION',
      entity: 'CustomerCompanyLink',
      entityId: linkId,
      newValue: { collectionHistoryId: entry.id, channel: entry.channel },
    });

    return entry;
  }

  async addPaymentPromise(
    linkId: string,
    dto: PaymentPromiseDto,
    actor: RequestUser,
  ) {
    const link = await this.getLink(linkId);

    const promise = await this.prisma.paymentPromise.create({
      data: {
        customerCompanyLinkId: linkId,
        organizationId: link.customer.organizationId,
        companyId: link.companyId,
        collectionHistoryId: dto.collectionHistoryId,
        customerContactId: dto.customerContactId,
        responsibleUserId: dto.responsibleUserId ?? actor.id,
        promisedAmount: dto.promisedAmount,
        promisedDate: new Date(dto.promisedDate),
        notes: dto.notes,
      },
    });

    await this.audit.log({
      organizationId: link.customer.organizationId,
      companyId: link.companyId,
      userId: actor.id,
      action: 'REGISTER_PAYMENT_PROMISE',
      entity: 'CustomerCompanyLink',
      entityId: linkId,
      newValue: {
        promiseId: promise.id,
        promisedAmount: promise.promisedAmount.toString(),
      },
    });

    return promise;
  }

  async updatePaymentPromise(
    linkId: string,
    promiseId: string,
    dto: UpdatePaymentPromiseDto,
    actor: RequestUser,
  ) {
    const link = await this.getLink(linkId);
    const existing = await this.prisma.paymentPromise.findFirst({
      where: { id: promiseId, customerCompanyLinkId: linkId },
    });
    if (!existing)
      throw new NotFoundException('Promessa de pagamento não encontrada.');

    const promise = await this.prisma.paymentPromise.update({
      where: { id: promiseId },
      data: {
        ...dto,
        fulfilledAt: dto.fulfilledAt ? new Date(dto.fulfilledAt) : undefined,
      },
    });

    await this.audit.log({
      organizationId: link.customer.organizationId,
      companyId: link.companyId,
      userId: actor.id,
      action: 'UPDATE_PAYMENT_PROMISE',
      entity: 'CustomerCompanyLink',
      entityId: linkId,
      oldValue: { status: existing.status },
      newValue: { promiseId, status: promise.status },
    });

    return promise;
  }

  async addContract(linkId: string, dto: ContractDto, actor: RequestUser) {
    const link = await this.getLink(linkId);
    this.assertContractDates(dto);

    const contract = await this.prisma.customerContract.create({
      data: {
        customerCompanyLinkId: linkId,
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        signatureDate: dto.signatureDate
          ? new Date(dto.signatureDate)
          : undefined,
        adjustmentBaseDate: dto.adjustmentBaseDate
          ? new Date(dto.adjustmentBaseDate)
          : undefined,
        nextAdjustmentDate: dto.nextAdjustmentDate
          ? new Date(dto.nextAdjustmentDate)
          : undefined,
        createdBy: actor.id,
        updatedBy: actor.id,
      },
    });

    await this.audit.log({
      organizationId: link.customer.organizationId,
      companyId: link.companyId,
      userId: actor.id,
      action: 'ADD_CONTRACT',
      entity: 'CustomerCompanyLink',
      entityId: linkId,
      newValue: { contractId: contract.id },
    });

    return contract;
  }

  async updateContract(
    linkId: string,
    contractId: string,
    dto: Partial<ContractDto>,
    actor: RequestUser,
  ) {
    const link = await this.getLink(linkId);
    const existing = await this.prisma.customerContract.findFirst({
      where: { id: contractId, customerCompanyLinkId: linkId },
    });
    if (!existing) throw new NotFoundException('Contrato não encontrado.');

    this.assertContractDates({ ...existing, ...dto } as ContractDto);

    const contract = await this.prisma.customerContract.update({
      where: { id: contractId },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        signatureDate: dto.signatureDate
          ? new Date(dto.signatureDate)
          : undefined,
        updatedBy: actor.id,
      },
    });

    await this.audit.log({
      organizationId: link.customer.organizationId,
      companyId: link.companyId,
      userId: actor.id,
      action: 'UPDATE_CONTRACT',
      entity: 'CustomerCompanyLink',
      entityId: linkId,
      newValue: { contractId },
    });

    return contract;
  }

  async addContractAmendment(
    linkId: string,
    contractId: string,
    dto: ContractAmendmentDto,
    actor: RequestUser,
  ) {
    const link = await this.getLink(linkId);
    const contract = await this.prisma.customerContract.findFirst({
      where: { id: contractId, customerCompanyLinkId: linkId },
    });
    if (!contract) throw new NotFoundException('Contrato não encontrado.');

    const amendment = await this.prisma.customerContractAmendment.create({
      data: {
        contractId,
        ...dto,
        effectiveDate: dto.effectiveDate
          ? new Date(dto.effectiveDate)
          : undefined,
        previousEndDate: dto.previousEndDate
          ? new Date(dto.previousEndDate)
          : undefined,
        newEndDate: dto.newEndDate ? new Date(dto.newEndDate) : undefined,
        createdBy: actor.id,
        updatedBy: actor.id,
      },
    });

    if (dto.newValue !== undefined) {
      await this.prisma.customerContract.update({
        where: { id: contractId },
        data: { currentValue: dto.newValue },
      });
    }

    await this.audit.log({
      organizationId: link.customer.organizationId,
      companyId: link.companyId,
      userId: actor.id,
      action: 'ADD_CONTRACT_AMENDMENT',
      entity: 'CustomerCompanyLink',
      entityId: linkId,
      newValue: { contractId, amendmentId: amendment.id },
    });

    return amendment;
  }

  async addRecurringReceivable(
    linkId: string,
    dto: RecurringReceivableDto,
    actor: RequestUser,
  ) {
    const link = await this.getLink(linkId);

    const recurring = await this.prisma.customerRecurringReceivable.create({
      data: {
        customerCompanyLinkId: linkId,
        ...dto,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        firstDueDate: dto.firstDueDate ? new Date(dto.firstDueDate) : undefined,
        createdBy: actor.id,
        updatedBy: actor.id,
      },
    });

    await this.audit.log({
      organizationId: link.customer.organizationId,
      companyId: link.companyId,
      userId: actor.id,
      action: 'ADD_RECURRING_RECEIVABLE',
      entity: 'CustomerCompanyLink',
      entityId: linkId,
      newValue: { recurringReceivableId: recurring.id },
    });

    return recurring;
  }

  async addBankIdentifier(
    customerId: string,
    companyId: string | undefined,
    dto: BankIdentifierDto,
    actor: RequestUser,
  ) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado.');

    const identifier = await this.prisma.customerBankIdentifier.create({
      data: {
        customerId,
        companyId,
        identifierType: dto.identifierType,
        identifierValue: dto.identifierValue,
        normalizedValue: dto.identifierValue
          .trim()
          .toUpperCase()
          .replace(/\s+/g, ' '),
        source: dto.source,
        priority: dto.priority,
        confidence: dto.confidence,
        createdBy: actor.id,
      },
    });

    await this.audit.log({
      organizationId: customer.organizationId,
      companyId,
      userId: actor.id,
      action: 'ADD_BANK_IDENTIFIER',
      entity: 'Customer',
      entityId: customerId,
      newValue: {
        identifierId: identifier.id,
        identifierType: identifier.identifierType,
      },
    });

    return identifier;
  }

  async getAuditLog(linkId: string, page: number, perPage: number) {
    const link = await this.getLink(linkId);

    const where: Prisma.AuditLogWhereInput = {
      OR: [
        { entity: 'CustomerCompanyLink', entityId: linkId },
        {
          entity: 'Customer',
          entityId: link.customerId,
          companyId: link.companyId,
        },
      ],
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return paginate(items, total, page, perPage);
  }

  // ── Internos ────────────────────────────────────────────────────────────

  private assertContractDates(dto: Partial<ContractDto>) {
    if (dto.isIndefiniteTerm) return;
    if (
      dto.startDate &&
      dto.endDate &&
      new Date(dto.endDate) <= new Date(dto.startDate)
    ) {
      throw new BadRequestException(
        'A data final do contrato deve ser posterior à data inicial.',
      );
    }
  }

  private maskCreditInformation<T extends Record<string, unknown>>(link: T): T {
    const masked = { ...link };
    for (const field of CREDIT_SENSITIVE_FIELDS) {
      (masked as Record<string, unknown>)[field] = null;
    }
    return masked;
  }

  private changeStatus(
    id: string,
    newStatus: CustomerLinkStatus,
    actor: RequestUser,
    opts: {
      action: string;
      reason?: string;
      reasonField?: 'blockReason' | 'suspensionReason';
      clearReasons?: boolean;
    },
  ) {
    return this.getLink(id).then(async (existing) => {
      const updated = await this.prisma.$transaction(async (tx) => {
        const result = await tx.customerCompanyLink.update({
          where: { id },
          data: {
            status: newStatus,
            updatedBy: actor.id,
            ...(opts.reasonField ? { [opts.reasonField]: opts.reason } : {}),
            ...(opts.clearReasons
              ? { blockReason: null, suspensionReason: null }
              : {}),
          },
          include: LINK_DETAIL_INCLUDE,
        });

        await tx.customerStatusHistory.create({
          data: {
            customerCompanyLinkId: id,
            previousStatus: existing.status,
            newStatus,
            reason: opts.reason,
            changedBy: actor.id,
          },
        });

        return result;
      });

      await this.audit.log({
        organizationId: existing.customer.organizationId,
        companyId: existing.companyId,
        userId: actor.id,
        action: opts.action,
        entity: 'CustomerCompanyLink',
        entityId: id,
        field: 'status',
        oldValue: { status: existing.status },
        newValue: { status: newStatus },
        reason: opts.reason,
      });

      return updated;
    });
  }

  private mapLinkScalars(dto: Partial<CreateCompanyLinkDto>) {
    const { companyId: _companyId, ...scalars } = dto;
    return scalars;
  }

  private rethrowIfDuplicateLink(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === UNIQUE_CONSTRAINT_ERROR_CODE
    ) {
      throw new ConflictException(
        'Este cliente já está vinculado à empresa selecionada.',
      );
    }
  }
}
