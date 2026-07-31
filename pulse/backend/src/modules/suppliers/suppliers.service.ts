import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SupplierSystemStatus } from '@prisma/client';

import { paginate } from '../../common/dto/pagination-query.dto';
import type { RequestUser } from '../../common/types/authenticated-request';
import { hasPermissionAnywhere } from '../../common/utils/access-control.util';
import {
  maskAccountFragment,
  maskPixKeyValue,
} from '../../common/utils/mask.util';
import { onlyDigits } from '../../common/utils/normalize.util';
import { COMPANY_REGISTRY_PROVIDER } from '../../integrations/company-registry/company-registry.types';
import type { CompanyRegistryProvider } from '../../integrations/company-registry/company-registry.types';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { DocumentQuerySupplierDto } from './dto/document-query-supplier.dto';
import { QuerySuppliersDto } from './dto/query-suppliers.dto';
import { SaveDraftSupplierDto } from './dto/save-draft-supplier.dto';
import { SupplierBankAccountDto } from './dto/supplier-bank-account.dto';
import { SupplierPixKeyDto } from './dto/supplier-pix-key.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

const UNIQUE_CONSTRAINT_ERROR_CODE = 'P2002';

const SUPPLIER_DETAIL_INCLUDE = {
  addresses: true,
  contacts: true,
  cnaes: true,
  alternativeNames: true,
  bankAccounts: { include: { financialInstitution: true } },
  pixKeys: true,
  companyLinks: {
    where: { deletedAt: null },
    include: {
      company: { select: { id: true, displayName: true, legalName: true } },
    },
  },
} satisfies Prisma.SupplierInclude;

type SupplierPayload =
  CreateSupplierDto | (Partial<CreateSupplierDto> & { organizationId: string });

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    @Inject(COMPANY_REGISTRY_PROVIDER)
    private readonly registryProvider: CompanyRegistryProvider,
  ) {}

  async findAll(query: QuerySuppliersDto, actor: RequestUser) {
    const visibleCompanyIds = actor.isPlatformAdmin
      ? undefined
      : actor.memberships
          .filter((m) => m.permissions.includes('supplier.view'))
          .map((m) => m.companyId);

    const where: Prisma.SupplierCompanyLinkWhereInput = {
      deletedAt: null,
      ...(query.companyId
        ? { companyId: query.companyId }
        : visibleCompanyIds
          ? { companyId: { in: visibleCompanyIds } }
          : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.defaultCategoryId
        ? { defaultCategoryId: query.defaultCategoryId }
        : {}),
      ...(query.defaultCostCenterId
        ? { defaultCostCenterId: query.defaultCostCenterId }
        : {}),
      supplier: {
        deletedAt: null,
        ...(query.documentNumber
          ? {
              normalizedDocumentNumber: {
                contains: onlyDigits(query.documentNumber),
              },
            }
          : {}),
        ...((query.city || query.state) && {
          addresses: {
            some: {
              ...(query.city
                ? { city: { contains: query.city, mode: 'insensitive' } }
                : {}),
              ...(query.state
                ? { state: { equals: query.state, mode: 'insensitive' } }
                : {}),
            },
          },
        }),
        ...(query.search
          ? {
              OR: [
                { legalName: { contains: query.search, mode: 'insensitive' } },
                { tradeName: { contains: query.search, mode: 'insensitive' } },
                {
                  displayName: { contains: query.search, mode: 'insensitive' },
                },
                {
                  normalizedDocumentNumber: {
                    contains: onlyDigits(query.search),
                  },
                },
              ],
            }
          : {}),
      },
    };

    if (query.companyId) {
      this.assertLinkCompanyViewAllowed(actor, query.companyId);
    }

    const [items, total] = await Promise.all([
      this.prisma.supplierCompanyLink.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
        include: {
          supplier: {
            include: { addresses: { where: { isPrimary: true }, take: 1 } },
          },
          defaultCategory: { select: { id: true, name: true } },
          defaultCostCenter: { select: { id: true, name: true } },
        },
      }),
      this.prisma.supplierCompanyLink.count({ where }),
    ]);

    return paginate(items, total, query.page, query.perPage);
  }

  async findOne(id: string, actor?: RequestUser) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, deletedAt: null },
      include: SUPPLIER_DETAIL_INCLUDE,
    });

    if (!supplier) {
      throw new NotFoundException('Fornecedor não encontrado.');
    }

    if (actor && !hasPermissionAnywhere(actor, 'supplier.view_bank_data')) {
      return this.maskBankData(supplier);
    }

    return supplier;
  }

  async create(dto: CreateSupplierDto, actor: RequestUser) {
    return this.persist(dto, SupplierSystemStatus.ACTIVE, actor, 'CREATE');
  }

  async saveDraft(
    dto: SaveDraftSupplierDto & { id?: string },
    actor: RequestUser,
  ) {
    if (dto.id) {
      const existing = await this.findOne(dto.id);

      if (existing.systemStatus !== SupplierSystemStatus.DRAFT) {
        throw new BadRequestException(
          'Apenas fornecedores em rascunho podem ser salvos por este endpoint.',
        );
      }

      return this.persistUpdate(dto.id, dto, actor, 'UPDATE_DRAFT');
    }

    return this.persist(dto, SupplierSystemStatus.DRAFT, actor, 'CREATE_DRAFT');
  }

  async update(id: string, dto: UpdateSupplierDto, actor: RequestUser) {
    return this.persistUpdate(id, dto, actor, 'UPDATE', {
      promoteFromDraft: true,
    });
  }

  async activate(id: string, actor: RequestUser) {
    const supplier = await this.findOne(id);

    if (
      !supplier.normalizedDocumentNumber &&
      supplier.personType !== 'FOREIGN'
    ) {
      throw new BadRequestException(
        'Informe um CPF/CNPJ válido antes de ativar o fornecedor.',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.supplier.update({
        where: { id },
        data: {
          systemStatus: SupplierSystemStatus.ACTIVE,
          updatedBy: actor.id,
        },
        include: SUPPLIER_DETAIL_INCLUDE,
      });
      await tx.supplierStatusHistory.create({
        data: {
          supplierId: id,
          previousStatus: supplier.systemStatus,
          newStatus: SupplierSystemStatus.ACTIVE,
          changedBy: actor.id,
        },
      });
      return result;
    });

    await this.audit.log({
      organizationId: supplier.organizationId,
      userId: actor.id,
      action: 'ACTIVATE',
      entity: 'Supplier',
      entityId: id,
      field: 'systemStatus',
      oldValue: { systemStatus: supplier.systemStatus },
      newValue: { systemStatus: 'ACTIVE' },
    });

    return updated;
  }

  async queryDocument(
    dto: DocumentQuerySupplierDto,
    actor: RequestUser,
    organizationId?: string,
  ) {
    const normalized = onlyDigits(dto.documentNumber);

    const existing = await this.prisma.supplier.findFirst({
      where: { normalizedDocumentNumber: normalized, deletedAt: null },
      select: {
        id: true,
        displayName: true,
        legalName: true,
        systemStatus: true,
      },
    });

    if (existing) {
      return { duplicate: true as const, supplier: existing };
    }

    const result = await this.registryProvider.queryDocument(normalized);

    await this.prisma.supplierRegistryQuery.create({
      data: {
        organizationId,
        documentNumber: normalized,
        provider: result.provider,
        requestStatus: result.success ? 'SUCCESS' : 'ERROR',
        responseSummary: result.success
          ? (result.data as unknown as Prisma.InputJsonValue)
          : undefined,
        queriedBy: actor.id,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      },
    });

    await this.audit.log({
      organizationId,
      userId: actor.id,
      action: 'QUERY_DOCUMENT',
      entity: 'Supplier',
      newValue: {
        documentNumber: normalized,
        provider: result.provider,
        success: result.success,
      },
    });

    return { duplicate: false as const, ...result };
  }

  async remove(id: string, actor: RequestUser) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, deletedAt: null },
      include: {
        companyLinks: { where: { deletedAt: null } },
        bankAccounts: true,
        pixKeys: true,
      },
    });
    if (!supplier) throw new NotFoundException('Fornecedor não encontrado.');

    const documentsCount = await this.prisma.attachment.count({
      where: { entityType: 'Supplier', entityId: id, deletedAt: null },
    });

    const blocked =
      supplier.systemStatus !== SupplierSystemStatus.DRAFT ||
      supplier.companyLinks.length > 0 ||
      supplier.bankAccounts.length > 0 ||
      supplier.pixKeys.length > 0 ||
      documentsCount > 0;

    if (blocked) {
      throw new ConflictException(
        'Este fornecedor possui registros vinculados e não pode ser excluído. Utilize a opção Inativar.',
      );
    }

    await this.prisma.supplier.delete({ where: { id } });

    await this.audit.log({
      organizationId: supplier.organizationId,
      userId: actor.id,
      action: 'DELETE',
      entity: 'Supplier',
      entityId: id,
      oldValue: {
        displayName: supplier.displayName,
        normalizedDocumentNumber: supplier.normalizedDocumentNumber,
      },
    });

    return { id };
  }

  // ── Contas bancárias e chaves PIX (globais ao fornecedor) ──────────────────

  async addBankAccount(
    supplierId: string,
    dto: SupplierBankAccountDto,
    actor: RequestUser,
  ) {
    const supplier = await this.findOne(supplierId);
    this.assertTitularity(
      supplier,
      dto.holderDocument,
      dto.isThirdParty,
      actor,
    );

    const bankAccount = await this.prisma.supplierBankAccount.create({
      data: {
        supplierId,
        financialInstitutionId: dto.financialInstitutionId,
        branchNumber: dto.branchNumber,
        branchDigit: dto.branchDigit,
        accountNumber: dto.accountNumber,
        accountDigit: dto.accountDigit,
        normalizedAccountIdentifier: onlyDigits(
          `${dto.branchNumber}${dto.accountNumber}`,
        ),
        accountType: dto.accountType,
        holderName: dto.holderName,
        holderDocument: dto.holderDocument,
        normalizedHolderDocument: onlyDigits(dto.holderDocument),
        isPrimary: dto.isPrimary ?? false,
        isThirdParty: dto.isThirdParty ?? false,
        thirdPartyReason: dto.thirdPartyReason,
        thirdPartyApprovedBy: dto.isThirdParty ? actor.id : undefined,
        thirdPartyApprovedAt: dto.isThirdParty ? new Date() : undefined,
        createdBy: actor.id,
        updatedBy: actor.id,
      },
    });

    await this.audit.log({
      organizationId: supplier.organizationId,
      userId: actor.id,
      action: 'ADD_BANK_ACCOUNT',
      entity: 'Supplier',
      entityId: supplierId,
      newValue: {
        bankAccountId: bankAccount.id,
        isThirdParty: bankAccount.isThirdParty,
      },
      reason: dto.thirdPartyReason,
    });

    return bankAccount;
  }

  async updateBankAccount(
    supplierId: string,
    bankAccountId: string,
    dto: Partial<SupplierBankAccountDto>,
    actor: RequestUser,
  ) {
    const supplier = await this.findOne(supplierId);
    const existing = await this.prisma.supplierBankAccount.findFirst({
      where: { id: bankAccountId, supplierId },
    });
    if (!existing)
      throw new NotFoundException('Conta bancária não encontrada.');

    if (dto.holderDocument) {
      this.assertTitularity(
        supplier,
        dto.holderDocument,
        dto.isThirdParty,
        actor,
      );
    }

    const updated = await this.prisma.supplierBankAccount.update({
      where: { id: bankAccountId },
      data: {
        ...dto,
        normalizedAccountIdentifier:
          dto.branchNumber || dto.accountNumber
            ? onlyDigits(
                `${dto.branchNumber ?? existing.branchNumber}${dto.accountNumber ?? existing.accountNumber}`,
              )
            : undefined,
        normalizedHolderDocument: dto.holderDocument
          ? onlyDigits(dto.holderDocument)
          : undefined,
        changeStatus: 'PENDING',
        updatedBy: actor.id,
      },
    });

    await this.audit.log({
      organizationId: supplier.organizationId,
      userId: actor.id,
      action: 'UPDATE_BANK_ACCOUNT',
      entity: 'Supplier',
      entityId: supplierId,
      field: 'bankAccount',
      oldValue: { bankAccountId },
      newValue: { bankAccountId },
    });

    return updated;
  }

  async deactivateBankAccount(
    supplierId: string,
    bankAccountId: string,
    actor: RequestUser,
  ) {
    const supplier = await this.findOne(supplierId);
    const updated = await this.prisma.supplierBankAccount.update({
      where: { id: bankAccountId },
      data: { status: 'INACTIVE', updatedBy: actor.id },
    });

    await this.audit.log({
      organizationId: supplier.organizationId,
      userId: actor.id,
      action: 'DEACTIVATE_BANK_ACCOUNT',
      entity: 'Supplier',
      entityId: supplierId,
      newValue: { bankAccountId },
    });

    return updated;
  }

  async addPixKey(
    supplierId: string,
    dto: SupplierPixKeyDto,
    actor: RequestUser,
  ) {
    const supplier = await this.findOne(supplierId);
    this.assertTitularity(
      supplier,
      dto.holderDocument,
      dto.isThirdParty,
      actor,
    );

    const normalizedKey = this.normalizePixKey(dto.pixType, dto.pixKey);

    const existingKey = await this.prisma.supplierPixKey.findFirst({
      where: { normalizedKey, deletedAt: null, status: 'ACTIVE' },
      select: {
        id: true,
        supplierId: true,
        supplier: { select: { displayName: true, legalName: true } },
      },
    });

    if (existingKey && existingKey.supplierId !== supplierId) {
      throw new ConflictException({
        message: 'Esta chave PIX já está vinculada a outro fornecedor.',
        supplier: {
          id: existingKey.supplierId,
          displayName: existingKey.supplier.displayName,
        },
      });
    }

    try {
      const pixKey = await this.prisma.supplierPixKey.create({
        data: {
          supplierId,
          bankAccountId: dto.bankAccountId,
          pixType: dto.pixType,
          pixKey: dto.pixKey,
          normalizedKey,
          holderName: dto.holderName,
          holderDocument: dto.holderDocument,
          normalizedHolderDocument: onlyDigits(dto.holderDocument),
          isPrimary: dto.isPrimary ?? false,
          isThirdParty: dto.isThirdParty ?? false,
          thirdPartyReason: dto.thirdPartyReason,
          createdBy: actor.id,
          updatedBy: actor.id,
        },
      });

      await this.audit.log({
        organizationId: supplier.organizationId,
        userId: actor.id,
        action: 'ADD_PIX_KEY',
        entity: 'Supplier',
        entityId: supplierId,
        newValue: { pixKeyId: pixKey.id, pixType: pixKey.pixType },
      });

      return pixKey;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_ERROR_CODE
      ) {
        throw new ConflictException(
          'Esta chave PIX já está vinculada a outro fornecedor.',
        );
      }
      throw error;
    }
  }

  async updatePixKey(
    supplierId: string,
    pixKeyId: string,
    dto: Partial<SupplierPixKeyDto>,
    actor: RequestUser,
  ) {
    const supplier = await this.findOne(supplierId);
    const existing = await this.prisma.supplierPixKey.findFirst({
      where: { id: pixKeyId, supplierId },
    });
    if (!existing) throw new NotFoundException('Chave PIX não encontrada.');

    if (dto.holderDocument) {
      this.assertTitularity(
        supplier,
        dto.holderDocument,
        dto.isThirdParty,
        actor,
      );
    }

    const updated = await this.prisma.supplierPixKey.update({
      where: { id: pixKeyId },
      data: {
        ...dto,
        normalizedKey:
          dto.pixKey || dto.pixType
            ? this.normalizePixKey(
                dto.pixType ?? existing.pixType,
                dto.pixKey ?? existing.pixKey,
              )
            : undefined,
        normalizedHolderDocument: dto.holderDocument
          ? onlyDigits(dto.holderDocument)
          : undefined,
        changeStatus: 'PENDING',
        updatedBy: actor.id,
      },
    });

    await this.audit.log({
      organizationId: supplier.organizationId,
      userId: actor.id,
      action: 'UPDATE_PIX_KEY',
      entity: 'Supplier',
      entityId: supplierId,
      newValue: { pixKeyId },
    });

    return updated;
  }

  async deactivatePixKey(
    supplierId: string,
    pixKeyId: string,
    actor: RequestUser,
  ) {
    const supplier = await this.findOne(supplierId);
    const updated = await this.prisma.supplierPixKey.update({
      where: { id: pixKeyId },
      data: { status: 'INACTIVE', updatedBy: actor.id },
    });

    await this.audit.log({
      organizationId: supplier.organizationId,
      userId: actor.id,
      action: 'DEACTIVATE_PIX_KEY',
      entity: 'Supplier',
      entityId: supplierId,
      newValue: { pixKeyId },
    });

    return updated;
  }

  async uploadDocument(
    supplierId: string,
    file: Express.Multer.File,
    documentType: string | undefined,
    actor: RequestUser,
  ) {
    const supplier = await this.findOne(supplierId);
    const uploaded = await this.storage.uploadDocument(
      'Supplier',
      supplierId,
      file,
    );

    const attachment = await this.prisma.attachment.create({
      data: {
        organizationId: supplier.organizationId,
        entityType: 'Supplier',
        entityId: supplierId,
        documentType,
        fileName: file.originalname,
        storagePath: uploaded.storagePath,
        mimeType: file.mimetype,
        fileSize: file.size,
        uploadedBy: actor.id,
      },
    });

    await this.audit.log({
      organizationId: supplier.organizationId,
      userId: actor.id,
      action: 'UPLOAD_DOCUMENT',
      entity: 'Supplier',
      entityId: supplierId,
      newValue: { attachmentId: attachment.id, fileName: attachment.fileName },
    });

    return attachment;
  }

  async listDocuments(supplierId: string) {
    await this.findOne(supplierId);
    return this.prisma.attachment.findMany({
      where: { entityType: 'Supplier', entityId: supplierId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Internos ────────────────────────────────────────────────────────────

  private assertLinkCompanyViewAllowed(actor: RequestUser, companyId: string) {
    if (actor.isPlatformAdmin) return;
    const membership = actor.memberships.find((m) => m.companyId === companyId);
    if (!membership || !membership.permissions.includes('supplier.view')) {
      throw new ForbiddenException(
        'Você não tem permissão para visualizar fornecedores desta empresa.',
      );
    }
  }

  private assertTitularity(
    supplier: { normalizedDocumentNumber: string | null },
    holderDocument: string,
    isThirdParty: boolean | undefined,
    actor: RequestUser,
  ) {
    const normalizedHolder = onlyDigits(holderDocument);
    const matches =
      !supplier.normalizedDocumentNumber ||
      supplier.normalizedDocumentNumber === normalizedHolder;

    if (matches) return;

    if (!isThirdParty) {
      throw new BadRequestException(
        'O titular da conta/chave é diferente do fornecedor cadastrado. Confirme como conta/chave de terceiro e informe o motivo.',
      );
    }

    if (
      !hasPermissionAnywhere(actor, 'supplier.allow_third_party_bank_account')
    ) {
      throw new ForbiddenException(
        'Você não tem permissão para cadastrar contas/chaves de terceiro para fornecedores.',
      );
    }
  }

  private normalizePixKey(pixType: string, pixKey: string): string {
    if (pixType === 'EMAIL') return pixKey.trim().toLowerCase();
    if (pixType === 'CPF' || pixType === 'CNPJ' || pixType === 'PHONE')
      return onlyDigits(pixKey);
    return pixKey.trim();
  }

  private maskBankData<
    T extends {
      bankAccounts: {
        branchNumber: string;
        accountNumber: string;
        holderDocument: string;
      }[];
      pixKeys: { pixKey: string; holderDocument: string }[];
    },
  >(supplier: T): T {
    return {
      ...supplier,
      bankAccounts: supplier.bankAccounts.map((account) => ({
        ...account,
        branchNumber:
          maskAccountFragment(account.branchNumber) ?? account.branchNumber,
        accountNumber:
          maskAccountFragment(account.accountNumber) ?? account.accountNumber,
        holderDocument:
          maskAccountFragment(account.holderDocument) ?? account.holderDocument,
      })),
      pixKeys: supplier.pixKeys.map((key) => ({
        ...key,
        pixKey: maskPixKeyValue(key.pixKey) ?? key.pixKey,
        holderDocument:
          maskAccountFragment(key.holderDocument) ?? key.holderDocument,
      })),
    };
  }

  private async persist(
    dto: SupplierPayload,
    systemStatus: SupplierSystemStatus,
    actor: RequestUser,
    action: string,
  ) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: dto.organizationId },
    });
    if (!organization) {
      throw new NotFoundException('Organização não encontrada.');
    }

    const normalizedDocumentNumber = dto.documentNumber
      ? onlyDigits(dto.documentNumber)
      : undefined;

    try {
      const supplier = await this.prisma.supplier.create({
        data: {
          ...this.mapScalarFields(dto),
          organizationId: organization.id,
          documentNumber: normalizedDocumentNumber,
          normalizedDocumentNumber,
          systemStatus,
          createdBy: actor.id,
          updatedBy: actor.id,
          ...this.buildNestedCreatePayload(dto),
        },
        include: SUPPLIER_DETAIL_INCLUDE,
      });

      await this.audit.log({
        organizationId: supplier.organizationId,
        userId: actor.id,
        action,
        entity: 'Supplier',
        entityId: supplier.id,
        newValue: {
          displayName: supplier.displayName,
          normalizedDocumentNumber: supplier.normalizedDocumentNumber,
        },
      });

      return supplier;
    } catch (error) {
      this.rethrowIfKnownConflict(error);
      throw error;
    }
  }

  private async persistUpdate(
    id: string,
    dto: Partial<CreateSupplierDto>,
    actor: RequestUser,
    action: string,
    opts: { promoteFromDraft?: boolean } = {},
  ) {
    const existing = await this.findOne(id);
    const normalizedDocumentNumber = dto.documentNumber
      ? onlyDigits(dto.documentNumber)
      : undefined;
    const shouldPromote =
      Boolean(opts.promoteFromDraft) &&
      existing.systemStatus === SupplierSystemStatus.DRAFT;

    try {
      const supplier = await this.prisma.$transaction(async (tx) => {
        await this.syncNestedCollections(tx, id, dto);

        return tx.supplier.update({
          where: { id },
          data: {
            ...this.mapScalarFields(dto),
            ...(normalizedDocumentNumber
              ? {
                  documentNumber: normalizedDocumentNumber,
                  normalizedDocumentNumber,
                }
              : {}),
            ...(shouldPromote
              ? { systemStatus: SupplierSystemStatus.PENDING_VALIDATION }
              : {}),
            updatedBy: actor.id,
          },
          include: SUPPLIER_DETAIL_INCLUDE,
        });
      });

      await this.audit.log({
        organizationId: supplier.organizationId,
        userId: actor.id,
        action,
        entity: 'Supplier',
        entityId: id,
        oldValue: {
          displayName: existing.displayName,
          systemStatus: existing.systemStatus,
        },
        newValue: {
          displayName: supplier.displayName,
          systemStatus: supplier.systemStatus,
        },
      });

      return supplier;
    } catch (error) {
      this.rethrowIfKnownConflict(error);
      throw error;
    }
  }

  private mapScalarFields(dto: Partial<CreateSupplierDto>) {
    const {
      addresses: _addresses,
      contacts: _contacts,
      cnaes: _cnaes,
      bankAccounts: _bankAccounts,
      pixKeys: _pixKeys,
      companyLink: _companyLink,
      documentNumber: _doc,
      organizationId: _organizationId,
      ...scalars
    } = dto;

    return {
      ...scalars,
      ...(dto.openingDate ? { openingDate: new Date(dto.openingDate) } : {}),
      ...(dto.shareCapital !== undefined
        ? { shareCapital: new Prisma.Decimal(dto.shareCapital) }
        : {}),
    };
  }

  private buildNestedCreatePayload(dto: SupplierPayload) {
    const payload: Record<string, unknown> = {};

    if (dto.addresses?.length) {
      payload.addresses = {
        create: dto.addresses.map((a) => this.mapAddress(a)),
      };
    }
    if (dto.contacts?.length) {
      payload.contacts = {
        create: dto.contacts.map((c) => this.mapContact(c)),
      };
    }
    if (dto.cnaes?.length) {
      payload.cnaes = { create: dto.cnaes };
      const mainCnae = dto.cnaes.find((c) => c.isMain) ?? dto.cnaes[0];
      payload.mainCnae = mainCnae.cnaeCode;
    }
    if (dto.bankAccounts?.length) {
      payload.bankAccounts = {
        create: dto.bankAccounts.map((b) => ({
          ...b,
          normalizedAccountIdentifier: onlyDigits(
            `${b.branchNumber}${b.accountNumber}`,
          ),
          normalizedHolderDocument: onlyDigits(b.holderDocument),
        })),
      };
    }
    if (dto.pixKeys?.length) {
      payload.pixKeys = {
        create: dto.pixKeys.map((p) => ({
          ...p,
          normalizedKey: this.normalizePixKey(p.pixType, p.pixKey),
          normalizedHolderDocument: onlyDigits(p.holderDocument),
        })),
      };
    }

    return payload;
  }

  private async syncNestedCollections(
    tx: Prisma.TransactionClient,
    supplierId: string,
    dto: Partial<CreateSupplierDto>,
  ) {
    if (dto.addresses !== undefined) {
      await tx.supplierAddress.deleteMany({ where: { supplierId } });
      if (dto.addresses.length > 0) {
        await tx.supplierAddress.createMany({
          data: dto.addresses.map((a) => ({
            ...this.mapAddress(a),
            supplierId,
          })),
        });
      }
    }

    if (dto.contacts !== undefined) {
      await tx.supplierContact.deleteMany({ where: { supplierId } });
      if (dto.contacts.length > 0) {
        await tx.supplierContact.createMany({
          data: dto.contacts.map((c) => ({
            ...this.mapContact(c),
            supplierId,
          })),
        });
      }
    }

    if (dto.cnaes !== undefined) {
      await tx.supplierCnae.deleteMany({ where: { supplierId } });
      if (dto.cnaes.length > 0) {
        await tx.supplierCnae.createMany({
          data: dto.cnaes.map((c) => ({ ...c, supplierId })),
        });
        const mainCnae = dto.cnaes.find((c) => c.isMain) ?? dto.cnaes[0];
        await tx.supplier.update({
          where: { id: supplierId },
          data: { mainCnae: mainCnae.cnaeCode },
        });
      }
    }
  }

  private mapAddress(
    address: NonNullable<CreateSupplierDto['addresses']>[number],
  ) {
    const { id: _id, postalCode, ...rest } = address;
    return {
      ...rest,
      postalCode,
      normalizedPostalCode: onlyDigits(postalCode),
    };
  }

  private mapContact(
    contact: NonNullable<CreateSupplierDto['contacts']>[number],
  ) {
    const { id: _id, ...rest } = contact;
    return rest;
  }

  private rethrowIfKnownConflict(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === UNIQUE_CONSTRAINT_ERROR_CODE
    ) {
      const target =
        (error.meta?.target as string[] | undefined)?.join(',') ?? '';

      if (target.includes('normalized_document_number')) {
        throw new ConflictException(
          'Este fornecedor já está cadastrado na plataforma. Vincule-o à empresa em vez de criar um novo cadastro.',
        );
      }

      throw new ConflictException('Já existe um registro com estes dados.');
    }
  }
}
