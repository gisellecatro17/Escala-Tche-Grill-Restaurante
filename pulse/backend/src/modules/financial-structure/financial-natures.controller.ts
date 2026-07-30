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
import { assertOrganizationPermission } from '../../common/utils/access-control.util';
import { FinancialNaturesService } from './financial-natures.service';
import {
  CreateFinancialNatureDto,
  UpdateFinancialNatureDto,
} from './dto/financial-nature.dto';
import { StructureQueryDto } from './dto/common.dto';

/** Catálogo de naturezas financeiras (receita, despesa, custo, investimento, ...). */
@ApiTags('Naturezas financeiras')
@ApiBearerAuth()
@Controller('financial-natures')
export class FinancialNaturesController {
  constructor(private readonly natures: FinancialNaturesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista as naturezas financeiras.' })
  findAll(
    @Query() query: StructureQueryDto,
    @Query('organizationId') organizationId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(
      actor,
      organizationId,
      'financial_nature.view',
    );
    return this.natures.findAll(organizationId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha uma natureza financeira.' })
  async findOne(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    const nature = await this.natures.findOne(id);
    assertOrganizationPermission(
      actor,
      nature.organizationId,
      'financial_nature.view',
    );
    return nature;
  }

  @Post()
  @ApiMessage('Natureza financeira incluída com sucesso.')
  @ApiOperation({ summary: 'Inclui uma natureza financeira.' })
  create(
    @Body() dto: CreateFinancialNatureDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(
      actor,
      dto.organizationId,
      'financial_nature.manage',
    );
    return this.natures.create(dto, actor);
  }

  @Patch(':id')
  @ApiMessage('Natureza financeira atualizada com sucesso.')
  @ApiOperation({ summary: 'Atualiza uma natureza financeira.' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFinancialNatureDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const nature = await this.natures.findOne(id);
    assertOrganizationPermission(
      actor,
      nature.organizationId,
      'financial_nature.manage',
    );
    return this.natures.update(id, dto, actor);
  }

  @Delete(':id')
  @ApiMessage('Natureza financeira excluída com sucesso.')
  @ApiOperation({ summary: 'Exclui (logicamente) uma natureza sem uso.' })
  async remove(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    const nature = await this.natures.findOne(id);
    assertOrganizationPermission(
      actor,
      nature.organizationId,
      'financial_nature.delete',
    );
    return this.natures.remove(id, actor);
  }
}
