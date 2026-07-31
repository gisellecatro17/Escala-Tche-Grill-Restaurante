import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

export interface LogAuditEntryParams {
  organizationId?: string | null;
  companyId?: string | null;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  field?: string | null;
  oldValue?: Prisma.InputJsonValue | null;
  newValue?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  origin?: string | null;
  reason?: string | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Registra uma ação crítica na trilha de auditoria (somente leitura para usuários comuns). */
  async log(params: LogAuditEntryParams) {
    await this.prisma.auditLog.create({
      data: {
        organizationId: params.organizationId ?? null,
        companyId: params.companyId ?? null,
        userId: params.userId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        field: params.field ?? null,
        oldValue: params.oldValue ?? undefined,
        newValue: params.newValue ?? undefined,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        origin: params.origin ?? null,
        reason: params.reason ?? null,
      },
    });
  }
}
