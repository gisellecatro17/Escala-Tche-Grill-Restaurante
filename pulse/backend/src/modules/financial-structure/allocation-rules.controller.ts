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
import { AllocationRulesService } from './allocation-rules.service';
import {
  CreateAllocationRuleDto,
  UpdateAllocationRuleDto,
} from './dto/allocation-rule.dto';
import { StructureQueryDto } from './dto/common.dto';

/**
 * Rateios padrão reutilizáveis. Rateios percentuais são validados para fechar
 * exatamente 100%; critérios por quantidade/horas/peso derivam o percentual da soma.
 */
@ApiTags('Rateios')
@ApiBearerAuth()
@Controller('allocation-rules')
export class AllocationRulesController {
  constructor(private readonly allocationRules: AllocationRulesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista os rateios padrão de uma empresa.' })
  findAll(
    @Query() query: StructureQueryDto,
    @Query('companyId') companyId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, companyId, 'allocation_rule.view');
    return this.allocationRules.findAll(companyId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha um rateio e suas linhas.' })
  async findOne(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    const rule = await this.allocationRules.findOne(id);
    assertCompanyPermission(actor, rule.companyId, 'allocation_rule.view');
    return rule;
  }

  @Post()
  @ApiMessage('Rateio incluído com sucesso.')
  @ApiOperation({ summary: 'Inclui um rateio padrão com suas linhas.' })
  create(
    @Body() dto: CreateAllocationRuleDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, dto.companyId, 'allocation_rule.manage');
    return this.allocationRules.create(dto, actor);
  }

  @Patch(':id')
  @ApiMessage('Rateio atualizado com sucesso.')
  @ApiOperation({
    summary:
      'Atualiza um rateio. Informar `lines` substitui integralmente as linhas existentes.',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAllocationRuleDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const rule = await this.allocationRules.findOne(id);
    assertCompanyPermission(actor, rule.companyId, 'allocation_rule.manage');
    return this.allocationRules.update(id, dto, actor);
  }

  @Delete(':id')
  @ApiMessage('Rateio excluído com sucesso.')
  @ApiOperation({ summary: 'Exclui (logicamente) um rateio sem uso.' })
  async remove(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    const rule = await this.allocationRules.findOne(id);
    assertCompanyPermission(actor, rule.companyId, 'allocation_rule.delete');
    return this.allocationRules.remove(id, actor);
  }
}
