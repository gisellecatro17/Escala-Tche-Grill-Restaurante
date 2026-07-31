import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ApiMessage } from '../../common/decorators/api-message.decorator';
import {
  CurrentActor,
  type RequestActor,
} from '../../common/decorators/current-actor.decorator';
import {
  assertCompanyPermission,
  assertOrganizationPermission,
} from '../../common/utils/access-control.util';
import { AccountsPayableDashboardService } from './accounts-payable-dashboard.service';
import { AccountsPayableService } from './accounts-payable.service';
import { PayableGenerationService } from './payable-generation.service';
import { PayableSettlementService } from './payable-settlement.service';
import {
  AccountsPayableQueryDto,
  AdjustmentDto,
  AdvanceQueryDto,
  ApplyAdvanceDto,
  BlockDto,
  CreateAccountsPayableDto,
  CreateAdvanceDto,
  PartialPaymentDto,
  PayableCommentDto,
  PayableWithholdingDto,
  ReasonDto,
  ReinstallDto,
  RenegotiateDto,
  SchedulePaymentDto,
  UnblockDto,
  UpdateAccountsPayableDto,
  UpdateAccountsPayableSettingsDto,
  UpdatePayableInstallmentDto,
  WithholdingDecisionDto,
} from './dto/accounts-payable.dto';

/**
 * Contas a Pagar.
 *
 * A permissão é sempre validada contra a empresa do **registro**, lida do banco — nunca
 * contra a empresa que o cliente informou. É o que garante o isolamento multiempresa
 * (critério de aceite 8) mesmo que alguém chame a API na mão com o id de outro título.
 *
 * Nenhuma rota aqui move dinheiro no banco: registrar baixa é dizer que o pagamento
 * aconteceu, não executá-lo.
 */
@ApiTags('Contas a Pagar')
@ApiBearerAuth()
@Controller()
export class AccountsPayableController {
  constructor(
    private readonly payables: AccountsPayableService,
    private readonly settlement: PayableSettlementService,
    private readonly dashboard: AccountsPayableDashboardService,
    private readonly generation: PayableGenerationService,
  ) {}

  private async assertPayablePermission(
    id: string,
    actor: RequestActor,
    permission: string,
  ) {
    const scope = await this.payables.scopeOf(id);
    assertCompanyPermission(actor, scope.companyId, permission);
    return scope;
  }

  private async assertInstallmentPermission(
    installmentId: string,
    actor: RequestActor,
    permission: string,
  ) {
    const scope = await this.payables.scopeOfInstallment(installmentId);
    assertCompanyPermission(actor, scope.companyId, permission);
    return scope;
  }

  // ── Painel e parâmetros ───────────────────────────────────────────────────

  @Get('accounts-payable/dashboard')
  @ApiOperation({ summary: 'Indicadores do contas a pagar.' })
  async dashboardData(
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('companyId') companyId: string | undefined,
    @CurrentActor() actor: RequestActor,
  ) {
    if (companyId) {
      assertCompanyPermission(actor, companyId, 'accounts_payable.view');
    } else {
      assertOrganizationPermission(
        actor,
        organizationId,
        'accounts_payable.view',
      );
    }

    return this.dashboard.build(organizationId, companyId);
  }

  @Get('accounts-payable/settings')
  @ApiOperation({ summary: 'Parâmetros do contas a pagar da empresa.' })
  async settings(
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @CurrentActor() actor: RequestActor,
  ) {
    assertCompanyPermission(actor, companyId, 'accounts_payable.view');
    return this.payables.findSettings(organizationId, companyId);
  }

  @Patch('accounts-payable/settings')
  @ApiMessage('Parâmetros atualizados com sucesso.')
  @ApiOperation({ summary: 'Altera os parâmetros do contas a pagar.' })
  async updateSettings(
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: UpdateAccountsPayableSettingsDto,
    @CurrentActor() actor: RequestActor,
  ) {
    assertCompanyPermission(actor, companyId, 'accounts_payable.edit');
    return this.payables.updateSettings(organizationId, companyId, dto, actor);
  }

  // ── Adiantamentos ─────────────────────────────────────────────────────────

  @Get('supplier-advances')
  @ApiOperation({ summary: 'Adiantamentos concedidos a fornecedores.' })
  async advances(
    @Query() query: AdvanceQueryDto,
    @CurrentActor() actor: RequestActor,
  ) {
    if (query.companyId) {
      assertCompanyPermission(actor, query.companyId, 'accounts_payable.view');
    }

    return this.settlement.findAdvances(query);
  }

  @Post('supplier-advances')
  @ApiMessage('Adiantamento registrado com sucesso.')
  @ApiOperation({ summary: 'Registra um adiantamento a fornecedor.' })
  async createAdvance(
    @Body() dto: CreateAdvanceDto,
    @CurrentActor() actor: RequestActor,
  ) {
    assertCompanyPermission(actor, dto.companyId, 'accounts_payable.create');
    return this.settlement.createAdvance(dto, actor);
  }

  // ── Títulos ───────────────────────────────────────────────────────────────

  @Get('accounts-payable')
  @ApiOperation({ summary: 'Lista os títulos a pagar.' })
  async findAll(
    @Query() query: AccountsPayableQueryDto,
    @CurrentActor() actor: RequestActor,
  ) {
    if (query.companyId) {
      assertCompanyPermission(actor, query.companyId, 'accounts_payable.view');
    } else if (query.organizationId) {
      assertOrganizationPermission(
        actor,
        query.organizationId,
        'accounts_payable.view',
      );
    }

    return this.payables.findAll(query, actor);
  }

  @Post('accounts-payable')
  @ApiMessage('Título criado com sucesso.')
  @ApiOperation({ summary: 'Cria um título a pagar manualmente.' })
  async create(
    @Body() dto: CreateAccountsPayableDto,
    @CurrentActor() actor: RequestActor,
  ) {
    assertCompanyPermission(actor, dto.companyId, 'accounts_payable.create');
    return this.payables.create(dto, actor);
  }

  @Post('accounts-payable/from-entry/:entryId')
  @ApiMessage('Título gerado com sucesso.')
  @ApiOperation({
    summary:
      'Gera o título de um lançamento aprovado que ainda não virou obrigação.',
  })
  async generate(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @CurrentActor() actor: RequestActor,
  ) {
    const entry = await this.payables.scopeOfEntry(entryId);
    assertCompanyPermission(actor, entry.companyId, 'accounts_payable.create');

    return this.generation.generateFromEntry(entryId, actor, { force: true });
  }

  @Get('accounts-payable/:id')
  @ApiOperation({ summary: 'Detalhe do título.' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertPayablePermission(id, actor, 'accounts_payable.view');
    return this.payables.findOne(id, actor);
  }

  @Patch('accounts-payable/:id')
  @ApiMessage('Título atualizado com sucesso.')
  @ApiOperation({ summary: 'Altera o cadastro do título.' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountsPayableDto,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertPayablePermission(id, actor, 'accounts_payable.edit');
    return this.payables.update(id, dto, actor);
  }

  @Get('accounts-payable/:id/history')
  @ApiOperation({ summary: 'Histórico completo do título.' })
  async history(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertPayablePermission(id, actor, 'accounts_payable.view');
    return this.payables.history(id);
  }

  // ── Bloqueios ─────────────────────────────────────────────────────────────

  @Post('accounts-payable/:id/block')
  @ApiMessage('Título bloqueado.')
  @ApiOperation({
    summary: 'Bloqueia o título e impede o envio para pagamento.',
  })
  async block(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BlockDto,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertPayablePermission(id, actor, 'accounts_payable.block');
    return this.payables.block(id, dto, actor);
  }

  @Post('accounts-payable/:id/unblock')
  @ApiMessage('Bloqueio liberado.')
  @ApiOperation({ summary: 'Libera o bloqueio do título.' })
  async unblock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UnblockDto,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertPayablePermission(id, actor, 'accounts_payable.unblock');
    return this.payables.unblock(id, dto, actor);
  }

  // ── Movimento financeiro ──────────────────────────────────────────────────

  @Post('accounts-payable/:id/partial-payment')
  @ApiMessage('Pagamento registrado com sucesso.')
  @ApiOperation({ summary: 'Registra uma baixa, total ou parcial.' })
  async partialPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PartialPaymentDto,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertPayablePermission(
      id,
      actor,
      'accounts_payable.partial_payment',
    );
    return this.settlement.registerPayment(id, dto, actor);
  }

  @Post('accounts-payable/payments/:paymentId/reverse')
  @ApiMessage('Pagamento estornado.')
  @ApiOperation({ summary: 'Estorna uma baixa registrada.' })
  async reversePayment(
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() dto: ReasonDto,
    @CurrentActor() actor: RequestActor,
  ) {
    const scope = await this.payables.scopeOfPayment(paymentId);
    assertCompanyPermission(
      actor,
      scope.companyId,
      'accounts_payable.partial_payment',
    );
    return this.settlement.reversePayment(paymentId, dto, actor);
  }

  @Post('accounts-payable/:id/adjustments')
  @ApiMessage('Ajuste aplicado com sucesso.')
  @ApiOperation({ summary: 'Lança juros, multa, desconto ou correção.' })
  async addAdjustment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustmentDto,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertPayablePermission(id, actor, 'accounts_payable.edit');
    return this.settlement.addAdjustment(id, dto, actor);
  }

  @Post('accounts-payable/adjustments/:adjustmentId/reverse')
  @ApiMessage('Ajuste estornado.')
  @ApiOperation({ summary: 'Estorna um ajuste lançado.' })
  async reverseAdjustment(
    @Param('adjustmentId', ParseUUIDPipe) adjustmentId: string,
    @Body() dto: ReasonDto,
    @CurrentActor() actor: RequestActor,
  ) {
    const scope = await this.payables.scopeOfAdjustment(adjustmentId);
    assertCompanyPermission(actor, scope.companyId, 'accounts_payable.edit');
    return this.settlement.reverseAdjustment(adjustmentId, dto, actor);
  }

  @Get('accounts-payable/:id/late-charges')
  @ApiOperation({
    summary:
      'Prévia de juros e multa pelo atraso, com memória de cálculo. Não grava nada.',
  })
  async lateCharges(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertPayablePermission(id, actor, 'accounts_payable.view');
    return this.settlement.previewLateCharges(id);
  }

  @Post('accounts-payable/:id/renegotiate')
  @ApiMessage('Título renegociado com sucesso.')
  @ApiOperation({ summary: 'Renegocia o título com um novo cronograma.' })
  async renegotiate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenegotiateDto,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertPayablePermission(
      id,
      actor,
      'accounts_payable.renegotiate',
    );
    return this.settlement.renegotiate(id, dto, actor);
  }

  @Post('accounts-payable/:id/apply-advance')
  @ApiMessage('Adiantamento abatido com sucesso.')
  @ApiOperation({ summary: 'Abate um adiantamento no saldo do título.' })
  async applyAdvance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplyAdvanceDto,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertPayablePermission(
      id,
      actor,
      'accounts_payable.partial_payment',
    );
    return this.settlement.applyAdvance(id, dto, actor);
  }

  // ── Programação e parcelas ────────────────────────────────────────────────

  @Post('accounts-payable/:id/schedule')
  @ApiMessage('Pagamento programado.')
  @ApiOperation({
    summary:
      'Programa o pagamento dentro do Pulse. Não agenda no banco — isso é do módulo seguinte.',
  })
  async schedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SchedulePaymentDto,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertPayablePermission(id, actor, 'accounts_payable.edit');
    return this.payables.schedule(id, dto, actor);
  }

  @Post('accounts-payable/:id/reinstall')
  @ApiMessage('Parcelas refeitas com sucesso.')
  @ApiOperation({
    summary: 'Reparcela o saldo em aberto, sem alterar o valor total.',
  })
  async reinstall(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReinstallDto,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertPayablePermission(id, actor, 'accounts_payable.edit');
    return this.payables.reinstall(id, dto, actor);
  }

  @Patch('accounts-payable/installments/:installmentId')
  @ApiMessage('Parcela atualizada com sucesso.')
  @ApiOperation({
    summary: 'Altera vencimento, valor ou dados de pagamento da parcela.',
  })
  async updateInstallment(
    @Param('installmentId', ParseUUIDPipe) installmentId: string,
    @Body() dto: UpdatePayableInstallmentDto,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertInstallmentPermission(
      installmentId,
      actor,
      'accounts_payable.edit',
    );
    return this.payables.updateInstallment(installmentId, dto, actor);
  }

  @Post('accounts-payable/installments/:installmentId/cancel')
  @ApiMessage('Parcela cancelada.')
  @ApiOperation({ summary: 'Cancela uma parcela futura sem pagamento.' })
  async cancelInstallment(
    @Param('installmentId', ParseUUIDPipe) installmentId: string,
    @Body() dto: ReasonDto,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertInstallmentPermission(
      installmentId,
      actor,
      'accounts_payable.edit',
    );
    return this.payables.cancelInstallment(installmentId, dto, actor);
  }

  // ── Retenções ─────────────────────────────────────────────────────────────

  @Post('accounts-payable/:id/withholdings')
  @ApiMessage('Retenção revisada com sucesso.')
  @ApiOperation({
    summary: 'Revisa uma retenção do título, com memória de cálculo.',
  })
  async reviseWithholding(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PayableWithholdingDto,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertPayablePermission(id, actor, 'accounts_payable.edit');
    return this.payables.reviseWithholding(id, dto, actor);
  }

  @Post('accounts-payable/withholdings/:withholdingId/decision')
  @ApiMessage('Decisão registrada.')
  @ApiOperation({ summary: 'Confirma ou descarta uma retenção do título.' })
  async decideWithholding(
    @Param('withholdingId', ParseUUIDPipe) withholdingId: string,
    @Body() dto: WithholdingDecisionDto,
    @CurrentActor() actor: RequestActor,
  ) {
    const scope = await this.payables.scopeOfWithholding(withholdingId);
    assertCompanyPermission(actor, scope.companyId, 'accounts_payable.edit');
    return this.payables.decideWithholding(withholdingId, dto, actor);
  }

  // ── Ciclo de vida ─────────────────────────────────────────────────────────

  @Post('accounts-payable/:id/cancel')
  @ApiMessage('Título cancelado.')
  @ApiOperation({ summary: 'Cancela o título com motivo.' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertPayablePermission(id, actor, 'accounts_payable.cancel');
    return this.payables.cancel(id, dto, actor);
  }

  @Post('accounts-payable/:id/reopen')
  @ApiMessage('Título reaberto.')
  @ApiOperation({ summary: 'Reabre um título cancelado.' })
  async reopen(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertPayablePermission(id, actor, 'accounts_payable.reopen');
    return this.payables.reopen(id, dto, actor);
  }

  // ── Comentários ───────────────────────────────────────────────────────────

  @Get('accounts-payable/:id/comments')
  @ApiOperation({ summary: 'Comentários do título.' })
  async comments(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertPayablePermission(id, actor, 'accounts_payable.view');
    return this.payables.comments(id);
  }

  @Post('accounts-payable/:id/comments')
  @ApiMessage('Comentário registrado.')
  @ApiOperation({ summary: 'Comenta no título.' })
  async comment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PayableCommentDto,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertPayablePermission(id, actor, 'accounts_payable.view');
    return this.payables.comment(id, dto, actor);
  }
}
