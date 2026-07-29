import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ApiMessage } from '../../common/decorators/api-message.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/types/authenticated-request';
import { assertCompanyPermission } from '../../common/utils/access-control.util';
import { CostCentersService } from './cost-centers.service';
import { CreateCostCenterDto } from './dto/create-cost-center.dto';

/** Estrutura mínima e reutilizável de centros de custo (seção 29 do prompt de fornecedores). */
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
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, companyId, 'cost-centers.view');
    return this.costCentersService.findAll(companyId, search);
  }

  @Post()
  @ApiMessage('Centro de custo incluído com sucesso.')
  @ApiOperation({ summary: 'Inclui um centro de custo.' })
  create(@Body() dto: CreateCostCenterDto, @CurrentUser() actor: RequestUser) {
    assertCompanyPermission(actor, dto.companyId, 'cost-centers.manage');
    return this.costCentersService.create(dto);
  }
}
