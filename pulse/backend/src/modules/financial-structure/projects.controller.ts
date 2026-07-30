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

import { ApiMessage } from '../../common/decorators/api-message.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/types/authenticated-request';
import { assertCompanyPermission } from '../../common/utils/access-control.util';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import { DuplicateNodeDto, StructureQueryDto } from './dto/common.dto';

/**
 * Projetos — dimensão adicional de análise. O valor realizado e a margem só serão
 * calculados quando o módulo financeiro existir; aqui apenas o orçamento é informado.
 */
@ApiTags('Projetos')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

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

  @Delete(':id')
  @ApiMessage('Projeto excluído com sucesso.')
  @ApiOperation({ summary: 'Exclui (logicamente) um projeto sem uso.' })
  async remove(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    const project = await this.projects.findOne(id);
    assertCompanyPermission(actor, project.companyId, 'project.delete');
    return this.projects.remove(id, actor);
  }
}
