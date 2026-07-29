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
import { FinancialTagsService } from './financial-tags.service';
import {
  CreateFinancialTagDto,
  UpdateFinancialTagDto,
} from './dto/financial-tag.dto';
import { StructureQueryDto, TagLinkDto } from './dto/common.dto';

/** Tags financeiras livres, aplicáveis a vários cadastros da estrutura. */
@ApiTags('Tags financeiras')
@ApiBearerAuth()
@Controller('financial-tags')
export class FinancialTagsController {
  constructor(private readonly tags: FinancialTagsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista as tags financeiras, ordenadas por uso.' })
  findAll(
    @Query() query: StructureQueryDto,
    @Query('organizationId') organizationId: string,
    @Query('group') group: string | undefined,
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(actor, organizationId, 'financial-tags.view');
    return this.tags.findAll(organizationId, { ...query, group });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha uma tag financeira.' })
  async findOne(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    const tag = await this.tags.findOne(id);
    assertOrganizationPermission(
      actor,
      tag.organizationId,
      'financial-tags.view',
    );
    return tag;
  }

  @Get(':id/entities')
  @ApiOperation({
    summary:
      'Lista os cadastros marcados com esta tag (base do filtro global).',
  })
  async findLinkedEntities(
    @Param('id') id: string,
    @Query('entityType') entityType: string | undefined,
    @CurrentUser() actor: RequestUser,
  ) {
    const tag = await this.tags.findOne(id);
    assertOrganizationPermission(
      actor,
      tag.organizationId,
      'financial-tags.view',
    );
    return this.tags.findLinkedEntities(id, entityType);
  }

  @Post()
  @ApiMessage('Tag incluída com sucesso.')
  @ApiOperation({ summary: 'Inclui uma tag financeira.' })
  create(
    @Body() dto: CreateFinancialTagDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(
      actor,
      dto.organizationId,
      'financial-tags.manage',
    );
    return this.tags.create(dto, actor);
  }

  @Patch(':id')
  @ApiMessage('Tag atualizada com sucesso.')
  @ApiOperation({ summary: 'Atualiza uma tag financeira.' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFinancialTagDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const tag = await this.tags.findOne(id);
    assertOrganizationPermission(
      actor,
      tag.organizationId,
      'financial-tags.manage',
    );
    return this.tags.update(id, dto, actor);
  }

  @Post('link')
  @ApiMessage('Tag vinculada com sucesso.')
  @ApiOperation({
    summary: 'Vincula uma tag a um cadastro da estrutura financeira.',
  })
  async link(@Body() dto: TagLinkDto, @CurrentUser() actor: RequestUser) {
    const tag = await this.tags.findOne(dto.tagId);
    assertOrganizationPermission(
      actor,
      tag.organizationId,
      'financial-tags.manage',
    );
    return this.tags.link(dto, actor);
  }

  @Post('unlink')
  @ApiMessage('Tag desvinculada com sucesso.')
  @ApiOperation({ summary: 'Remove o vínculo de uma tag com um cadastro.' })
  async unlink(@Body() dto: TagLinkDto, @CurrentUser() actor: RequestUser) {
    const tag = await this.tags.findOne(dto.tagId);
    assertOrganizationPermission(
      actor,
      tag.organizationId,
      'financial-tags.manage',
    );
    return this.tags.unlink(dto, actor);
  }

  @Delete(':id')
  @ApiMessage('Tag excluída com sucesso.')
  @ApiOperation({ summary: 'Exclui (logicamente) uma tag financeira.' })
  async remove(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    const tag = await this.tags.findOne(id);
    assertOrganizationPermission(
      actor,
      tag.organizationId,
      'financial-tags.delete',
    );
    return this.tags.remove(id, actor);
  }
}
