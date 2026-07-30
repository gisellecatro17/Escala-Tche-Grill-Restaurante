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
import { CorporateCardStatus } from '@prisma/client';

import { ApiMessage } from '../../common/decorators/api-message.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/types/authenticated-request';
import {
  assertCompanyPermission,
  assertOrganizationPermission,
} from '../../common/utils/access-control.util';
import { CorporateCardsService } from './corporate-cards.service';
import {
  CorporateCardQueryDto,
  CorporateCardStatusChangeDto,
  CreateCorporateCardDto,
  UpdateCorporateCardDto,
  UpsertCardUserDto,
} from './dto/corporate-card.dto';

/**
 * Cartões corporativos. O sistema guarda apenas os quatro últimos dígitos: número
 * completo, CVV e senha não têm campo de entrada nem coluna no banco.
 */
@ApiTags('Tesouraria — cartões')
@ApiBearerAuth()
@Controller('corporate-cards')
export class CorporateCardsController {
  constructor(private readonly cards: CorporateCardsService) {}

  private async assertCan(id: string, permission: string, actor: RequestUser) {
    const scope = await this.cards.scopeOf(id);
    assertCompanyPermission(actor, scope.companyId, permission);
    return scope;
  }

  @Get()
  @ApiOperation({
    summary: 'Lista os cartões corporativos, com filtros e paginação.',
  })
  findAll(
    @Query() query: CorporateCardQueryDto,
    @Query('organizationId') organizationId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(actor, organizationId, 'card.view');
    return this.cards.findAll(organizationId, query);
  }

  @Get('alerts')
  @ApiOperation({
    summary:
      'Cartões vencendo, vencidos, sem responsável ou presos a uma conta inativa.',
  })
  findAlerts(
    @Query('organizationId') organizationId: string,
    @Query('companyId') companyId: string | undefined,
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(actor, organizationId, 'card.view');
    return this.cards.findAlerts(organizationId, companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha um cartão e seus portadores.' })
  async findOne(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    await this.assertCan(id, 'card.view', actor);
    return this.cards.findOne(id);
  }

  @Get(':id/usage')
  @ApiOperation({ summary: 'Vínculos do cartão e se ele pode ser excluído.' })
  async usage(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    await this.assertCan(id, 'card.view', actor);
    return this.cards.usage(id);
  }

  @Post()
  @ApiMessage('Cartão incluído com sucesso.')
  @ApiOperation({ summary: 'Inclui um cartão corporativo.' })
  create(
    @Body() dto: CreateCorporateCardDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, dto.companyId, 'card.create');
    return this.cards.create(dto, actor);
  }

  @Patch(':id')
  @ApiMessage('Cartão atualizado com sucesso.')
  @ApiOperation({ summary: 'Atualiza um cartão corporativo.' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCorporateCardDto,
    @CurrentUser() actor: RequestUser,
  ) {
    // Alterar limite é permissão própria: mexe na alçada de gasto da empresa.
    const permission =
      dto.totalLimit !== undefined || dto.transactionLimit !== undefined
        ? 'card.manage_limits'
        : 'card.update';
    await this.assertCan(id, permission, actor);
    return this.cards.update(id, dto, actor);
  }

  @Post(':id/block')
  @ApiMessage('Cartão bloqueado com sucesso.')
  @ApiOperation({ summary: 'Bloqueia o cartão, mantendo o histórico.' })
  async block(
    @Param('id') id: string,
    @Body() dto: CorporateCardStatusChangeDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertCan(id, 'card.block', actor);
    return this.cards.setStatus(id, CorporateCardStatus.BLOCKED, dto, actor);
  }

  @Post(':id/unblock')
  @ApiMessage('Cartão desbloqueado com sucesso.')
  @ApiOperation({ summary: 'Desbloqueia o cartão.' })
  async unblock(
    @Param('id') id: string,
    @Body() dto: CorporateCardStatusChangeDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertCan(id, 'card.unblock', actor);
    return this.cards.setStatus(id, CorporateCardStatus.ACTIVE, dto, actor);
  }

  @Post(':id/deactivate')
  @ApiMessage('Cartão inativado com sucesso.')
  @ApiOperation({
    summary: 'Inativa o cartão, preservando o histórico de uso.',
  })
  async deactivate(
    @Param('id') id: string,
    @Body() dto: CorporateCardStatusChangeDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertCan(id, 'card.deactivate', actor);
    return this.cards.setStatus(id, CorporateCardStatus.INACTIVE, dto, actor);
  }

  @Delete(':id')
  @ApiMessage('Cartão excluído com sucesso.')
  @ApiOperation({ summary: 'Exclui um cartão em rascunho sem portadores.' })
  async remove(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    await this.assertCan(id, 'card.delete', actor);
    return this.cards.remove(id, actor);
  }

  // ── Portadores ────────────────────────────────────────────────────────────

  @Get(':id/users')
  @ApiOperation({ summary: 'Portadores do cartão, com a alçada de cada um.' })
  async findUsers(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    await this.assertCan(id, 'card.view', actor);
    return this.cards.findUsers(id);
  }

  @Post(':id/users')
  @ApiMessage('Portador vinculado com sucesso.')
  @ApiOperation({ summary: 'Vincula ou atualiza um portador do cartão.' })
  async upsertUser(
    @Param('id') id: string,
    @Body() dto: UpsertCardUserDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertCan(id, 'card.manage_users', actor);
    return this.cards.upsertUser(id, dto, actor);
  }

  @Delete(':id/users/:userId')
  @ApiMessage('Portador desvinculado com sucesso.')
  @ApiOperation({ summary: 'Remove um portador do cartão.' })
  async removeUser(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertCan(id, 'card.manage_users', actor);
    return this.cards.removeUser(id, userId, actor);
  }
}
