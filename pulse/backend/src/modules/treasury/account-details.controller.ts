import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BankIntegrationStatus } from '@prisma/client';

import { ApiMessage } from '../../common/decorators/api-message.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/types/authenticated-request';
import { assertCompanyPermission } from '../../common/utils/access-control.util';
import { AccountDetailsService } from './account-details.service';
import {
  CreateAccountIntegrationDto,
  CreateAccountLimitDto,
  CreateOpeningBalanceDto,
  UpdateAccountIntegrationDto,
  UpdateAccountLimitDto,
  UpsertAccountUserDto,
} from './dto/account-details.dto';
import { FinancialAccountsService } from './financial-accounts.service';

/**
 * Saldos, limites, usuários e integrações de uma conta financeira. Todas as rotas
 * partem de `/financial-accounts/:id` e validam a permissão contra a empresa da conta.
 */
@ApiTags('Tesouraria — saldos, limites, usuários e integrações')
@ApiBearerAuth()
@Controller('financial-accounts/:id')
export class AccountDetailsController {
  constructor(
    private readonly details: AccountDetailsService,
    private readonly accounts: FinancialAccountsService,
  ) {}

  /** Resolve a empresa da conta e valida a permissão contra ela. */
  private async assertCan(id: string, permission: string, actor: RequestUser) {
    const scope = await this.accounts.scopeOf(id);
    assertCompanyPermission(actor, scope.companyId, permission);
    return scope;
  }

  // ── Saldo inicial ─────────────────────────────────────────────────────────

  @Get('opening-balance')
  @ApiOperation({
    summary:
      'Histórico de saldos iniciais. O registro aprovado é o vigente; os anteriores ficam como substituídos.',
  })
  async findOpeningBalances(
    @Param('id') id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertCan(id, 'financial_account.view_balance', actor);
    return this.details.findOpeningBalances(id);
  }

  @Post('opening-balance')
  @ApiMessage('Saldo inicial registrado com sucesso.')
  @ApiOperation({
    summary:
      'Registra o saldo de implantação. Havendo saldo aprovado, exige justificativa e preserva o anterior.',
  })
  async createOpeningBalance(
    @Param('id') id: string,
    @Body() dto: CreateOpeningBalanceDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertCan(id, 'financial_account.manage_initial_balance', actor);
    return this.details.createOpeningBalance(id, dto, actor);
  }

  // ── Limites ───────────────────────────────────────────────────────────────

  @Get('limits')
  @ApiOperation({ summary: 'Lista os limites contratados da conta.' })
  async findLimits(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    await this.assertCan(id, 'financial_account.view_balance', actor);
    return this.details.findLimits(id);
  }

  @Post('limits')
  @ApiMessage('Limite incluído com sucesso.')
  @ApiOperation({ summary: 'Inclui um limite contratado.' })
  async createLimit(
    @Param('id') id: string,
    @Body() dto: CreateAccountLimitDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertCan(id, 'financial_account.manage_limits', actor);
    return this.details.createLimit(id, dto, actor);
  }

  @Patch('limits/:limitId')
  @ApiMessage('Limite atualizado com sucesso.')
  @ApiOperation({ summary: 'Atualiza um limite contratado.' })
  async updateLimit(
    @Param('id') id: string,
    @Param('limitId') limitId: string,
    @Body() dto: UpdateAccountLimitDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertCan(id, 'financial_account.manage_limits', actor);
    return this.details.updateLimit(id, limitId, dto, actor);
  }

  // ── Usuários da conta ─────────────────────────────────────────────────────

  @Get('users')
  @ApiOperation({
    summary: 'Usuários vinculados à conta, com a alçada de cada um.',
  })
  async findUsers(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    await this.assertCan(id, 'financial_account.view', actor);
    return this.details.findUsers(id);
  }

  @Post('users')
  @ApiMessage('Usuário vinculado à conta com sucesso.')
  @ApiOperation({
    summary:
      'Vincula ou atualiza um usuário na conta. O mesmo usuário pode ter alçadas diferentes em contas diferentes.',
  })
  async upsertUser(
    @Param('id') id: string,
    @Body() dto: UpsertAccountUserDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertCan(id, 'financial_account.manage_users', actor);
    return this.details.upsertUser(id, dto, actor);
  }

  @Patch('users/:userId')
  @ApiMessage('Permissões do usuário atualizadas com sucesso.')
  @ApiOperation({ summary: 'Atualiza a alçada de um usuário na conta.' })
  async updateUser(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: Omit<UpsertAccountUserDto, 'userId'>,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertCan(id, 'financial_account.manage_users', actor);
    return this.details.upsertUser(id, { ...dto, userId }, actor);
  }

  @Delete('users/:userId')
  @ApiMessage('Usuário desvinculado da conta com sucesso.')
  @ApiOperation({ summary: 'Remove o vínculo de um usuário com a conta.' })
  async removeUser(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertCan(id, 'financial_account.manage_users', actor);
    return this.details.removeUser(id, userId, actor);
  }

  // ── Integrações ───────────────────────────────────────────────────────────

  @Get('integrations')
  @ApiOperation({
    summary:
      'Integrações da conta. A referência à credencial nunca é retornada — apenas se existe.',
  })
  async findIntegrations(
    @Param('id') id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertCan(id, 'financial_account.manage_integration', actor);
    return this.details.findIntegrations(id);
  }

  @Post('integrations')
  @ApiMessage('Integração configurada com sucesso.')
  @ApiOperation({ summary: 'Configura uma integração bancária para a conta.' })
  async createIntegration(
    @Param('id') id: string,
    @Body() dto: CreateAccountIntegrationDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertCan(id, 'financial_account.manage_integration', actor);
    return this.details.createIntegration(id, dto, actor);
  }

  @Patch('integrations/:integrationId')
  @ApiMessage('Integração atualizada com sucesso.')
  @ApiOperation({ summary: 'Atualiza a configuração de uma integração.' })
  async updateIntegration(
    @Param('id') id: string,
    @Param('integrationId') integrationId: string,
    @Body() dto: UpdateAccountIntegrationDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertCan(id, 'financial_account.manage_integration', actor);
    return this.details.updateIntegration(id, integrationId, dto, actor);
  }

  @Post('integrations/:integrationId/test')
  @ApiOperation({
    summary:
      'Testa a integração. Nesta etapa é simulado: confere a configuração, sem chamar o banco.',
  })
  async testIntegration(
    @Param('id') id: string,
    @Param('integrationId') integrationId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertCan(id, 'financial_account.manage_integration', actor);
    return this.details.testIntegration(id, integrationId, actor);
  }

  @Post('integrations/:integrationId/activate')
  @ApiMessage('Integração ativada com sucesso.')
  @ApiOperation({
    summary:
      'Ativa a integração. Recusado enquanto não houver credencial configurada.',
  })
  async activateIntegration(
    @Param('id') id: string,
    @Param('integrationId') integrationId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertCan(id, 'financial_account.manage_integration', actor);
    return this.details.setIntegrationStatus(
      id,
      integrationId,
      BankIntegrationStatus.ACTIVE,
      actor,
    );
  }

  @Post('integrations/:integrationId/disconnect')
  @ApiMessage('Integração desconectada com sucesso.')
  @ApiOperation({
    summary:
      'Desconecta a integração e apaga o ponteiro da credencial, tornando-a inalcançável.',
  })
  async disconnectIntegration(
    @Param('id') id: string,
    @Param('integrationId') integrationId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertCan(id, 'financial_account.manage_integration', actor);
    return this.details.setIntegrationStatus(
      id,
      integrationId,
      BankIntegrationStatus.DISCONNECTED,
      actor,
    );
  }
}
