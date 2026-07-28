import {
  Body,
  Controller,
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
import { RoleSlug } from '../roles/role-slug.enum';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@ApiTags('Empresas')
@ApiBearerAuth()
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista as empresas visíveis ao usuário autenticado.',
  })
  findAll(
    @Query() query: PaginationQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.companiesService.findAll(query, actor);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta uma empresa pelo id.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.companiesService.findOne(id);
  }

  @Post()
  @ApiMessage('Empresa incluída com sucesso.')
  @ApiOperation({ summary: 'Inclui uma nova empresa em uma organização.' })
  create(@Body() dto: CreateCompanyDto, @CurrentUser() actor: RequestUser) {
    this.assertCanManageOrganization(dto.organizationId, actor);
    return this.companiesService.create(dto, actor);
  }

  @Patch(':id')
  @ApiMessage('Empresa atualizada com sucesso.')
  @ApiOperation({ summary: 'Atualiza os dados de uma empresa.' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertCanManageCompany(id, actor);
    return this.companiesService.update(id, dto, actor);
  }

  @Post(':id/activate')
  @ApiMessage('Empresa ativada com sucesso.')
  @ApiOperation({ summary: 'Ativa uma empresa.' })
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertCanManageCompany(id, actor);
    return this.companiesService.setStatus(id, 'ACTIVE', actor);
  }

  @Post(':id/deactivate')
  @ApiMessage('Empresa inativada com sucesso.')
  @ApiOperation({ summary: 'Inativa uma empresa.' })
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertCanManageCompany(id, actor);
    return this.companiesService.setStatus(id, 'INACTIVE', actor);
  }

  @Post(':id/block')
  @ApiMessage('Empresa bloqueada com sucesso.')
  @ApiOperation({ summary: 'Bloqueia uma empresa.' })
  async block(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertCanManageCompany(id, actor);
    return this.companiesService.setStatus(id, 'BLOCKED', actor);
  }

  @Post(':id/unblock')
  @ApiMessage('Empresa desbloqueada com sucesso.')
  @ApiOperation({ summary: 'Desbloqueia uma empresa.' })
  async unblock(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertCanManageCompany(id, actor);
    return this.companiesService.setStatus(id, 'ACTIVE', actor);
  }

  private assertCanManageOrganization(
    organizationId: string,
    actor: RequestUser,
  ) {
    if (actor.isPlatformAdmin) return;

    const isOrganizationAdmin = actor.memberships.some(
      (m) =>
        m.organizationId === organizationId &&
        m.role.slug === RoleSlug.ORGANIZATION_ADMIN,
    );

    if (!isOrganizationAdmin) {
      throw new ForbiddenException(
        'Você não tem permissão para incluir empresas nesta organização.',
      );
    }
  }

  private async assertCanManageCompany(companyId: string, actor: RequestUser) {
    if (actor.isPlatformAdmin) return;

    const company = await this.companiesService.findOne(companyId);

    const canManage = actor.memberships.some(
      (m) =>
        (m.companyId === companyId && m.role.slug === RoleSlug.COMPANY_ADMIN) ||
        (m.organizationId === company.organizationId &&
          m.role.slug === RoleSlug.ORGANIZATION_ADMIN),
    );

    if (!canManage) {
      throw new ForbiddenException(
        'Você não tem permissão para gerenciar esta empresa.',
      );
    }
  }
}
