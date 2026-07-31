import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ApiMessage } from '../../common/decorators/api-message.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import type { RequestUser } from '../../common/types/authenticated-request';
import { PrismaService } from '../../prisma/prisma.service';
import { RoleSlug } from '../roles/role-slug.enum';
import { AddCompanyUserDto } from './dto/add-company-user.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { UsersService } from './users.service';

@ApiTags('Usuários')
@ApiBearerAuth()
@Controller()
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('companies/:companyId/users')
  @ApiOperation({ summary: 'Lista os usuários vinculados a uma empresa.' })
  async findAllForCompany(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: PaginationQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertCanManageCompanyUsers(companyId, actor);
    return this.usersService.findAllForCompany(companyId, query);
  }

  @Post('companies/:companyId/users')
  @ApiMessage('Usuário incluído com sucesso.')
  @ApiOperation({
    summary:
      'Vincula (convida) um usuário a uma empresa — etapa 7 do cadastro de empresas.',
  })
  async addUserToCompany(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: AddCompanyUserDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertCanManageCompanyUsers(companyId, actor);
    return this.usersService.invite({ ...dto, companyId }, actor);
  }

  @Delete('companies/:companyId/users/:userId')
  @ApiMessage('Usuário removido da empresa com sucesso.')
  @ApiOperation({
    summary: 'Remove (inativa) o vínculo de um usuário com uma empresa.',
  })
  async removeUserFromCompany(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertCanManageCompanyUsers(companyId, actor);
    return this.usersService.removeFromCompany(companyId, userId, actor);
  }

  @Post('users/invite')
  @ApiMessage('Convite enviado com sucesso.')
  @ApiOperation({
    summary: 'Convida um novo usuário para uma empresa (via Supabase Auth).',
  })
  async invite(@Body() dto: InviteUserDto, @CurrentUser() actor: RequestUser) {
    await this.assertCanManageCompanyUsers(dto.companyId, actor);
    return this.usersService.invite(dto, actor);
  }

  @Patch('users/memberships/:id')
  @ApiMessage('Perfil do usuário atualizado com sucesso.')
  @ApiOperation({ summary: 'Altera o perfil de um usuário em uma empresa.' })
  async updateMembership(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMembershipDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertCanManageMembership(id, actor);
    return this.usersService.updateMembershipRole(id, dto, actor);
  }

  @Post('users/memberships/:id/block')
  @ApiMessage('Usuário bloqueado nesta empresa.')
  @ApiOperation({ summary: 'Bloqueia o acesso de um usuário a uma empresa.' })
  async block(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertCanManageMembership(id, actor);
    return this.usersService.setMembershipStatus(id, 'BLOCKED', actor);
  }

  @Post('users/memberships/:id/unblock')
  @ApiMessage('Usuário desbloqueado nesta empresa.')
  @ApiOperation({
    summary: 'Desbloqueia o acesso de um usuário a uma empresa.',
  })
  async unblock(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertCanManageMembership(id, actor);
    return this.usersService.setMembershipStatus(id, 'ACTIVE', actor);
  }

  private async assertCanManageCompanyUsers(
    companyId: string,
    actor: RequestUser,
  ) {
    if (actor.isPlatformAdmin) return;

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new ForbiddenException('Empresa não encontrada.');
    }

    const canManage = actor.memberships.some(
      (m) =>
        (m.companyId === companyId && m.role.slug === RoleSlug.COMPANY_ADMIN) ||
        (m.organizationId === company.organizationId &&
          m.role.slug === RoleSlug.ORGANIZATION_ADMIN),
    );

    if (!canManage) {
      throw new ForbiddenException(
        'Você não tem permissão para gerenciar usuários desta empresa.',
      );
    }
  }

  private async assertCanManageMembership(
    membershipId: string,
    actor: RequestUser,
  ) {
    if (actor.isPlatformAdmin) return;

    const membership = await this.prisma.userCompanyRole.findUnique({
      where: { id: membershipId },
    });

    if (!membership) {
      throw new ForbiddenException('Vínculo não encontrado.');
    }

    await this.assertCanManageCompanyUsers(membership.companyId, actor);
  }
}
