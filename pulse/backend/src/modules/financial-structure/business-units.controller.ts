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
import { BusinessUnitsService } from './business-units.service';
import {
  CreateBusinessUnitDto,
  UpdateBusinessUnitDto,
} from './dto/business-unit.dto';
import { MoveNodeDto, StructureQueryDto } from './dto/common.dto';

/** Unidades de negócio — dimensão independente, em árvore. */
@ApiTags('Unidades de negócio')
@ApiBearerAuth()
@Controller('business-units')
export class BusinessUnitsController {
  constructor(private readonly businessUnits: BusinessUnitsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista as unidades de negócio.' })
  findAll(
    @Query() query: StructureQueryDto,
    @Query('organizationId') organizationId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(actor, organizationId, 'business-units.view');
    return this.businessUnits.findAll(organizationId, query);
  }

  @Get('tree')
  @ApiOperation({
    summary: 'Retorna a árvore completa de unidades de negócio.',
  })
  findTree(
    @Query('organizationId') organizationId: string,
    @Query('companyId') companyId: string | undefined,
    @Query('includeInactive') includeInactive: string | undefined,
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(actor, organizationId, 'business-units.view');
    return this.businessUnits.findTree(
      organizationId,
      companyId,
      includeInactive === 'true',
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha uma unidade de negócio.' })
  async findOne(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    const unit = await this.businessUnits.findOne(id);
    assertOrganizationPermission(
      actor,
      unit.organizationId,
      'business-units.view',
    );
    return unit;
  }

  @Post()
  @ApiMessage('Unidade de negócio incluída com sucesso.')
  @ApiOperation({ summary: 'Inclui uma unidade de negócio.' })
  create(
    @Body() dto: CreateBusinessUnitDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(
      actor,
      dto.organizationId,
      'business-units.manage',
    );
    return this.businessUnits.create(dto, actor);
  }

  @Patch(':id')
  @ApiMessage('Unidade de negócio atualizada com sucesso.')
  @ApiOperation({ summary: 'Atualiza uma unidade de negócio.' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBusinessUnitDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const unit = await this.businessUnits.findOne(id);
    assertOrganizationPermission(
      actor,
      unit.organizationId,
      'business-units.manage',
    );
    return this.businessUnits.update(id, dto, actor);
  }

  @Post(':id/move')
  @ApiMessage('Unidade de negócio movida com sucesso.')
  @ApiOperation({ summary: 'Move a unidade de negócio na árvore.' })
  async move(
    @Param('id') id: string,
    @Body() dto: MoveNodeDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const unit = await this.businessUnits.findOne(id);
    assertOrganizationPermission(
      actor,
      unit.organizationId,
      'business-units.manage',
    );
    return this.businessUnits.move(id, dto, actor);
  }

  @Delete(':id')
  @ApiMessage('Unidade de negócio excluída com sucesso.')
  @ApiOperation({
    summary: 'Exclui (logicamente) uma unidade sem filhas nem uso.',
  })
  async remove(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    const unit = await this.businessUnits.findOne(id);
    assertOrganizationPermission(
      actor,
      unit.organizationId,
      'business-units.delete',
    );
    return this.businessUnits.remove(id, actor);
  }
}
