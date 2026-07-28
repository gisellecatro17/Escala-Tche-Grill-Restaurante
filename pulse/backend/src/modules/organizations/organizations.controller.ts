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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ApiMessage } from '../../common/decorators/api-message.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import type { RequestUser } from '../../common/types/authenticated-request';
import { RoleSlug } from '../roles/role-slug.enum';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('Organizações')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista as organizações visíveis ao usuário autenticado.',
  })
  findAll(
    @Query() query: PaginationQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.organizationsService.findAll(query, actor);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta uma organização pelo id.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationsService.findOne(id);
  }

  @Post()
  @UseGuards(PlatformAdminGuard)
  @ApiMessage('Organização criada com sucesso.')
  @ApiOperation({
    summary: 'Cria uma nova organização (tenant). Restrito à equipe Pulse.',
  })
  create(
    @Body() dto: CreateOrganizationDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.organizationsService.create(dto, actor);
  }

  @Patch(':id')
  @ApiMessage('Organização atualizada com sucesso.')
  @ApiOperation({ summary: 'Atualiza os dados de uma organização.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
    @CurrentUser() actor: RequestUser,
  ) {
    this.assertCanManage(id, actor);
    return this.organizationsService.update(id, dto, actor);
  }

  @Post(':id/activate')
  @ApiMessage('Organização ativada com sucesso.')
  @ApiOperation({ summary: 'Ativa uma organização.' })
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    this.assertCanManage(id, actor);
    return this.organizationsService.setStatus(id, 'ACTIVE', actor);
  }

  @Post(':id/deactivate')
  @ApiMessage('Organização inativada com sucesso.')
  @ApiOperation({ summary: 'Inativa uma organização.' })
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    this.assertCanManage(id, actor);
    return this.organizationsService.setStatus(id, 'INACTIVE', actor);
  }

  private assertCanManage(organizationId: string, actor: RequestUser) {
    if (actor.isPlatformAdmin) return;

    const isOrganizationAdmin = actor.memberships.some(
      (m) =>
        m.organizationId === organizationId &&
        m.role.slug === RoleSlug.ORGANIZATION_ADMIN,
    );

    if (!isOrganizationAdmin) {
      throw new ForbiddenException(
        'Você não tem permissão para gerenciar esta organização.',
      );
    }
  }
}
