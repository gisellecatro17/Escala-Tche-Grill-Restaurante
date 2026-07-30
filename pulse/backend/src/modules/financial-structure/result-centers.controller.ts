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
import { ResultCentersService } from './result-centers.service';
import { LifecycleController } from './structure-lifecycle.mixin';
import { StructureLifecycleService } from './structure-lifecycle.service';
import {
  CreateResultCenterDto,
  UpdateResultCenterDto,
} from './dto/result-center.dto';
import {
  DuplicateNodeDto,
  MoveNodeDto,
  StructureQueryDto,
} from './dto/common.dto';

/** Centros de resultado — estrutura própria, separada dos centros de custo. */
@ApiTags('Centros de resultado')
@ApiBearerAuth()
@Controller('result-centers')
export class ResultCentersController extends LifecycleController(
  'resultCenter',
  'result_center',
) {
  constructor(
    private readonly resultCenters: ResultCentersService,
    lifecycle: StructureLifecycleService,
  ) {
    super(lifecycle);
  }

  @Get()
  @ApiOperation({ summary: 'Lista os centros de resultado de uma empresa.' })
  findAll(
    @Query() query: StructureQueryDto,
    @Query('companyId') companyId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, companyId, 'result_center.view');
    return this.resultCenters.findAll(companyId, query);
  }

  @Get('tree')
  @ApiOperation({
    summary: 'Retorna a árvore completa de centros de resultado.',
  })
  findTree(
    @Query('companyId') companyId: string,
    @Query('includeInactive') includeInactive: string | undefined,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, companyId, 'result_center.view');
    return this.resultCenters.findTree(companyId, includeInactive === 'true');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha um centro de resultado.' })
  async findOne(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    const center = await this.resultCenters.findOne(id);
    assertCompanyPermission(actor, center.companyId, 'result_center.view');
    return center;
  }

  @Post()
  @ApiMessage('Centro de resultado incluído com sucesso.')
  @ApiOperation({ summary: 'Inclui um centro de resultado.' })
  create(
    @Body() dto: CreateResultCenterDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, dto.companyId, 'result_center.manage');
    return this.resultCenters.create(dto, actor);
  }

  @Patch(':id')
  @ApiMessage('Centro de resultado atualizado com sucesso.')
  @ApiOperation({ summary: 'Atualiza um centro de resultado.' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateResultCenterDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const center = await this.resultCenters.findOne(id);
    assertCompanyPermission(actor, center.companyId, 'result_center.manage');
    return this.resultCenters.update(id, dto, actor);
  }

  @Post(':id/move')
  @ApiMessage('Centro de resultado movido com sucesso.')
  @ApiOperation({ summary: 'Move o centro de resultado na árvore.' })
  async move(
    @Param('id') id: string,
    @Body() dto: MoveNodeDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const center = await this.resultCenters.findOne(id);
    assertCompanyPermission(actor, center.companyId, 'result_center.move');
    return this.resultCenters.move(id, dto, actor);
  }

  @Post(':id/duplicate')
  @ApiMessage('Centro de resultado duplicado com sucesso.')
  @ApiOperation({ summary: 'Duplica o centro de resultado.' })
  async duplicate(
    @Param('id') id: string,
    @Body() dto: DuplicateNodeDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const center = await this.resultCenters.findOne(id);
    assertCompanyPermission(
      actor,
      center.companyId,
      'financial_structure.duplicate',
    );
    if (dto.targetCompanyId) {
      assertCompanyPermission(
        actor,
        dto.targetCompanyId,
        'result_center.manage',
      );
    }
    return this.resultCenters.duplicate(id, dto, actor);
  }

  @Delete(':id')
  @ApiMessage('Centro de resultado excluído com sucesso.')
  @ApiOperation({
    summary: 'Exclui (logicamente) um centro de resultado sem uso.',
  })
  async remove(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    const center = await this.resultCenters.findOne(id);
    assertCompanyPermission(actor, center.companyId, 'result_center.delete');
    return this.resultCenters.remove(id, actor);
  }
}
