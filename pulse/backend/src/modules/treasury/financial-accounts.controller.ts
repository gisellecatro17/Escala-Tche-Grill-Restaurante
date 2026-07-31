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
import {
  assertCompanyPermission,
  assertOrganizationPermission,
} from '../../common/utils/access-control.util';
import {
  CloseFinancialAccountDto,
  CreateFinancialAccountDto,
  FinancialAccountQueryDto,
  FinancialAccountStatusChangeDto,
  UpdateFinancialAccountDto,
} from './dto/financial-account.dto';
import { FinancialAccountsService } from './financial-accounts.service';

/**
 * Contas financeiras: contas bancárias, caixas, fundos fixos e carteiras digitais.
 *
 * A permissão é sempre validada contra a **empresa do próprio registro**, buscada no
 * banco — nunca contra o que veio no corpo da requisição.
 */
@ApiTags('Tesouraria — contas financeiras')
@ApiBearerAuth()
@Controller('financial-accounts')
export class FinancialAccountsController {
  constructor(private readonly accounts: FinancialAccountsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista as contas financeiras, com filtros e paginação.',
  })
  findAll(
    @Query() query: FinancialAccountQueryDto,
    @Query('organizationId') organizationId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(
      actor,
      organizationId,
      'financial_account.view',
    );
    return this.accounts.findAll(organizationId, query, actor);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Detalha uma conta. Dados bancários e saldos são mascarados conforme a permissão.',
  })
  async findOne(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    const scope = await this.accounts.scopeOf(id);
    assertCompanyPermission(actor, scope.companyId, 'financial_account.view');
    return this.accounts.findOne(id, actor);
  }

  @Get(':id/usage')
  @ApiOperation({
    summary:
      'Vínculos da conta e se ela pode ser excluída ou apenas inativada.',
  })
  async usage(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    const scope = await this.accounts.scopeOf(id);
    assertCompanyPermission(actor, scope.companyId, 'financial_account.view');
    return this.accounts.usage(id);
  }

  @Get(':id/activation-pendencies')
  @ApiOperation({
    summary: 'Lista o que ainda falta para a conta poder ser ativada.',
  })
  async activationPendencies(
    @Param('id') id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    const scope = await this.accounts.scopeOf(id);
    assertCompanyPermission(actor, scope.companyId, 'financial_account.view');
    return { pendencies: await this.accounts.findActivationPendencies(id) };
  }

  @Get(':id/audit')
  @ApiOperation({
    summary: 'Histórico de status e trilha de auditoria da conta.',
  })
  async audit(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    const scope = await this.accounts.scopeOf(id);
    assertCompanyPermission(
      actor,
      scope.companyId,
      'financial_account.view_audit',
    );
    return this.accounts.findAudit(id);
  }

  @Post()
  @ApiMessage('Conta financeira incluída com sucesso.')
  @ApiOperation({ summary: 'Inclui uma conta financeira.' })
  create(
    @Body() dto: CreateFinancialAccountDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, dto.companyId, 'financial_account.create');
    return this.accounts.create(dto, actor);
  }

  @Post('drafts')
  @ApiMessage('Rascunho salvo com sucesso.')
  @ApiOperation({
    summary:
      'Salva a conta como rascunho, sem exigir os dados bancários completos, para retomar depois.',
  })
  createDraft(
    @Body() dto: CreateFinancialAccountDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, dto.companyId, 'financial_account.create');
    return this.accounts.createDraft(dto, actor);
  }

  @Patch(':id')
  @ApiMessage('Conta financeira atualizada com sucesso.')
  @ApiOperation({ summary: 'Atualiza uma conta financeira.' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFinancialAccountDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const scope = await this.accounts.scopeOf(id);
    assertCompanyPermission(actor, scope.companyId, 'financial_account.update');
    return this.accounts.update(id, dto, actor);
  }

  @Post(':id/activate')
  @ApiMessage('Conta ativada com sucesso.')
  @ApiOperation({
    summary: 'Ativa a conta. Recusado enquanto houver pendências de cadastro.',
  })
  async activate(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    const scope = await this.accounts.scopeOf(id);
    assertCompanyPermission(
      actor,
      scope.companyId,
      'financial_account.activate',
    );
    return this.accounts.activate(id, actor);
  }

  @Post(':id/block')
  @ApiMessage('Conta bloqueada com sucesso.')
  @ApiOperation({
    summary:
      'Bloqueia a conta: impede novas operações, mantendo saldo, extratos e histórico.',
  })
  async block(
    @Param('id') id: string,
    @Body() dto: FinancialAccountStatusChangeDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const scope = await this.accounts.scopeOf(id);
    assertCompanyPermission(actor, scope.companyId, 'financial_account.block');
    return this.accounts.block(id, dto, actor);
  }

  @Post(':id/unblock')
  @ApiMessage('Conta desbloqueada com sucesso.')
  @ApiOperation({
    summary: 'Desbloqueia a conta, devolvendo-a ao estado ativo.',
  })
  async unblock(
    @Param('id') id: string,
    @Body() dto: FinancialAccountStatusChangeDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const scope = await this.accounts.scopeOf(id);
    assertCompanyPermission(
      actor,
      scope.companyId,
      'financial_account.unblock',
    );
    return this.accounts.unblock(id, dto, actor);
  }

  @Post(':id/suspend')
  @ApiMessage('Conta suspensa com sucesso.')
  @ApiOperation({
    summary: 'Suspende a conta, mantendo-a disponível para consulta.',
  })
  async suspend(
    @Param('id') id: string,
    @Body() dto: FinancialAccountStatusChangeDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const scope = await this.accounts.scopeOf(id);
    assertCompanyPermission(
      actor,
      scope.companyId,
      'financial_account.suspend',
    );
    return this.accounts.suspend(id, dto, actor);
  }

  @Post(':id/deactivate')
  @ApiMessage('Conta inativada com sucesso.')
  @ApiOperation({
    summary:
      'Inativa a conta. Ela sai das novas operações e permanece no histórico.',
  })
  async deactivate(
    @Param('id') id: string,
    @Body() dto: FinancialAccountStatusChangeDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const scope = await this.accounts.scopeOf(id);
    assertCompanyPermission(
      actor,
      scope.companyId,
      'financial_account.deactivate',
    );
    return this.accounts.deactivate(id, dto, actor);
  }

  @Post(':id/close')
  @ApiMessage('Conta encerrada com sucesso.')
  @ApiOperation({
    summary:
      'Encerra a conta exigindo data, saldo final e motivo. Não é revertido por reativação simples.',
  })
  async close(
    @Param('id') id: string,
    @Body() dto: CloseFinancialAccountDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const scope = await this.accounts.scopeOf(id);
    assertCompanyPermission(actor, scope.companyId, 'financial_account.close');
    return this.accounts.close(id, dto, actor);
  }

  @Delete(':id')
  @ApiMessage('Conta financeira excluída com sucesso.')
  @ApiOperation({
    summary: 'Exclui uma conta em rascunho sem nenhum vínculo.',
  })
  async remove(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    const scope = await this.accounts.scopeOf(id);
    assertCompanyPermission(actor, scope.companyId, 'financial_account.delete');
    return this.accounts.remove(id, actor);
  }
}
