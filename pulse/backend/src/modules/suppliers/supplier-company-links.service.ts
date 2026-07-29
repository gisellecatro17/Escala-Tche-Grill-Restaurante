import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SupplierLinkStatus } from '@prisma/client';

import { paginate } from '../../common/dto/pagination-query.dto';
import type { RequestUser } from '../../common/types/authenticated-request';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AllocationDto } from './dto/allocation.dto';
import { ChangeLinkStatusDto } from './dto/change-link-status.dto';
import { ClassificationRuleDto } from './dto/classification-rule.dto';
import { ContractDto } from './dto/contract.dto';
import { CreateCompanyLinkDto } from './dto/create-company-link.dto';
import {
  DuplicateLinkAspect,
  DuplicateLinkDto,
} from './dto/duplicate-link.dto';
import { TaxWithholdingDto } from './dto/tax-withholding.dto';
import { UpdateCompanyLinkDto } from './dto/update-company-link.dto';

const UNIQUE_CONSTRAINT_ERROR_CODE = 'P2002';

const LINK_DETAIL_INCLUDE = {
  supplier: true,
  company: { select: { id: true, displayName: true, legalName: true } },
  defaultCategory: { select: { id: true, name: true } },
  defaultSubcategory: { select: { id: true, name: true } },
  defaultCostCenter: { select: { id: true, name: true } },
  classificationRules: { where: { deletedAt: null } },
  allocations: { where: { deletedAt: null } },
  taxWithholdings: { where: { deletedAt: null } },
  contracts: { where: { deletedAt: null } },
} satisfies Prisma.SupplierCompanyLinkInclude;

@Injectable()
export class SupplierCompanyLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createLink(
    supplierId: string,
    dto: CreateCompanyLinkDto,
    actor: RequestUser,
  ) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, deletedAt: null },
    });
    if (!supplier) throw new NotFoundException('Fornecedor não encontrado.');

    const company = await this.prisma.company.findFirst({
      where: { id: dto.companyId, deletedAt: null },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada.');

    try {
      const link = await this.prisma.supplierCompanyLink.create({
        data: {
          ...this.mapLinkScalars(dto),
          supplierId,
          companyId: dto.companyId,
          status: SupplierLinkStatus.ACTIVE,
          createdBy: actor.id,
          updatedBy: actor.id,
        },
        include: LINK_DETAIL_INCLUDE,
      });

      await this.audit.log({
        organizationId: supplier.organizationId,
        companyId: dto.companyId,
        userId: actor.id,
        action: 'CREATE_COMPANY_LINK',
        entity: 'SupplierCompanyLink',
        entityId: link.id,
        newValue: { supplierId, companyId: dto.companyId },
      });

      return link;
    } catch (error) {
      this.rethrowIfDuplicateLink(error);
      throw error;
    }
  }

  async getLink(id: string) {
    const link = await this.prisma.supplierCompanyLink.findFirst({
      where: { id, deletedAt: null },
      include: LINK_DETAIL_INCLUDE,
    });
    if (!link) throw new NotFoundException('Vínculo não encontrado.');
    return link;
  }

  async updateLink(id: string, dto: UpdateCompanyLinkDto, actor: RequestUser) {
    const existing = await this.getLink(id);

    const link = await this.prisma.supplierCompanyLink.update({
      where: { id },
      data: { ...this.mapLinkScalars(dto), updatedBy: actor.id },
      include: LINK_DETAIL_INCLUDE,
    });

    await this.audit.log({
      organizationId: existing.supplier.organizationId,
      companyId: existing.companyId,
      userId: actor.id,
      action: 'UPDATE_COMPANY_LINK',
      entity: 'SupplierCompanyLink',
      entityId: id,
    });

    return link;
  }

  async activate(id: string, actor: RequestUser) {
    return this.changeStatus(id, SupplierLinkStatus.ACTIVE, actor, {
      action: 'ACTIVATE_LINK',
      clearReasons: true,
    });
  }

  async deactivate(id: string, dto: ChangeLinkStatusDto, actor: RequestUser) {
    return this.changeStatus(id, SupplierLinkStatus.INACTIVE, actor, {
      action: 'DEACTIVATE_LINK',
      reason: dto.reason,
    });
  }

  async suspend(id: string, dto: ChangeLinkStatusDto, actor: RequestUser) {
    if (!dto.reason)
      throw new BadRequestException('Informe o motivo da suspensão.');
    return this.changeStatus(id, SupplierLinkStatus.SUSPENDED, actor, {
      action: 'SUSPEND_LINK',
      reason: dto.reason,
      reasonField: 'suspensionReason',
    });
  }

  async block(id: string, dto: ChangeLinkStatusDto, actor: RequestUser) {
    if (!dto.reason)
      throw new BadRequestException('Informe o motivo do bloqueio.');
    return this.changeStatus(id, SupplierLinkStatus.BLOCKED, actor, {
      action: 'BLOCK_LINK',
      reason: dto.reason,
      reasonField: 'blockReason',
    });
  }

  async unblock(id: string, actor: RequestUser) {
    return this.changeStatus(id, SupplierLinkStatus.ACTIVE, actor, {
      action: 'UNBLOCK_LINK',
      clearReasons: true,
    });
  }

  async remove(id: string, actor: RequestUser) {
    const link = await this.getLink(id);

    if (link.status !== SupplierLinkStatus.DRAFT) {
      throw new ConflictException(
        'Este fornecedor possui registros vinculados e não pode ser excluído. Utilize a opção Inativar.',
      );
    }

    if (link.contracts.length > 0) {
      throw new ConflictException(
        'Este fornecedor possui registros vinculados e não pode ser excluído. Utilize a opção Inativar.',
      );
    }

    await this.prisma.supplierCompanyLink.delete({ where: { id } });

    await this.audit.log({
      organizationId: link.supplier.organizationId,
      companyId: link.companyId,
      userId: actor.id,
      action: 'DELETE_LINK',
      entity: 'SupplierCompanyLink',
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
      DEFAULT_CATEGORY: () =>
        (copyData.defaultCategoryId = source.defaultCategoryId),
      DEFAULT_SUBCATEGORY: () =>
        (copyData.defaultSubcategoryId = source.defaultSubcategoryId),
      DEFAULT_COST_CENTER: () =>
        (copyData.defaultCostCenterId = source.defaultCostCenterId),
      ACCOUNTING_ACCOUNT: () =>
        (copyData.defaultAccountingAccount = source.defaultAccountingAccount),
      PAYMENT_TERMS: () => {
        copyData.paymentTermDays = source.paymentTermDays;
        copyData.paymentTermFixedDueDay = source.paymentTermFixedDueDay;
        copyData.paymentTermPeriodicity = source.paymentTermPeriodicity;
      },
      PAYMENT_METHOD: () =>
        (copyData.preferredPaymentMethod = source.preferredPaymentMethod),
      BANK_DATA: () =>
        (copyData.preferredBankAccountId = source.preferredBankAccountId),
      PIX_KEYS: () => (copyData.preferredPixKeyId = source.preferredPixKeyId),
      TAX_WITHHOLDINGS: () => undefined,
      ALLOCATIONS: () => undefined,
      AUTOMATION_RULES: () => {
        copyData.autoIdentificationEnabled = source.autoIdentificationEnabled;
        copyData.autoClassificationEnabled = source.autoClassificationEnabled;
        copyData.autoCostCenterEnabled = source.autoCostCenterEnabled;
        copyData.autoAllocationEnabled = source.autoAllocationEnabled;
        copyData.reconciliationSuggestionEnabled =
          source.reconciliationSuggestionEnabled;
        copyData.autoEntryCreationEnabled = source.autoEntryCreationEnabled;
        copyData.autoReconciliationEnabled = source.autoReconciliationEnabled;
        copyData.confirmationThreshold = source.confirmationThreshold;
      },
      CONTRACTS: () => undefined,
    };

    dto.aspects.forEach((aspect) => aspectMap[aspect]());

    try {
      const newLink = await this.prisma.$transaction(async (tx) => {
        const created = await tx.supplierCompanyLink.create({
          data: {
            supplierId: source.supplierId,
            companyId: dto.targetCompanyId,
            supplierTypes: source.supplierTypes,
            status: SupplierLinkStatus.DRAFT,
            ...copyData,
            createdBy: actor.id,
            updatedBy: actor.id,
          },
          include: LINK_DETAIL_INCLUDE,
        });

        if (
          dto.aspects.includes('TAX_WITHHOLDINGS') &&
          source.taxWithholdings.length > 0
        ) {
          await tx.supplierTaxWithholding.createMany({
            data: source.taxWithholdings.map((w) => ({
              supplierCompanyLinkId: created.id,
              taxType: w.taxType,
              rate: w.rate,
              minimumAmount: w.minimumAmount,
              calculationBase: w.calculationBase,
              serviceCode: w.serviceCode,
              cityCode: w.cityCode,
              revenueCode: w.revenueCode,
              automatic: w.automatic,
              requiresConfirmation: w.requiresConfirmation,
              notes: w.notes,
            })),
          });
        }

        if (
          dto.aspects.includes('ALLOCATIONS') &&
          source.allocations.length > 0
        ) {
          await tx.supplierDefaultAllocation.createMany({
            data: source.allocations.map((a) => ({
              supplierCompanyLinkId: created.id,
              categoryId: a.categoryId,
              costCenterId: a.costCenterId,
              allocationType: a.allocationType,
              percentage: a.percentage,
              fixedAmount: a.fixedAmount,
              priority: a.priority,
            })),
          });
        }

        if (dto.aspects.includes('CONTRACTS') && source.contracts.length > 0) {
          await tx.supplierContract.createMany({
            data: source.contracts.map((c) => ({
              supplierCompanyLinkId: created.id,
              contractNumber: c.contractNumber,
              description: c.description,
              object: c.object,
              contractValue: c.contractValue,
              startDate: c.startDate,
              endDate: c.endDate,
              automaticRenewal: c.automaticRenewal,
              billingFrequency: c.billingFrequency,
              adjustmentIndex: c.adjustmentIndex,
              adjustmentDate: c.adjustmentDate,
              status: 'DRAFT',
              notes: c.notes,
            })),
          });
        }

        return this.getLink(created.id);
      });

      await this.audit.log({
        organizationId: source.supplier.organizationId,
        companyId: dto.targetCompanyId,
        userId: actor.id,
        action: 'DUPLICATE_LINK',
        entity: 'SupplierCompanyLink',
        entityId: newLink.id,
        newValue: { sourceLinkId: source.id, aspects: dto.aspects },
      });

      return newLink;
    } catch (error) {
      this.rethrowIfDuplicateLink(error);
      throw error;
    }
  }

  // ── Regras de classificação, rateios, retenções e contratos ────────────────

  async addClassificationRule(
    linkId: string,
    dto: ClassificationRuleDto,
    actor: RequestUser,
  ) {
    const link = await this.getLink(linkId);

    const rule = await this.prisma.supplierClassificationRule.create({
      data: {
        supplierCompanyLinkId: linkId,
        ruleType: dto.ruleType,
        conditionField: dto.conditionField,
        conditionOperator: dto.conditionOperator,
        conditionValue: dto.conditionValue,
        normalizedValue: dto.conditionValue.trim().toUpperCase(),
        categoryId: dto.categoryId,
        subcategoryId: dto.subcategoryId,
        costCenterId: dto.costCenterId,
        priority: dto.priority,
        confidence: dto.confidence,
        automatic: dto.automatic,
        requiresConfirmation: dto.requiresConfirmation,
        createdBy: actor.id,
        updatedBy: actor.id,
      },
    });

    await this.audit.log({
      organizationId: link.supplier.organizationId,
      companyId: link.companyId,
      userId: actor.id,
      action: 'ADD_CLASSIFICATION_RULE',
      entity: 'SupplierCompanyLink',
      entityId: linkId,
      newValue: { ruleId: rule.id },
    });

    return rule;
  }

  async updateClassificationRule(
    linkId: string,
    ruleId: string,
    dto: Partial<ClassificationRuleDto>,
    actor: RequestUser,
  ) {
    const link = await this.getLink(linkId);
    const existing = await this.prisma.supplierClassificationRule.findFirst({
      where: { id: ruleId, supplierCompanyLinkId: linkId },
    });
    if (!existing)
      throw new NotFoundException('Regra de classificação não encontrada.');

    const rule = await this.prisma.supplierClassificationRule.update({
      where: { id: ruleId },
      data: {
        ...dto,
        normalizedValue: dto.conditionValue
          ? dto.conditionValue.trim().toUpperCase()
          : undefined,
        updatedBy: actor.id,
      },
    });

    await this.audit.log({
      organizationId: link.supplier.organizationId,
      companyId: link.companyId,
      userId: actor.id,
      action: 'UPDATE_CLASSIFICATION_RULE',
      entity: 'SupplierCompanyLink',
      entityId: linkId,
      newValue: { ruleId },
    });

    return rule;
  }

  async addAllocation(linkId: string, dto: AllocationDto, actor: RequestUser) {
    const link = await this.getLink(linkId);

    if (dto.allocationType === 'PERCENTAGE') {
      const currentTotal = link.allocations
        .filter(
          (a) => a.allocationType === 'PERCENTAGE' && a.status === 'ACTIVE',
        )
        .reduce((sum, a) => sum + Number(a.percentage ?? 0), 0);

      if (currentTotal + (dto.percentage ?? 0) > 100) {
        throw new BadRequestException(
          'A soma dos rateios deve ser igual a 100%.',
        );
      }
    }

    const allocation = await this.prisma.supplierDefaultAllocation.create({
      data: {
        supplierCompanyLinkId: linkId,
        categoryId: dto.categoryId,
        costCenterId: dto.costCenterId,
        allocationType: dto.allocationType,
        percentage: dto.percentage,
        fixedAmount: dto.fixedAmount,
        priority: dto.priority,
      },
    });

    await this.audit.log({
      organizationId: link.supplier.organizationId,
      companyId: link.companyId,
      userId: actor.id,
      action: 'ADD_ALLOCATION',
      entity: 'SupplierCompanyLink',
      entityId: linkId,
      newValue: { allocationId: allocation.id },
    });

    return allocation;
  }

  async addTaxWithholding(
    linkId: string,
    dto: TaxWithholdingDto,
    actor: RequestUser,
  ) {
    const link = await this.getLink(linkId);

    const withholding = await this.prisma.supplierTaxWithholding.create({
      data: { supplierCompanyLinkId: linkId, ...dto },
    });

    await this.audit.log({
      organizationId: link.supplier.organizationId,
      companyId: link.companyId,
      userId: actor.id,
      action: 'ADD_TAX_WITHHOLDING',
      entity: 'SupplierCompanyLink',
      entityId: linkId,
      newValue: { withholdingId: withholding.id, taxType: withholding.taxType },
    });

    return withholding;
  }

  async addContract(linkId: string, dto: ContractDto, actor: RequestUser) {
    const link = await this.getLink(linkId);

    const contract = await this.prisma.supplierContract.create({
      data: {
        supplierCompanyLinkId: linkId,
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        adjustmentDate: dto.adjustmentDate
          ? new Date(dto.adjustmentDate)
          : undefined,
        createdBy: actor.id,
        updatedBy: actor.id,
      },
    });

    await this.prisma.supplierCompanyLink.update({
      where: { id: linkId },
      data: { hasContract: true },
    });

    await this.audit.log({
      organizationId: link.supplier.organizationId,
      companyId: link.companyId,
      userId: actor.id,
      action: 'ADD_CONTRACT',
      entity: 'SupplierCompanyLink',
      entityId: linkId,
      newValue: { contractId: contract.id },
    });

    return contract;
  }

  async getAuditLog(linkId: string, page: number, perPage: number) {
    const link = await this.getLink(linkId);

    const where: Prisma.AuditLogWhereInput = {
      OR: [
        { entity: 'SupplierCompanyLink', entityId: linkId },
        {
          entity: 'Supplier',
          entityId: link.supplierId,
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

  private changeStatus(
    id: string,
    newStatus: SupplierLinkStatus,
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
        const result = await tx.supplierCompanyLink.update({
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

        await tx.supplierStatusHistory.create({
          data: {
            supplierCompanyLinkId: id,
            previousStatus: existing.status,
            newStatus,
            reason: opts.reason,
            changedBy: actor.id,
          },
        });

        return result;
      });

      await this.audit.log({
        organizationId: existing.supplier.organizationId,
        companyId: existing.companyId,
        userId: actor.id,
        action: opts.action,
        entity: 'SupplierCompanyLink',
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
        'Este fornecedor já está vinculado à empresa selecionada.',
      );
    }
  }
}
