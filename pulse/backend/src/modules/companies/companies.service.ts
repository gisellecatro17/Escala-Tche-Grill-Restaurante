import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CompanySystemStatus, Prisma } from '@prisma/client';

import { paginate } from '../../common/dto/pagination-query.dto';
import type { RequestUser } from '../../common/types/authenticated-request';
import { onlyDigits } from '../../common/utils/normalize.util';
import { COMPANY_REGISTRY_PROVIDER } from '../../integrations/company-registry/company-registry.types';
import type { CompanyRegistryProvider } from '../../integrations/company-registry/company-registry.types';
import { POSTAL_CODE_PROVIDER } from '../../integrations/postal-code/postal-code.types';
import type { PostalCodeProvider } from '../../integrations/postal-code/postal-code.types';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { ChangeCompanyStatusDto } from './dto/change-company-status.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { DocumentQueryDto } from './dto/document-query.dto';
import {
  DuplicateSettingsAspect,
  DuplicateSettingsDto,
} from './dto/duplicate-settings.dto';
import { PostalCodeQueryDto } from './dto/postal-code-query.dto';
import { QueryCompaniesDto } from './dto/query-companies.dto';
import { SaveDraftCompanyDto } from './dto/save-draft-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

const UNIQUE_CONSTRAINT_ERROR_CODE = 'P2002';

const COMPANY_DETAIL_INCLUDE = {
  addresses: true,
  contacts: true,
  cnaes: true,
  parentCompany: { select: { id: true, displayName: true, legalName: true } },
  branches: {
    select: {
      id: true,
      displayName: true,
      legalName: true,
      systemStatus: true,
    },
  },
  statusHistory: { orderBy: { changedAt: 'desc' as const }, take: 20 },
} satisfies Prisma.CompanyInclude;

type CompanyPayload =
  CreateCompanyDto | (Partial<CreateCompanyDto> & { organizationId: string });

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    @Inject(COMPANY_REGISTRY_PROVIDER)
    private readonly registryProvider: CompanyRegistryProvider,
    @Inject(POSTAL_CODE_PROVIDER)
    private readonly postalCodeProvider: PostalCodeProvider,
  ) {}

  async findAll(query: QueryCompaniesDto, actor: RequestUser) {
    const visibleCompanyIds = actor.isPlatformAdmin
      ? undefined
      : actor.memberships.map((m) => m.companyId);

    const where: Prisma.CompanyWhereInput = {
      deletedAt: null,
      ...(visibleCompanyIds ? { id: { in: visibleCompanyIds } } : {}),
      ...(query.organizationId ? { organizationId: query.organizationId } : {}),
      ...(query.systemStatus ? { systemStatus: query.systemStatus } : {}),
      ...(query.establishmentType
        ? { establishmentType: query.establishmentType }
        : {}),
      ...(query.externalRegistrationStatus
        ? {
            externalRegistrationStatus: {
              equals: query.externalRegistrationStatus,
              mode: 'insensitive',
            },
          }
        : {}),
      ...((query.createdFrom || query.createdTo) && {
        createdAt: {
          ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : {}),
          ...(query.createdTo ? { lte: new Date(query.createdTo) } : {}),
        },
      }),
      ...(query.search
        ? {
            OR: [
              { legalName: { contains: query.search, mode: 'insensitive' } },
              { tradeName: { contains: query.search, mode: 'insensitive' } },
              { displayName: { contains: query.search, mode: 'insensitive' } },
              { internalCode: { contains: query.search, mode: 'insensitive' } },
              {
                normalizedDocumentNumber: {
                  contains: onlyDigits(query.search),
                },
              },
            ],
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
    };

    const orderableFields = new Set([
      'legalName',
      'displayName',
      'createdAt',
      'updatedAt',
      'systemStatus',
    ]);
    const orderBy = orderableFields.has(query.orderBy ?? '')
      ? query.orderBy!
      : 'displayName';

    const [items, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        orderBy: { [orderBy]: query.order ?? 'asc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
        include: { addresses: { where: { isPrimary: true }, take: 1 } },
      }),
      this.prisma.company.count({ where }),
    ]);

    return paginate(items, total, query.page, query.perPage);
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findFirst({
      where: { id, deletedAt: null },
      include: COMPANY_DETAIL_INCLUDE,
    });

    if (!company) {
      throw new NotFoundException('Empresa não encontrada.');
    }

    return company;
  }

  async create(dto: CreateCompanyDto, actor: RequestUser) {
    return this.persist(
      dto,
      CompanySystemStatus.IMPLEMENTATION,
      actor,
      'CREATE',
    );
  }

  async saveDraft(
    dto: SaveDraftCompanyDto & { id?: string },
    actor: RequestUser,
  ) {
    if (dto.id) {
      const existing = await this.findOne(dto.id);

      if (existing.systemStatus !== CompanySystemStatus.DRAFT) {
        throw new BadRequestException(
          'Apenas empresas em rascunho podem ser salvas por este endpoint.',
        );
      }

      return this.persistUpdate(dto.id, dto, actor, 'UPDATE_DRAFT');
    }

    return this.persist(dto, CompanySystemStatus.DRAFT, actor, 'CREATE_DRAFT');
  }

  async update(id: string, dto: UpdateCompanyDto, actor: RequestUser) {
    // Uma edição "de verdade" (fora do endpoint de rascunhos) promove o cadastro de
    // DRAFT para IMPLEMENTATION — a empresa segue precisando de ativação explícita
    // (seção 33) para virar ACTIVE, mas deixa de aparecer como rascunho.
    return this.persistUpdate(id, dto, actor, 'UPDATE', {
      promoteFromDraft: true,
    });
  }

  /** Lista de pendências que impedem a ativação da empresa (seção 31 do prompt mestre). */
  async getActivationPendencies(id: string): Promise<string[]> {
    const company = await this.findOne(id);
    const pendencies: string[] = [];

    if (!company.normalizedDocumentNumber)
      pendencies.push('Documento (CPF/CNPJ) válido.');
    if (!company.legalName) pendencies.push('Razão social ou nome.');
    if (!company.displayName) pendencies.push('Nome de exibição.');
    if (!company.organizationId) pendencies.push('Organização.');
    if (!company.addresses.some((a) => a.isPrimary))
      pendencies.push('Endereço principal.');
    if (!company.currencyCode || !company.timezone)
      pendencies.push('Configuração financeira básica.');

    const hasAdminUser = await this.prisma.userCompanyRole.findFirst({
      where: {
        companyId: id,
        status: 'ACTIVE',
        role: { slug: { in: ['company_admin', 'organization_admin'] } },
      },
    });
    if (!hasAdminUser) pendencies.push('Usuário administrador vinculado.');

    return pendencies;
  }

  async activate(id: string, actor: RequestUser) {
    const company = await this.findOne(id);

    const pendencies = await this.getActivationPendencies(id);
    if (pendencies.length > 0) {
      throw new BadRequestException({
        message: 'A empresa possui pendências e não pode ser ativada.',
        pendencies,
      });
    }

    return this.changeStatus(company, CompanySystemStatus.ACTIVE, actor, {
      action:
        company.systemStatus === CompanySystemStatus.SUSPENDED
          ? 'REACTIVATE'
          : 'ACTIVATE',
      clearReasons: true,
    });
  }

  async deactivate(
    id: string,
    dto: ChangeCompanyStatusDto,
    actor: RequestUser,
  ) {
    const company = await this.findOne(id);

    return this.changeStatus(company, CompanySystemStatus.INACTIVE, actor, {
      action: 'DEACTIVATE',
      reason: dto.reason,
      reasonField: 'deactivationReason',
    });
  }

  async suspend(id: string, dto: ChangeCompanyStatusDto, actor: RequestUser) {
    if (!dto.reason) {
      throw new BadRequestException('Informe o motivo da suspensão.');
    }

    const company = await this.findOne(id);

    return this.changeStatus(company, CompanySystemStatus.SUSPENDED, actor, {
      action: 'SUSPEND',
      reason: dto.reason,
      reasonField: 'suspensionReason',
    });
  }

  async reactivate(id: string, actor: RequestUser) {
    return this.activate(id, actor);
  }

  async remove(id: string, actor: RequestUser) {
    const company = await this.findOne(id);

    if (company.systemStatus !== CompanySystemStatus.DRAFT) {
      throw new ConflictException(
        'Esta empresa possui registros vinculados e não pode ser excluída. Utilize a opção Inativar.',
      );
    }

    const [branchesCount, membershipsCount] = await Promise.all([
      this.prisma.company.count({
        where: { parentCompanyId: id, deletedAt: null },
      }),
      this.prisma.userCompanyRole.count({
        where: { companyId: id, status: 'ACTIVE' },
      }),
    ]);

    // Verificações futuras a incluir aqui conforme os módulos forem desenvolvidos:
    // fornecedores, clientes, contas bancárias, lançamentos, extratos e conciliações vinculados.
    if (branchesCount > 0 || membershipsCount > 0) {
      throw new ConflictException(
        'Esta empresa possui registros vinculados e não pode ser excluída. Utilize a opção Inativar.',
      );
    }

    await this.prisma.company.delete({ where: { id } });

    await this.audit.log({
      organizationId: company.organizationId,
      companyId: id,
      userId: actor.id,
      action: 'DELETE',
      entity: 'Company',
      entityId: id,
      oldValue: {
        displayName: company.displayName,
        normalizedDocumentNumber: company.normalizedDocumentNumber,
      },
    });

    return { id };
  }

  async uploadLogo(id: string, file: Express.Multer.File, actor: RequestUser) {
    const company = await this.findOne(id);

    const logoUrl = await this.storage.uploadCompanyLogo(id, file);

    if (company.logoUrl) {
      await this.storage.removeCompanyLogo(company.logoUrl);
    }

    const updated = await this.prisma.company.update({
      where: { id },
      data: { logoUrl, updatedBy: actor.id },
    });

    await this.audit.log({
      organizationId: company.organizationId,
      companyId: id,
      userId: actor.id,
      action: 'UPLOAD_LOGO',
      entity: 'Company',
      entityId: id,
      field: 'logoUrl',
      oldValue: { logoUrl: company.logoUrl },
      newValue: { logoUrl: updated.logoUrl },
    });

    return updated;
  }

  async removeLogo(id: string, actor: RequestUser) {
    const company = await this.findOne(id);

    if (company.logoUrl) {
      await this.storage.removeCompanyLogo(company.logoUrl);
    }

    const updated = await this.prisma.company.update({
      where: { id },
      data: { logoUrl: null, updatedBy: actor.id },
    });

    await this.audit.log({
      organizationId: company.organizationId,
      companyId: id,
      userId: actor.id,
      action: 'REMOVE_LOGO',
      entity: 'Company',
      entityId: id,
      field: 'logoUrl',
      oldValue: { logoUrl: company.logoUrl },
      newValue: { logoUrl: null },
    });

    return updated;
  }

  async queryDocument(
    dto: DocumentQueryDto,
    actor: RequestUser,
    organizationId?: string,
  ) {
    const normalized = onlyDigits(dto.documentNumber);

    const existing = await this.prisma.company.findFirst({
      where: { normalizedDocumentNumber: normalized, deletedAt: null },
      select: { id: true, displayName: true, systemStatus: true },
    });

    if (existing) {
      return {
        duplicate: true as const,
        company: existing,
      };
    }

    const result = await this.registryProvider.queryDocument(normalized);

    await this.prisma.companyRegistryQuery.create({
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
      entity: 'Company',
      newValue: {
        documentNumber: normalized,
        provider: result.provider,
        success: result.success,
      },
    });

    return { duplicate: false as const, ...result };
  }

  async queryPostalCode(dto: PostalCodeQueryDto, actor: RequestUser) {
    const normalized = onlyDigits(dto.postalCode);
    const result = await this.postalCodeProvider.queryPostalCode(normalized);

    await this.audit.log({
      userId: actor.id,
      action: 'QUERY_POSTAL_CODE',
      entity: 'Company',
      newValue: {
        postalCode: normalized,
        provider: result.provider,
        success: result.success,
      },
    });

    return result;
  }

  async duplicateSettings(
    id: string,
    dto: DuplicateSettingsDto,
    actor: RequestUser,
  ) {
    const source = await this.findOne(id);
    const target = await this.findOne(dto.targetCompanyId);

    if (source.id === target.id) {
      throw new BadRequestException(
        'Selecione uma empresa de destino diferente da empresa de origem.',
      );
    }

    // Todos os aspectos ainda estão indisponíveis nesta etapa (categorias, centros de
    // custo, formas de pagamento, parâmetros financeiros, perfis de acesso, regras de
    // aprovação e de conciliação dependem de módulos que serão desenvolvidos a seguir).
    // O serviço já expõe a estrutura completa para que, quando cada módulo existir, baste
    // implementar sua cópia aqui.
    const results: {
      aspect: DuplicateSettingsAspect;
      status: 'not_available';
      message: string;
    }[] = dto.aspects.map((aspect) => ({
      aspect,
      status: 'not_available' as const,
      message:
        'Este item ainda não está disponível para duplicação nesta etapa do Pulse.',
    }));

    await this.audit.log({
      organizationId: source.organizationId,
      companyId: source.id,
      userId: actor.id,
      action: 'DUPLICATE_SETTINGS_ATTEMPT',
      entity: 'Company',
      entityId: source.id,
      newValue: { targetCompanyId: target.id, aspects: dto.aspects },
    });

    return { sourceCompanyId: source.id, targetCompanyId: target.id, results };
  }

  async getAuditLog(id: string, page: number, perPage: number) {
    await this.findOne(id);

    const where = { companyId: id };
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

  private async persist(
    dto: CompanyPayload,
    systemStatus: CompanySystemStatus,
    actor: RequestUser,
    action: string,
  ) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: dto.organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organização não encontrada.');
    }

    const internalCode = await this.resolveInternalCode(dto, organization.id);
    const normalizedDocumentNumber = dto.documentNumber
      ? onlyDigits(dto.documentNumber)
      : undefined;

    try {
      const company = await this.prisma.company.create({
        data: {
          ...this.mapScalarFields(dto),
          organizationId: organization.id,
          internalCode,
          documentNumber: normalizedDocumentNumber,
          normalizedDocumentNumber,
          systemStatus,
          createdBy: actor.id,
          updatedBy: actor.id,
          ...this.buildNestedCreatePayload(dto),
        },
        include: COMPANY_DETAIL_INCLUDE,
      });

      await this.audit.log({
        organizationId: company.organizationId,
        companyId: company.id,
        userId: actor.id,
        action,
        entity: 'Company',
        entityId: company.id,
        newValue: {
          displayName: company.displayName,
          normalizedDocumentNumber: company.normalizedDocumentNumber,
        },
      });

      return company;
    } catch (error) {
      this.rethrowIfKnownConflict(error);
      throw error;
    }
  }

  private async persistUpdate(
    id: string,
    dto: Partial<CreateCompanyDto>,
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
      existing.systemStatus === CompanySystemStatus.DRAFT;

    try {
      const company = await this.prisma.$transaction(async (tx) => {
        await this.syncNestedCollections(tx, id, dto);

        return tx.company.update({
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
              ? { systemStatus: CompanySystemStatus.IMPLEMENTATION }
              : {}),
            updatedBy: actor.id,
          },
          include: COMPANY_DETAIL_INCLUDE,
        });
      });

      await this.audit.log({
        organizationId: company.organizationId,
        companyId: id,
        userId: actor.id,
        action,
        entity: 'Company',
        entityId: id,
        oldValue: {
          displayName: existing.displayName,
          systemStatus: existing.systemStatus,
        },
        newValue: {
          displayName: company.displayName,
          systemStatus: company.systemStatus,
        },
      });

      return company;
    } catch (error) {
      this.rethrowIfKnownConflict(error);
      throw error;
    }
  }

  private async changeStatus(
    company: {
      id: string;
      organizationId: string;
      systemStatus: CompanySystemStatus;
    },
    newStatus: CompanySystemStatus,
    actor: RequestUser,
    opts: {
      action: string;
      reason?: string;
      reasonField?: 'deactivationReason' | 'suspensionReason';
      clearReasons?: boolean;
    },
  ) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.company.update({
        where: { id: company.id },
        data: {
          systemStatus: newStatus,
          updatedBy: actor.id,
          ...(opts.reasonField ? { [opts.reasonField]: opts.reason } : {}),
          ...(opts.clearReasons
            ? { deactivationReason: null, suspensionReason: null }
            : {}),
        },
        include: COMPANY_DETAIL_INCLUDE,
      });

      await tx.companyStatusHistory.create({
        data: {
          companyId: company.id,
          previousStatus: company.systemStatus,
          newStatus,
          reason: opts.reason,
          changedBy: actor.id,
        },
      });

      return result;
    });

    await this.audit.log({
      organizationId: company.organizationId,
      companyId: company.id,
      userId: actor.id,
      action: opts.action,
      entity: 'Company',
      entityId: company.id,
      field: 'systemStatus',
      oldValue: { systemStatus: company.systemStatus },
      newValue: { systemStatus: newStatus },
      reason: opts.reason,
    });

    return updated;
  }

  private async resolveInternalCode(
    dto: CompanyPayload,
    organizationId: string,
  ): Promise<string | undefined> {
    if (dto.internalCode) return dto.internalCode;
    if (dto.automaticCodeEnabled === false) return undefined;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const count = await this.prisma.company.count({
        where: { organizationId },
      });
      const candidate = `EMP-${String(count + 1 + attempt).padStart(4, '0')}`;
      const exists = await this.prisma.company.findUnique({
        where: {
          organizationId_internalCode: {
            organizationId,
            internalCode: candidate,
          },
        },
      });

      if (!exists) return candidate;
    }

    return undefined;
  }

  private mapScalarFields(dto: Partial<CreateCompanyDto>) {
    const {
      addresses: _addresses,
      contacts: _contacts,
      cnaes: _cnaes,
      documentNumber: _doc,
      organizationId: _organizationId,
      ...scalars
    } = dto;

    return {
      ...scalars,
      ...(dto.openingDate ? { openingDate: new Date(dto.openingDate) } : {}),
      ...(dto.simplesNacionalOptionDate
        ? { simplesNacionalOptionDate: new Date(dto.simplesNacionalOptionDate) }
        : {}),
      ...(dto.simplesNacionalExclusionDate
        ? {
            simplesNacionalExclusionDate: new Date(
              dto.simplesNacionalExclusionDate,
            ),
          }
        : {}),
      ...(dto.implementationStartDate
        ? { implementationStartDate: new Date(dto.implementationStartDate) }
        : {}),
      ...(dto.shareCapital !== undefined
        ? { shareCapital: new Prisma.Decimal(dto.shareCapital) }
        : {}),
    };
  }

  private buildNestedCreatePayload(dto: CompanyPayload) {
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

    return payload;
  }

  /**
   * Substitui integralmente cada coleção aninhada (endereços/contatos/CNAEs) informada no
   * payload — quando um campo é omitido (undefined), os registros existentes são mantidos.
   */
  private async syncNestedCollections(
    tx: Prisma.TransactionClient,
    companyId: string,
    dto: Partial<CreateCompanyDto>,
  ) {
    if (dto.addresses !== undefined) {
      await tx.companyAddress.deleteMany({ where: { companyId } });
      if (dto.addresses.length > 0) {
        await tx.companyAddress.createMany({
          data: dto.addresses.map((a) => ({
            ...this.mapAddress(a),
            companyId,
          })),
        });
      }
    }

    if (dto.contacts !== undefined) {
      await tx.companyContact.deleteMany({ where: { companyId } });
      if (dto.contacts.length > 0) {
        await tx.companyContact.createMany({
          data: dto.contacts.map((c) => ({ ...this.mapContact(c), companyId })),
        });
      }
    }

    if (dto.cnaes !== undefined) {
      await tx.companyCnae.deleteMany({ where: { companyId } });
      if (dto.cnaes.length > 0) {
        await tx.companyCnae.createMany({
          data: dto.cnaes.map((c) => ({ ...c, companyId })),
        });
        const mainCnae = dto.cnaes.find((c) => c.isMain) ?? dto.cnaes[0];
        await tx.company.update({
          where: { id: companyId },
          data: { mainCnae: mainCnae.cnaeCode },
        });
      }
    }
  }

  private mapAddress(
    address: NonNullable<CreateCompanyDto['addresses']>[number],
  ) {
    const { id: _id, postalCode, ...rest } = address;
    return {
      ...rest,
      postalCode,
      normalizedPostalCode: onlyDigits(postalCode),
    };
  }

  private mapContact(
    contact: NonNullable<CreateCompanyDto['contacts']>[number],
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
          'Este CNPJ/CPF já está cadastrado no sistema.',
        );
      }
      if (target.includes('internal_code')) {
        throw new ConflictException(
          'Já existe uma empresa com este código interno nesta organização.',
        );
      }

      throw new ConflictException('Já existe um registro com estes dados.');
    }
  }
}
