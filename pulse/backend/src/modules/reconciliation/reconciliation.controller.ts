import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { ApiMessage } from '../../common/decorators/api-message.decorator';
import {
  CurrentActor,
  type RequestActor,
} from '../../common/decorators/current-actor.decorator';
import {
  assertCompanyPermission,
  assertOrganizationPermission,
} from '../../common/utils/access-control.util';
import { BankTransactionsService } from './bank-transactions.service';
import { ImportTemplatesService } from './import-templates.service';
import { ReconciliationDashboardService } from './reconciliation-dashboard.service';
import { ReconciliationSettingsService } from './reconciliation-settings.service';
import { ReconciliationService } from './reconciliation.service';
import { StatementImportService } from './statement-import.service';
import {
  AcceptSuggestionDto,
  AssignTransactionDto,
  ConfirmImportDto,
  CreateImportDto,
  CreateReconciliationDto,
  DashboardQueryDto,
  DismissSuggestionDto,
  GenerateSuggestionsDto,
  ImportQueryDto,
  ImportTemplateDto,
  LinkTransferDto,
  ManualTransactionDto,
  ReasonDto,
  ReconciliationCommentDto,
  ReconciliationQueryDto,
  TemplateQueryDto,
  TransactionQueryDto,
  UnmatchDto,
  UpdateReconciliationSettingsDto,
  UpdateTransactionDto,
} from './dto/reconciliation.dto';

/**
 * Centro de Conciliação Financeira.
 *
 * A permissão é sempre verificada contra a empresa do **registro**, lida do banco — nunca
 * contra a que veio no corpo da requisição. Trocar um id no cliente não muda o dono do
 * dado, e é essa consulta que garante o isolamento entre empresas.
 *
 * **Nenhuma rota concilia sozinha.** O motor sugere; toda conciliação passa por uma ação
 * humana explícita, com registro de usuário, data, IP e dispositivo.
 */
@ApiTags('Conciliação Bancária')
@ApiBearerAuth()
@Controller()
export class ReconciliationController {
  constructor(
    private readonly imports: StatementImportService,
    private readonly transactions: BankTransactionsService,
    private readonly reconciliations: ReconciliationService,
    private readonly dashboard: ReconciliationDashboardService,
    private readonly settings: ReconciliationSettingsService,
    private readonly templates: ImportTemplatesService,
  ) {}

  private assertScope(
    actor: RequestActor,
    organizationId: string,
    companyId: string | undefined,
    permission: string,
  ) {
    if (companyId) {
      assertCompanyPermission(actor, companyId, permission);
    } else {
      assertOrganizationPermission(actor, organizationId, permission);
    }
  }

  private async assertImportPermission(
    id: string,
    actor: RequestActor,
    permission: string,
  ) {
    const scope = await this.imports.scopeOf(id);
    assertCompanyPermission(actor, scope.companyId, permission);
    return scope;
  }

  private async assertTransactionPermission(
    id: string,
    actor: RequestActor,
    permission: string,
  ) {
    const scope = await this.transactions.scopeOf(id);
    assertCompanyPermission(actor, scope.companyId, permission);
    return scope;
  }

  // ── Painel (seções 24 a 26 e 44) ──────────────────────────────────────────

  @Get('reconciliation/dashboard')
  @ApiOperation({ summary: 'Cartões e indicadores da conciliação.' })
  async dashboardData(
    @Query() query: DashboardQueryDto,
    @CurrentActor() actor: RequestActor,
  ) {
    this.assertScope(
      actor,
      query.organizationId,
      query.companyId,
      'reconciliation.view',
    );

    return this.dashboard.overview(query);
  }

  @Get('reconciliation/balances')
  @ApiOperation({ summary: 'Saldo do extrato e do sistema por conta.' })
  async balances(
    @Query() query: DashboardQueryDto,
    @CurrentActor() actor: RequestActor,
  ) {
    this.assertScope(
      actor,
      query.organizationId,
      query.companyId,
      'reconciliation.view',
    );

    return this.dashboard.balances(query);
  }

  @Get('reconciliation/timeline')
  @ApiOperation({
    summary: 'Evolução diária de entradas, saídas e conciliações.',
  })
  async timeline(
    @Query() query: DashboardQueryDto,
    @CurrentActor() actor: RequestActor,
  ) {
    this.assertScope(
      actor,
      query.organizationId,
      query.companyId,
      'reconciliation.view',
    );

    return this.dashboard.timeline(query);
  }

  @Get('reconciliation/unidentified')
  @ApiOperation({ summary: 'Movimentações do extrato ainda sem lançamento.' })
  async unidentified(
    @Query() query: DashboardQueryDto,
    @CurrentActor() actor: RequestActor,
  ) {
    this.assertScope(
      actor,
      query.organizationId,
      query.companyId,
      'reconciliation.view',
    );

    return this.dashboard.unidentified(query);
  }

  @Get('reconciliation/without-statement')
  @ApiOperation({
    summary: 'Lançamentos do Pulse sem correspondência no extrato.',
  })
  async withoutStatement(
    @Query() query: DashboardQueryDto,
    @CurrentActor() actor: RequestActor,
  ) {
    this.assertScope(
      actor,
      query.organizationId,
      query.companyId,
      'reconciliation.view',
    );

    return this.dashboard.withoutStatement(query);
  }

  @Get('reconciliation/transfer-candidates')
  @ApiOperation({
    summary: 'Prováveis transferências entre contas da própria empresa.',
  })
  async transferCandidates(
    @Query() query: DashboardQueryDto,
    @CurrentActor() actor: RequestActor,
  ) {
    this.assertScope(
      actor,
      query.organizationId,
      query.companyId,
      'reconciliation.view',
    );

    return this.dashboard.transferCandidates(query);
  }

  // ── Parâmetros (seções 47 e 60) ───────────────────────────────────────────

  @Get('reconciliation/settings')
  @ApiOperation({ summary: 'Parâmetros da empresa e as exceções por conta.' })
  async settingsOf(
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @CurrentActor() actor: RequestActor,
  ) {
    assertCompanyPermission(actor, companyId, 'reconciliation.view_settings');
    return this.settings.listForCompany(organizationId, companyId);
  }

  @Patch('reconciliation/settings')
  @ApiMessage('Parâmetros atualizados com sucesso.')
  @ApiOperation({ summary: 'Altera os parâmetros da empresa ou de uma conta.' })
  async updateSettings(
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: UpdateReconciliationSettingsDto,
    @CurrentActor() actor: RequestActor,
  ) {
    assertCompanyPermission(actor, companyId, 'reconciliation.manage_settings');
    return this.settings.update(organizationId, companyId, dto, actor);
  }

  @Get('reconciliation/eligible-accounts')
  @ApiOperation({
    summary: 'Contas que aceitam conciliação e o que cada uma aceita.',
  })
  async eligibleAccounts(
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @CurrentActor() actor: RequestActor,
  ) {
    assertCompanyPermission(actor, companyId, 'reconciliation.view');
    return this.settings.eligibleAccounts(organizationId, companyId);
  }

  // ── Modelos de importação (seção 13) ──────────────────────────────────────

  @Get('reconciliation/import-templates')
  @ApiOperation({ summary: 'Modelos de leitura de extrato.' })
  async listTemplates(
    @Query() query: TemplateQueryDto,
    @CurrentActor() actor: RequestActor,
  ) {
    if (query.companyId) {
      assertCompanyPermission(actor, query.companyId, 'reconciliation.view');
    } else if (query.organizationId) {
      assertOrganizationPermission(
        actor,
        query.organizationId,
        'reconciliation.view',
      );
    }

    return this.templates.findAll(query);
  }

  @Get('reconciliation/import-templates/:id')
  @ApiOperation({ summary: 'Detalhe de um modelo de importação.' })
  async templateDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentActor() actor: RequestActor,
  ) {
    const template = await this.templates.findOne(id);

    this.assertScope(
      actor,
      template.organizationId,
      template.companyId ?? undefined,
      'reconciliation.view',
    );

    return template;
  }

  @Post('reconciliation/import-templates')
  @ApiMessage('Modelo criado com sucesso.')
  @ApiOperation({ summary: 'Cria um modelo de leitura de extrato.' })
  async createTemplate(
    @Body() dto: ImportTemplateDto,
    @CurrentActor() actor: RequestActor,
  ) {
    this.assertScope(
      actor,
      dto.organizationId,
      dto.companyId,
      'reconciliation.manage_templates',
    );

    return this.templates.create(dto, actor);
  }

  @Patch('reconciliation/import-templates/:id')
  @ApiMessage('Modelo atualizado com sucesso.')
  @ApiOperation({ summary: 'Altera um modelo de leitura de extrato.' })
  async updateTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ImportTemplateDto,
    @CurrentActor() actor: RequestActor,
  ) {
    const template = await this.templates.findOne(id);

    this.assertScope(
      actor,
      template.organizationId,
      template.companyId ?? undefined,
      'reconciliation.manage_templates',
    );

    return this.templates.update(id, dto, actor);
  }

  @Delete('reconciliation/import-templates/:id')
  @ApiMessage('Modelo arquivado com sucesso.')
  @ApiOperation({ summary: 'Arquiva um modelo de leitura de extrato.' })
  async removeTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentActor() actor: RequestActor,
  ) {
    const template = await this.templates.findOne(id);

    this.assertScope(
      actor,
      template.organizationId,
      template.companyId ?? undefined,
      'reconciliation.manage_templates',
    );

    return this.templates.remove(id, actor);
  }

  // ── Importação de extrato (seções 7 a 23) ─────────────────────────────────

  @Post('reconciliation/imports')
  @ApiMessage(
    'Arquivo validado. Confira a prévia antes de confirmar a importação.',
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Envia o extrato e devolve a prévia. Nada é importado ainda.',
  })
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateImportDto,
    @CurrentActor() actor: RequestActor,
  ) {
    assertCompanyPermission(actor, dto.companyId, 'reconciliation.import');
    return this.imports.upload(dto, file, actor);
  }

  @Post('reconciliation/imports/:id/confirm')
  @ApiMessage('Extrato importado com sucesso.')
  @ApiOperation({ summary: 'Confirma a importação da prévia já validada.' })
  async confirmImport(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmImportDto,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertImportPermission(id, actor, 'reconciliation.import');
    return this.imports.confirm(id, dto, actor);
  }

  @Get('reconciliation/imports')
  @ApiOperation({ summary: 'Extratos importados.' })
  async listImports(
    @Query() query: ImportQueryDto,
    @CurrentActor() actor: RequestActor,
  ) {
    if (query.companyId) {
      assertCompanyPermission(actor, query.companyId, 'reconciliation.view');
    } else if (query.organizationId) {
      assertOrganizationPermission(
        actor,
        query.organizationId,
        'reconciliation.view',
      );
    }

    return this.imports.findAll(query);
  }

  @Get('reconciliation/imports/:id')
  @ApiOperation({ summary: 'Detalhe de um extrato importado.' })
  async importDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertImportPermission(id, actor, 'reconciliation.view');
    return this.imports.findOne(id);
  }

  /**
   * URL assinada e temporária do arquivo original.
   *
   * O extrato nunca é público: o bucket é privado e cada download gera um link de vida
   * curta, com o acesso registrado. Servir o arquivo por URL fixa deixaria o extrato
   * inteiro acessível a quem descobrisse o caminho.
   */
  @Get('reconciliation/imports/:id/download')
  @ApiOperation({ summary: 'Gera a URL assinada do arquivo original.' })
  async downloadImport(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertImportPermission(id, actor, 'reconciliation.download');
    return this.imports.downloadUrl(id, actor);
  }

  @Post('reconciliation/imports/:id/reprocess')
  @ApiMessage('Extrato reprocessado com sucesso.')
  @ApiOperation({ summary: 'Lê o arquivo original novamente, sem reimportar.' })
  async reprocessImport(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertImportPermission(id, actor, 'reconciliation.import');
    return this.imports.reprocess(id, actor);
  }

  @Post('reconciliation/imports/:id/cancel')
  @ApiMessage('Importação cancelada.')
  @ApiOperation({ summary: 'Cancela a importação antes da confirmação.' })
  async cancelImport(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertImportPermission(id, actor, 'reconciliation.import');
    return this.imports.cancel(id, dto, actor);
  }

  @Post('reconciliation/imports/:id/archive')
  @ApiMessage('Importação arquivada.')
  @ApiOperation({ summary: 'Arquiva a importação já concluída.' })
  async archiveImport(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertImportPermission(id, actor, 'reconciliation.import');
    return this.imports.archive(id, actor);
  }

  // ── Movimentações bancárias (seções 16 a 22 e 39) ─────────────────────────

  @Get('reconciliation/transactions')
  @ApiOperation({ summary: 'Movimentações bancárias importadas.' })
  async listTransactions(
    @Query() query: TransactionQueryDto,
    @CurrentActor() actor: RequestActor,
  ) {
    if (query.companyId) {
      assertCompanyPermission(actor, query.companyId, 'reconciliation.view');
    } else if (query.organizationId) {
      assertOrganizationPermission(
        actor,
        query.organizationId,
        'reconciliation.view',
      );
    }

    return this.transactions.findAll(query, actor);
  }

  @Get('reconciliation/transactions/:id')
  @ApiOperation({ summary: 'Detalhe de uma movimentação bancária.' })
  async transactionDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertTransactionPermission(id, actor, 'reconciliation.view');
    return this.transactions.findOne(id, actor);
  }

  @Get('reconciliation/transactions/:id/history')
  @ApiOperation({ summary: 'Linha do tempo da movimentação.' })
  async transactionHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertTransactionPermission(id, actor, 'reconciliation.view');
    return this.transactions.history(id);
  }

  @Post('reconciliation/transactions')
  @ApiMessage('Movimentação registrada com sucesso.')
  @ApiOperation({
    summary: 'Registra uma movimentação digitada, marcada como manual.',
  })
  async createTransaction(
    @Body() dto: ManualTransactionDto,
    @CurrentActor() actor: RequestActor,
  ) {
    assertCompanyPermission(
      actor,
      dto.companyId,
      'reconciliation.create_manual_transaction',
    );

    return this.transactions.createManual(dto, actor);
  }

  @Patch('reconciliation/transactions/:id')
  @ApiMessage('Movimentação atualizada com sucesso.')
  @ApiOperation({
    summary: 'Corrige a leitura da movimentação. Valor e data não mudam.',
  })
  async updateTransaction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransactionDto,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertTransactionPermission(
      id,
      actor,
      'reconciliation.edit_transaction',
    );
    return this.transactions.update(id, dto, actor);
  }

  @Post('reconciliation/transactions/:id/ignore')
  @ApiMessage('Movimentação marcada como ignorada.')
  @ApiOperation({ summary: 'Tira a movimentação da fila sem conciliá-la.' })
  async ignoreTransaction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertTransactionPermission(id, actor, 'reconciliation.ignore');
    return this.transactions.ignore(id, dto, actor);
  }

  @Post('reconciliation/transactions/:id/assign')
  @ApiMessage('Responsável definido com sucesso.')
  @ApiOperation({ summary: 'Atribui a movimentação a alguém ou a uma equipe.' })
  async assignTransaction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTransactionDto,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertTransactionPermission(id, actor, 'reconciliation.assign');
    return this.transactions.assign(id, dto, actor);
  }

  // ── Sugestões (seções 28 a 31) ────────────────────────────────────────────

  @Post('reconciliation/transactions/:id/suggestions')
  @ApiMessage(
    'Sugestões geradas. Nenhuma conciliação foi feita automaticamente.',
  )
  @ApiOperation({
    summary: 'Gera sugestões para a movimentação. Exige confirmação humana.',
  })
  async generateSuggestions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertTransactionPermission(
      id,
      actor,
      'reconciliation.reconcile',
    );
    return this.transactions.generateSuggestions(id, actor);
  }

  @Get('reconciliation/transactions/:id/suggestions')
  @ApiOperation({
    summary: 'Sugestões da movimentação, com a memória de cálculo.',
  })
  async listSuggestions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertTransactionPermission(id, actor, 'reconciliation.view');
    return this.transactions.suggestionsOf(id);
  }

  @Post('reconciliation/suggestions/generate')
  @ApiMessage('Sugestões geradas em lote.')
  @ApiOperation({
    summary: 'Gera sugestões para várias movimentações de uma vez.',
  })
  async generateSuggestionsBatch(
    @Body() dto: GenerateSuggestionsDto,
    @CurrentActor() actor: RequestActor,
  ) {
    this.assertScope(
      actor,
      dto.organizationId,
      dto.companyId,
      'reconciliation.reconcile',
    );

    return this.transactions.generateSuggestionsBatch(dto, actor);
  }

  @Post('reconciliation/suggestions/:id/accept')
  @ApiMessage('Conciliação registrada com sucesso.')
  @ApiOperation({ summary: 'Aceita a sugestão e cria a conciliação.' })
  async acceptSuggestion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcceptSuggestionDto,
    @CurrentActor() actor: RequestActor,
  ) {
    const suggestion = await this.transactions.suggestionScopeOf(id);
    assertCompanyPermission(
      actor,
      suggestion.companyId,
      'reconciliation.reconcile',
    );

    return this.reconciliations.acceptSuggestion(
      id,
      actor,
      dto.notes,
      dto.differenceReason,
    );
  }

  @Post('reconciliation/suggestions/:id/dismiss')
  @ApiMessage('Sugestão descartada.')
  @ApiOperation({ summary: 'Descarta a sugestão com justificativa.' })
  async dismissSuggestion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DismissSuggestionDto,
    @CurrentActor() actor: RequestActor,
  ) {
    const suggestion = await this.transactions.suggestionScopeOf(id);
    assertCompanyPermission(
      actor,
      suggestion.companyId,
      'reconciliation.reconcile',
    );

    return this.transactions.dismissSuggestion(id, dto, actor);
  }

  // ── Conciliação (seções 32 a 37, 40 e 43) ─────────────────────────────────

  @Get('reconciliation/reconciliations')
  @ApiOperation({ summary: 'Conciliações registradas.' })
  async listReconciliations(
    @Query() query: ReconciliationQueryDto,
    @CurrentActor() actor: RequestActor,
  ) {
    if (query.companyId) {
      assertCompanyPermission(actor, query.companyId, 'reconciliation.view');
    } else if (query.organizationId) {
      assertOrganizationPermission(
        actor,
        query.organizationId,
        'reconciliation.view',
      );
    }

    return this.reconciliations.findAll(query);
  }

  @Get('reconciliation/reconciliations/:id')
  @ApiOperation({ summary: 'Detalhe de uma conciliação.' })
  async reconciliationDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentActor() actor: RequestActor,
  ) {
    const reconciliation = await this.reconciliations.findOne(id);
    assertCompanyPermission(
      actor,
      reconciliation.companyId,
      'reconciliation.view',
    );

    return reconciliation;
  }

  @Post('reconciliation/reconciliations')
  @ApiMessage('Conciliação registrada com sucesso.')
  @ApiOperation({
    summary:
      'Concilia manualmente: um-para-um, um-para-muitos ou muitos-para-um.',
  })
  async createReconciliation(
    @Body() dto: CreateReconciliationDto,
    @CurrentActor() actor: RequestActor,
  ) {
    const scope = await this.transactions.scopeOf(dto.bankTransactionIds[0]);
    assertCompanyPermission(actor, scope.companyId, 'reconciliation.reconcile');

    return this.reconciliations.create(dto, actor);
  }

  @Post('reconciliation/reconciliations/:id/unmatch')
  @ApiMessage('Conciliação desfeita.')
  @ApiOperation({
    summary: 'Desfaz a conciliação com justificativa. O registro é preservado.',
  })
  async unmatch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UnmatchDto,
    @CurrentActor() actor: RequestActor,
  ) {
    const reconciliation = await this.reconciliations.findOne(id);
    assertCompanyPermission(
      actor,
      reconciliation.companyId,
      'reconciliation.unmatch',
    );

    return this.reconciliations.unmatch(id, dto, actor);
  }

  @Post('reconciliation/transfers')
  @ApiMessage('Transferência interna vinculada com sucesso.')
  @ApiOperation({ summary: 'Liga a saída de uma conta à entrada de outra.' })
  async linkTransfer(
    @Body() dto: LinkTransferDto,
    @CurrentActor() actor: RequestActor,
  ) {
    const scope = await this.transactions.scopeOf(dto.outgoingTransactionId);
    assertCompanyPermission(actor, scope.companyId, 'reconciliation.reconcile');

    return this.reconciliations.linkTransfer(dto, actor);
  }

  // ── Comentários (seções 46 e 59) ──────────────────────────────────────────

  @Get('reconciliation/comments')
  @ApiOperation({
    summary: 'Comentários de uma movimentação, conciliação ou extrato.',
  })
  async listComments(
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @Query('bankTransactionId') bankTransactionId: string | undefined,
    @Query('reconciliationId') reconciliationId: string | undefined,
    @Query('statementImportId') statementImportId: string | undefined,
    @CurrentActor() actor: RequestActor,
  ) {
    this.assertScope(actor, organizationId, companyId, 'reconciliation.view');

    return this.reconciliations.comments({
      bankTransactionId,
      reconciliationId,
      statementImportId,
    });
  }

  @Post('reconciliation/comments')
  @ApiMessage('Comentário registrado.')
  @ApiOperation({
    summary: 'Comenta uma movimentação, conciliação ou extrato.',
  })
  async addComment(
    @Body() dto: ReconciliationCommentDto,
    @CurrentActor() actor: RequestActor,
  ) {
    assertCompanyPermission(actor, dto.companyId, 'reconciliation.comment');
    return this.reconciliations.addComment(dto, actor);
  }
}
