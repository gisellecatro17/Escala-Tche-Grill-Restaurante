import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
  PaginationQueryDto,
  paginate,
} from '../../common/dto/pagination-query.dto';
import type { RequestUser } from '../../common/types/authenticated-request';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseAdminService } from '../../supabase/supabase-admin.service';
import { AuditService } from '../audit/audit.service';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';

const UNIQUE_CONSTRAINT_ERROR_CODE = 'P2002';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseAdmin: SupabaseAdminService,
    private readonly audit: AuditService,
  ) {}

  async findAllForCompany(companyId: string, query: PaginationQueryDto) {
    const where: Prisma.UserCompanyRoleWhereInput = {
      companyId,
      ...(query.search
        ? {
            user: {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { email: { contains: query.search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.userCompanyRole.findMany({
        where,
        include: { user: true, role: true },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.userCompanyRole.count({ where }),
    ]);

    return paginate(items, total, query.page, query.perPage);
  }

  async invite(dto: InviteUserDto, actor: RequestUser) {
    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
    });

    if (!company) {
      throw new NotFoundException('Empresa não encontrada.');
    }

    const role = await this.prisma.role.findUnique({
      where: { id: dto.roleId },
    });

    if (!role) {
      throw new NotFoundException('Perfil não encontrado.');
    }

    const { data, error } =
      await this.supabaseAdmin.client.auth.admin.inviteUserByEmail(dto.email, {
        data: { full_name: dto.name },
      });

    if (error || !data.user) {
      throw new ConflictException(
        error?.message ?? 'Não foi possível enviar o convite para este e-mail.',
      );
    }

    await this.prisma.user.upsert({
      where: { id: data.user.id },
      update: { name: dto.name, email: dto.email },
      create: { id: data.user.id, name: dto.name, email: dto.email },
    });

    try {
      const membership = await this.prisma.userCompanyRole.create({
        data: {
          userId: data.user.id,
          companyId: dto.companyId,
          roleId: dto.roleId,
        },
        include: { user: true, role: true },
      });

      await this.audit.log({
        organizationId: company.organizationId,
        companyId: dto.companyId,
        userId: actor.id,
        action: 'INVITE',
        entity: 'UserCompanyRole',
        entityId: membership.id,
        newValue: {
          userId: data.user.id,
          email: dto.email,
          roleId: dto.roleId,
        },
      });

      return membership;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === UNIQUE_CONSTRAINT_ERROR_CODE
      ) {
        throw new ConflictException(
          'Este usuário já está vinculado a esta empresa.',
        );
      }
      throw err;
    }
  }

  async updateMembershipRole(
    membershipId: string,
    dto: UpdateMembershipDto,
    actor: RequestUser,
  ) {
    const existing = await this.findMembershipOrFail(membershipId);

    const membership = await this.prisma.userCompanyRole.update({
      where: { id: membershipId },
      data: { roleId: dto.roleId },
      include: { user: true, role: true, company: true },
    });

    await this.audit.log({
      organizationId: membership.company.organizationId,
      companyId: membership.companyId,
      userId: actor.id,
      action: 'UPDATE_ROLE',
      entity: 'UserCompanyRole',
      entityId: membershipId,
      field: 'roleId',
      oldValue: { roleId: existing.roleId },
      newValue: { roleId: membership.roleId },
    });

    return membership;
  }

  async setMembershipStatus(
    membershipId: string,
    status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED',
    actor: RequestUser,
  ) {
    const existing = await this.findMembershipOrFail(membershipId);

    const membership = await this.prisma.userCompanyRole.update({
      where: { id: membershipId },
      data: { status },
      include: { company: true },
    });

    await this.audit.log({
      organizationId: membership.company.organizationId,
      companyId: membership.companyId,
      userId: actor.id,
      action: `STATUS_${status}`,
      entity: 'UserCompanyRole',
      entityId: membershipId,
      field: 'status',
      oldValue: { status: existing.status },
      newValue: { status: membership.status },
    });

    return membership;
  }

  /** Remove (soft delete) o vínculo de um usuário com uma empresa, inativando o acesso. */
  async removeFromCompany(
    companyId: string,
    userId: string,
    actor: RequestUser,
  ) {
    const membership = await this.prisma.userCompanyRole.findUnique({
      where: { userId_companyId: { userId, companyId } },
      include: { company: true },
    });

    if (!membership) {
      throw new NotFoundException(
        'Este usuário não está vinculado a esta empresa.',
      );
    }

    const updated = await this.prisma.userCompanyRole.update({
      where: { id: membership.id },
      data: { status: 'INACTIVE' },
    });

    await this.audit.log({
      organizationId: membership.company.organizationId,
      companyId,
      userId: actor.id,
      action: 'REMOVE_USER',
      entity: 'UserCompanyRole',
      entityId: membership.id,
      oldValue: { status: membership.status },
      newValue: { status: updated.status },
    });

    return updated;
  }

  private async findMembershipOrFail(membershipId: string) {
    const membership = await this.prisma.userCompanyRole.findUnique({
      where: { id: membershipId },
    });

    if (!membership) {
      throw new NotFoundException('Vínculo não encontrado.');
    }

    return membership;
  }
}
