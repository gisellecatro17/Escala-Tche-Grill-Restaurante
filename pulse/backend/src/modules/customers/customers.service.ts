import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomerSystemStatus, Prisma } from '@prisma/client';

import { paginate } from '../../common/dto/pagination-query.dto';
import type { RequestUser } from '../../common/types/authenticated-request';
import { hasPermissionAnywhere } from '../../common/utils/access-control.util';
import { onlyDigits } from '../../common/utils/normalize.util';
import { COMPANY_REGISTRY_PROVIDER } from '../../integrations/company-registry/company-registry.types';
import type { CompanyRegistryProvider } from '../../integrations/company-registry/company-registry.types';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomerAddressDto } from './dto/customer-address.dto';
import { CustomerContactDto } from './dto/customer-contact.dto';
import { DocumentQueryCustomerDto } from './dto/document-query-customer.dto';
import { QueryCustomersDto } from './dto/query-customers.dto';
import { SaveDraftCustomerDto } from './dto/save-draft-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

const UNIQUE_CONSTRAINT_ERROR_CODE = 'P2002';

const CUSTOMER_DETAIL_INCLUDE = {
  addresses: true,
  contacts: true,
  cnaes: true,
  bankIdentifiers: true,
  companyLinks: {
    where: { deletedAt: null },
    include: {
      company: { select: { id: true, displayName: true, legalName: true } },
    },
  },
} satisfies Prisma.CustomerInclude;

type CustomerPayload =
  CreateCustomerDto | (Partial<CreateCustomerDto> & { organizationId: string });

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    @Inject(COMPANY_REGISTRY_PROVIDER)
    private readonly registryProvider: CompanyRegistryProvider,
  ) {}

  async findAll(query: QueryCustomersDto, actor: RequestUser) {
    const visibleCompanyIds = actor.isPlatformAdmin
      ? undefined
      : actor.memberships
          .filter((m) => m.permissions.includes('customer.view'))
          .map((m) => m.companyId);

    const where: Prisma.CustomerCompanyLinkWhereInput = {
      deletedAt: null,
      ...(query.companyId
        ? { companyId: query.companyId }
        : visibleCompanyIds
          ? { companyId: { in: visibleCompanyIds } }
          : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.financialStatus
        ? { financialStatus: query.financialStatus }
        : {}),
      ...(query.defaultRevenueCategoryId
        ? { defaultRevenueCategoryId: query.defaultRevenueCategoryId }
        : {}),
      ...(query.defaultResultCenterId
        ? { defaultResultCenterId: query.defaultResultCenterId }
        : {}),
      customer: {
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

    const [items, total] = await Promise.all([
      this.prisma.customerCompanyLink.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
        include: {
          customer: {
            include: { addresses: { where: { isPrimary: true }, take: 1 } },
          },
          defaultRevenueCategory: { select: { id: true, name: true } },
          defaultResultCenter: { select: { id: true, name: true } },
        },
      }),
      this.prisma.customerCompanyLink.count({ where }),
    ]);

    return paginate(items, total, query.page, query.perPage);
  }

  async findOne(id: string, actor?: RequestUser) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, deletedAt: null },
      include: CUSTOMER_DETAIL_INCLUDE,
    });

    if (!customer) {
      throw new NotFoundException('Cliente não encontrado.');
    }

    if (
      actor &&
      !hasPermissionAnywhere(actor, 'customer.view_sensitive_contacts')
    ) {
      return this.maskSensitiveContacts(customer);
    }

    return customer;
  }

  async create(dto: CreateCustomerDto, actor: RequestUser) {
    return this.persist(dto, CustomerSystemStatus.ACTIVE, actor, 'CREATE');
  }

  async saveDraft(
    dto: SaveDraftCustomerDto & { id?: string },
    actor: RequestUser,
  ) {
    if (dto.id) {
      const existing = await this.findOne(dto.id);

      if (existing.systemStatus !== CustomerSystemStatus.DRAFT) {
        throw new BadRequestException(
          'Apenas clientes em rascunho podem ser salvos por este endpoint.',
        );
      }

      return this.persistUpdate(dto.id, dto, actor, 'UPDATE_DRAFT');
    }

    return this.persist(dto, CustomerSystemStatus.DRAFT, actor, 'CREATE_DRAFT');
  }

  async update(id: string, dto: UpdateCustomerDto, actor: RequestUser) {
    return this.persistUpdate(id, dto, actor, 'UPDATE', {
      promoteFromDraft: true,
    });
  }

  async queryDocument(
    dto: DocumentQueryCustomerDto,
    actor: RequestUser,
    organizationId?: string,
  ) {
    const normalized = onlyDigits(dto.documentNumber);

    const existing = await this.prisma.customer.findFirst({
      where: { normalizedDocumentNumber: normalized, deletedAt: null },
      select: {
        id: true,
        displayName: true,
        legalName: true,
        systemStatus: true,
      },
    });

    if (existing) {
      return { duplicate: true as const, customer: existing };
    }

    const result = await this.registryProvider.queryDocument(normalized);

    await this.prisma.customerRegistryQuery.create({
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
      entity: 'Customer',
      newValue: {
        documentNumber: normalized,
        provider: result.provider,
        success: result.success,
      },
    });

    return { duplicate: false as const, ...result };
  }

  async addAddress(
    customerId: string,
    dto: CustomerAddressDto,
    actor: RequestUser,
  ) {
    const customer = await this.findOne(customerId);

    const address = await this.prisma.customerAddress.create({
      data: {
        ...this.mapAddress(dto),
        customerId,
        createdBy: actor.id,
        updatedBy: actor.id,
      },
    });

    await this.audit.log({
      organizationId: customer.organizationId,
      userId: actor.id,
      action: 'ADD_ADDRESS',
      entity: 'Customer',
      entityId: customerId,
      newValue: { addressId: address.id, addressType: address.addressType },
    });

    return address;
  }

  async addContact(
    customerId: string,
    dto: CustomerContactDto,
    actor: RequestUser,
  ) {
    const customer = await this.findOne(customerId);

    const contact = await this.prisma.customerContact.create({
      data: {
        ...this.mapContact(dto),
        customerId,
        createdBy: actor.id,
        updatedBy: actor.id,
      },
    });

    await this.audit.log({
      organizationId: customer.organizationId,
      userId: actor.id,
      action: 'ADD_CONTACT',
      entity: 'Customer',
      entityId: customerId,
      newValue: { contactId: contact.id },
    });

    return contact;
  }

  async uploadDocument(
    customerId: string,
    file: Express.Multer.File,
    documentType: string | undefined,
    actor: RequestUser,
  ) {
    const customer = await this.findOne(customerId);
    const uploaded = await this.storage.uploadDocument(
      'Customer',
      customerId,
      file,
    );

    const attachment = await this.prisma.attachment.create({
      data: {
        organizationId: customer.organizationId,
        entityType: 'Customer',
        entityId: customerId,
        documentType,
        fileName: file.originalname,
        storagePath: uploaded.storagePath,
        mimeType: file.mimetype,
        fileSize: file.size,
        uploadedBy: actor.id,
      },
    });

    await this.audit.log({
      organizationId: customer.organizationId,
      userId: actor.id,
      action: 'UPLOAD_DOCUMENT',
      entity: 'Customer',
      entityId: customerId,
      newValue: { attachmentId: attachment.id, fileName: attachment.fileName },
    });

    return attachment;
  }

  async listDocuments(customerId: string) {
    await this.findOne(customerId);
    return this.prisma.attachment.findMany({
      where: { entityType: 'Customer', entityId: customerId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(id: string, actor: RequestUser) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, deletedAt: null },
      include: { companyLinks: { where: { deletedAt: null } }, contacts: true },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado.');

    const documentsCount = await this.prisma.attachment.count({
      where: { entityType: 'Customer', entityId: id, deletedAt: null },
    });

    const blocked =
      customer.systemStatus !== CustomerSystemStatus.DRAFT ||
      customer.companyLinks.length > 0 ||
      customer.contacts.length > 0 ||
      documentsCount > 0;

    if (blocked) {
      throw new ConflictException(
        'Este cliente possui registros vinculados e não pode ser excluído. Utilize a opção Inativar.',
      );
    }

    await this.prisma.customer.delete({ where: { id } });

    await this.audit.log({
      organizationId: customer.organizationId,
      userId: actor.id,
      action: 'DELETE',
      entity: 'Customer',
      entityId: id,
      oldValue: {
        displayName: customer.displayName,
        normalizedDocumentNumber: customer.normalizedDocumentNumber,
      },
    });

    return { id };
  }

  // ── Internos ────────────────────────────────────────────────────────────

  private maskSensitiveContacts<
    T extends { contacts: { phone: string | null; email: string | null }[] },
  >(customer: T): T {
    return {
      ...customer,
      contacts: customer.contacts.map((contact) => ({
        ...contact,
        phone: contact.phone ? '(**) *****-****' : contact.phone,
        email: contact.email
          ? contact.email.replace(/^(.{2}).*(@.*)$/, '$1***$2')
          : contact.email,
      })),
    };
  }

  private async persist(
    dto: CustomerPayload,
    systemStatus: CustomerSystemStatus,
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
      const customer = await this.prisma.customer.create({
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
        include: CUSTOMER_DETAIL_INCLUDE,
      });

      await this.audit.log({
        organizationId: customer.organizationId,
        userId: actor.id,
        action,
        entity: 'Customer',
        entityId: customer.id,
        newValue: {
          displayName: customer.displayName,
          normalizedDocumentNumber: customer.normalizedDocumentNumber,
        },
      });

      return customer;
    } catch (error) {
      this.rethrowIfKnownConflict(error);
      throw error;
    }
  }

  private async persistUpdate(
    id: string,
    dto: Partial<CreateCustomerDto>,
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
      existing.systemStatus === CustomerSystemStatus.DRAFT;

    try {
      const customer = await this.prisma.$transaction(async (tx) => {
        await this.syncNestedCollections(tx, id, dto);

        return tx.customer.update({
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
              ? { systemStatus: CustomerSystemStatus.PENDING_VALIDATION }
              : {}),
            updatedBy: actor.id,
          },
          include: CUSTOMER_DETAIL_INCLUDE,
        });
      });

      await this.audit.log({
        organizationId: customer.organizationId,
        userId: actor.id,
        action,
        entity: 'Customer',
        entityId: id,
        oldValue: {
          displayName: existing.displayName,
          systemStatus: existing.systemStatus,
        },
        newValue: {
          displayName: customer.displayName,
          systemStatus: customer.systemStatus,
        },
      });

      return customer;
    } catch (error) {
      this.rethrowIfKnownConflict(error);
      throw error;
    }
  }

  private mapScalarFields(dto: Partial<CreateCustomerDto>) {
    const {
      addresses: _addresses,
      contacts: _contacts,
      cnaes: _cnaes,
      companyLink: _companyLink,
      documentNumber: _doc,
      organizationId: _organizationId,
      ...scalars
    } = dto;

    return {
      ...scalars,
      ...(dto.openingDate ? { openingDate: new Date(dto.openingDate) } : {}),
      ...(dto.birthDate ? { birthDate: new Date(dto.birthDate) } : {}),
      ...(dto.shareCapital !== undefined
        ? { shareCapital: new Prisma.Decimal(dto.shareCapital) }
        : {}),
    };
  }

  private buildNestedCreatePayload(dto: CustomerPayload) {
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

  private async syncNestedCollections(
    tx: Prisma.TransactionClient,
    customerId: string,
    dto: Partial<CreateCustomerDto>,
  ) {
    if (dto.addresses !== undefined) {
      await tx.customerAddress.deleteMany({ where: { customerId } });
      if (dto.addresses.length > 0) {
        await tx.customerAddress.createMany({
          data: dto.addresses.map((a) => ({
            ...this.mapAddress(a),
            customerId,
          })),
        });
      }
    }

    if (dto.contacts !== undefined) {
      await tx.customerContact.deleteMany({ where: { customerId } });
      if (dto.contacts.length > 0) {
        await tx.customerContact.createMany({
          data: dto.contacts.map((c) => ({
            ...this.mapContact(c),
            customerId,
          })),
        });
      }
    }

    if (dto.cnaes !== undefined) {
      await tx.customerCnae.deleteMany({ where: { customerId } });
      if (dto.cnaes.length > 0) {
        await tx.customerCnae.createMany({
          data: dto.cnaes.map((c) => ({ ...c, customerId })),
        });
        const mainCnae = dto.cnaes.find((c) => c.isMain) ?? dto.cnaes[0];
        await tx.customer.update({
          where: { id: customerId },
          data: { mainCnae: mainCnae.cnaeCode },
        });
      }
    }
  }

  private mapAddress(
    address: NonNullable<CreateCustomerDto['addresses']>[number],
  ) {
    const { id: _id, postalCode, ...rest } = address;
    return {
      ...rest,
      postalCode,
      normalizedPostalCode: onlyDigits(postalCode),
    };
  }

  private mapContact(
    contact: NonNullable<CreateCustomerDto['contacts']>[number],
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
          'Este cliente já está cadastrado na plataforma. Vincule-o à empresa em vez de criar um novo cadastro.',
        );
      }

      throw new ConflictException('Já existe um registro com estes dados.');
    }
  }
}
