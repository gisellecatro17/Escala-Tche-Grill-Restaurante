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
import { ClassificationRulesService } from './classification-rules.service';
import {
  CreateClassificationRuleDto,
  SimulateClassificationDto,
  UpdateClassificationRuleDto,
} from './dto/classification-rule.dto';
import { StructureQueryDto } from './dto/common.dto';

/**
 * Regras de classificação automática. Nesta etapa as regras são armazenadas e podem ser
 * simuladas, mas **nenhum lançamento é classificado automaticamente** — isso passa a
 * valer quando os módulos de importação bancária e de contas a pagar/receber existirem.
 */
@ApiTags('Regras de classificação')
@ApiBearerAuth()
@Controller('classification-rules')
export class ClassificationRulesController {
  constructor(private readonly rules: ClassificationRulesService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista as regras de classificação, por prioridade.',
  })
  findAll(
    @Query() query: StructureQueryDto,
    @Query('companyId') companyId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, companyId, 'classification-rules.view');
    return this.rules.findAll(companyId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha uma regra de classificação.' })
  async findOne(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    const rule = await this.rules.findOne(id);
    assertCompanyPermission(actor, rule.companyId, 'classification-rules.view');
    return rule;
  }

  @Post()
  @ApiMessage('Regra de classificação incluída com sucesso.')
  @ApiOperation({ summary: 'Inclui uma regra de classificação automática.' })
  create(
    @Body() dto: CreateClassificationRuleDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(
      actor,
      dto.companyId,
      'classification-rules.manage',
    );
    return this.rules.create(dto, actor);
  }

  @Post('simulate')
  @ApiMessage('Simulação concluída.')
  @ApiOperation({
    summary:
      'Simula a classificação de um lançamento hipotético. Nada é persistido nem classificado.',
  })
  simulate(
    @Body() dto: SimulateClassificationDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, dto.companyId, 'classification-rules.view');
    return this.rules.simulate(dto);
  }

  @Patch(':id')
  @ApiMessage('Regra de classificação atualizada com sucesso.')
  @ApiOperation({ summary: 'Atualiza uma regra de classificação.' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateClassificationRuleDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const rule = await this.rules.findOne(id);
    assertCompanyPermission(
      actor,
      rule.companyId,
      'classification-rules.manage',
    );
    return this.rules.update(id, dto, actor);
  }

  @Delete(':id')
  @ApiMessage('Regra de classificação excluída com sucesso.')
  @ApiOperation({ summary: 'Exclui (logicamente) uma regra de classificação.' })
  async remove(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    const rule = await this.rules.findOne(id);
    assertCompanyPermission(
      actor,
      rule.companyId,
      'classification-rules.delete',
    );
    return this.rules.remove(id, actor);
  }
}
