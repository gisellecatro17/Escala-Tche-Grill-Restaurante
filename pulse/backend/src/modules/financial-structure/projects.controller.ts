import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectStatus } from '@prisma/client';

import { ApiMessage } from '../../common/decorators/api-message.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/types/authenticated-request';
import { assertCompanyPermission } from '../../common/utils/access-control.util';
import { ProjectsService } from './projects.service';
import { LifecycleController } from './structure-lifecycle.mixin';
import { StructureLifecycleService } from './structure-lifecycle.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import { DuplicateNodeDto, StructureQueryDto } from './dto/common.dto';
import { DeactivateStructureDto } from './dto/lifecycle.dto';

/**
 * Projetos — dimensão adicional de análise. O valor realizado e a margem só serão
 * calculados quando o módulo financeiro existir; aqui apenas o orçamento é informado.
 */
@ApiTags('Projetos')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController extends LifecycleController(
  'project',
  'project',
) {
  constructor(
    private readonly projects: ProjectsService,
    lifecycle: StructureLifecycleService,
  ) {
    super(lifecycle);
  }

  @Get()
  @ApiOperation({ summary: 'Lista os projetos de uma empresa, com paginação.' })
  findAll(
    @Query() query: StructureQueryDto,
    @Query('companyId') companyId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, companyId, 'project.view');
    return this.projects.findAll(companyId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha um projeto.' })
  async findOne(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    const project = await this.projects.findOne(id);
    assertCompanyPermission(actor, project.companyId, 'project.view');
    return project;
  }

  @Post()
  @ApiMessage('Projeto incluído com sucesso.')
  @ApiOperation({ summary: 'Inclui um projeto.' })
  create(@Body() dto: CreateProjectDto, @CurrentUser() actor: RequestUser) {
    assertCompanyPermission(actor, dto.companyId, 'project.manage');
    return this.projects.create(dto, actor);
  }

  @Patch(':id')
  @ApiMessage('Projeto atualizado com sucesso.')
  @ApiOperation({ summary: 'Atualiza um projeto.' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const project = await this.projects.findOne(id);
    assertCompanyPermission(actor, project.companyId, 'project.manage');
    return this.projects.update(id, dto, actor);
  }

  @Post(':id/duplicate')
  @ApiMessage('Projeto duplicado com sucesso.')
  @ApiOperation({
    summary: 'Duplica um projeto, opcionalmente para outra empresa.',
  })
  async duplicate(
    @Param('id') id: string,
    @Body() dto: DuplicateNodeDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const project = await this.projects.findOne(id);
    assertCompanyPermission(
      actor,
      project.companyId,
      'financial_structure.duplicate',
    );
    if (dto.targetCompanyId) {
      assertCompanyPermission(actor, dto.targetCompanyId, 'project.manage');
    }
    return this.projects.duplicate(id, dto, actor);
  }

  @Post(':id/pause')
  @ApiMessage('Projeto pausado com sucesso.')
  @ApiOperation({
    summary: 'Pausa um projeto em andamento, preservando o histórico.',
  })
  pause(
    @Param('id') id: string,
    @Body() dto: DeactivateStructureDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.transition(
      id,
      ProjectStatus.PAUSED,
      'project.pause',
      dto,
      actor,
    );
  }

  @Post(':id/resume')
  @ApiMessage('Projeto retomado com sucesso.')
  @ApiOperation({ summary: 'Retoma um projeto pausado ou atrasado.' })
  resume(
    @Param('id') id: string,
    @Body() dto: DeactivateStructureDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.transition(
      id,
      ProjectStatus.IN_PROGRESS,
      'project.pause',
      dto,
      actor,
    );
  }

  @Post(':id/complete')
  @ApiMessage('Projeto concluído com sucesso.')
  @ApiOperation({
    summary:
      'Conclui o projeto, gravando a data real de término sem apagar a data prevista.',
  })
  complete(
    @Param('id') id: string,
    @Body() dto: DeactivateStructureDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.transition(
      id,
      ProjectStatus.COMPLETED,
      'project.complete',
      dto,
      actor,
    );
  }

  @Post(':id/cancel')
  @ApiMessage('Projeto cancelado com sucesso.')
  @ApiOperation({
    summary:
      'Cancela o projeto. Nada é excluído: os vínculos e o histórico permanecem.',
  })
  cancel(
    @Param('id') id: string,
    @Body() dto: DeactivateStructureDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.transition(
      id,
      ProjectStatus.CANCELLED,
      'project.cancel',
      dto,
      actor,
    );
  }

  /** Valida a permissão contra a empresa do projeto antes de mudar o status. */
  private async transition(
    id: string,
    next: ProjectStatus,
    permission: string,
    dto: DeactivateStructureDto,
    actor: RequestUser,
  ) {
    const project = await this.projects.findOne(id);
    assertCompanyPermission(actor, project.companyId, permission);
    return this.projects.changeStatus(id, next, actor, dto.reason);
  }

  @Delete(':id')
  @ApiMessage('Projeto excluído com sucesso.')
  @ApiOperation({ summary: 'Exclui (logicamente) um projeto sem uso.' })
  async remove(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    const project = await this.projects.findOne(id);
    assertCompanyPermission(actor, project.companyId, 'project.delete');
    return this.projects.remove(id, actor);
  }
}
