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
import {
  DuplicateNodeDto,
  MoveNodeDto,
} from '../financial-structure/dto/common.dto';
import { CostCentersService } from './cost-centers.service';
import {
  CreateCostCenterDto,
  UpdateCostCenterDto,
} from './dto/create-cost-center.dto';

/** Centros de custo, com árvore de profundidade ilimitada. */
@ApiTags('Centros de custo')
@ApiBearerAuth()
@Controller('cost-centers')
export class CostCentersController {
  constructor(private readonly costCentersService: CostCentersService) {}

  @Get()
  @ApiOperation({ summary: 'Lista os centros de custo de uma empresa.' })
  findAll(
    @Query('companyId') companyId: string,
    @Query('search') search: string | undefined,
    @Query('includeInactive') includeInactive: string | undefined,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, companyId, 'cost-centers.view');
    return this.costCentersService.findAll(
      companyId,
      search,
      includeInactive === 'true',
    );
  }

  @Get('tree')
  @ApiOperation({ summary: 'Retorna a árvore completa de centros de custo.' })
  findTree(
    @Query('companyId') companyId: string,
    @Query('includeInactive') includeInactive: string | undefined,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, companyId, 'cost-centers.view');
    return this.costCentersService.findTree(
      companyId,
      includeInactive === 'true',
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha um centro de custo.' })
  async findOne(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    const costCenter = await this.costCentersService.findOne(id);
    assertCompanyPermission(actor, costCenter.companyId, 'cost-centers.view');
    return costCenter;
  }

  @Post()
  @ApiMessage('Centro de custo incluído com sucesso.')
  @ApiOperation({ summary: 'Inclui um centro de custo.' })
  create(@Body() dto: CreateCostCenterDto, @CurrentUser() actor: RequestUser) {
    assertCompanyPermission(actor, dto.companyId, 'cost-centers.manage');
    return this.costCentersService.create(dto, actor);
  }

  @Patch(':id')
  @ApiMessage('Centro de custo atualizado com sucesso.')
  @ApiOperation({ summary: 'Atualiza um centro de custo.' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCostCenterDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const costCenter = await this.costCentersService.findOne(id);
    assertCompanyPermission(actor, costCenter.companyId, 'cost-centers.manage');
    return this.costCentersService.update(id, dto, actor);
  }

  @Post(':id/move')
  @ApiMessage('Centro de custo movido com sucesso.')
  @ApiOperation({ summary: 'Move o centro de custo na árvore.' })
  async move(
    @Param('id') id: string,
    @Body() dto: MoveNodeDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const costCenter = await this.costCentersService.findOne(id);
    assertCompanyPermission(
      actor,
      costCenter.companyId,
      'cost-centers.manage_tree',
    );
    return this.costCentersService.move(id, dto, actor);
  }

  @Post(':id/duplicate')
  @ApiMessage('Centro de custo duplicado com sucesso.')
  @ApiOperation({
    summary: 'Duplica o centro de custo, opcionalmente para outra empresa.',
  })
  async duplicate(
    @Param('id') id: string,
    @Body() dto: DuplicateNodeDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const costCenter = await this.costCentersService.findOne(id);
    assertCompanyPermission(
      actor,
      costCenter.companyId,
      'financial-structure.duplicate',
    );
    if (dto.targetCompanyId) {
      assertCompanyPermission(
        actor,
        dto.targetCompanyId,
        'cost-centers.manage',
      );
    }
    return this.costCentersService.duplicate(id, dto, actor);
  }

  @Delete(':id')
  @ApiMessage('Centro de custo excluído com sucesso.')
  @ApiOperation({
    summary: 'Exclui (logicamente) um centro de custo sem filhos nem uso.',
  })
  async remove(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    const costCenter = await this.costCentersService.findOne(id);
    assertCompanyPermission(actor, costCenter.companyId, 'cost-centers.delete');
    return this.costCentersService.remove(id, actor);
  }
}
