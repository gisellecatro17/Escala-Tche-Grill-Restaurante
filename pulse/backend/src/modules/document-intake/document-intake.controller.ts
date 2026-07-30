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
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { ApiMessage } from '../../common/decorators/api-message.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/types/authenticated-request';
import {
  assertCompanyPermission,
  assertOrganizationPermission,
} from '../../common/utils/access-control.util';
import { BoletoValidationService } from './boleto-validation.service';
import { DocumentIntakeService } from './document-intake.service';
import { DuplicateDetectionService } from './duplicate-detection.service';
import { IntakeIssuesService } from './intake-issues.service';
import { IntakePipelineService } from './intake-pipeline.service';
import {
  AssignDocumentDto,
  BatchActionDto,
  BatchAssignDto,
  BatchClassifyDto,
  BatchRejectDto,
  ChangeCompanyDto,
  CompareBoletoDto,
  CreateIssueDto,
  DuplicateDecisionDto,
  ForwardDocumentDto,
  IntakeDocumentQueryDto,
  ManualEntryDto,
  ReasonDto,
  RejectDocumentDto,
  RelateDocumentDto,
  ResolveIssueDto,
  ReviewDocumentDto,
  SplitDocumentDto,
  UpdateDocumentIntakeSettingsDto,
  UpdateIntakeDocumentDto,
  UpdateIssueDto,
  UploadIntakeDocumentDto,
  ValidateBoletoDto,
} from './dto/document-intake.dto';

/**
 * Entrada de documentos: envio, caixa de entrada, revisão e encaminhamento.
 *
 * A permissão é sempre validada contra a **empresa do próprio registro**, buscada no banco
 * — nunca contra o que veio no corpo da requisição. Um documento sem empresa definida cai
 * na permissão de organização, porque ainda não há empresa contra a qual validar.
 */
@ApiTags('Entrada de Documentos')
@ApiBearerAuth()
@Controller('document-intake')
export class DocumentIntakeController {
  constructor(
    private readonly intake: DocumentIntakeService,
    private readonly duplicates: DuplicateDetectionService,
    private readonly issues: IntakeIssuesService,
    private readonly pipeline: IntakePipelineService,
    private readonly boleto: BoletoValidationService,
  ) {}

  /**
   * Valida a permissão contra o registro.
   *
   * Documento sem empresa (empresa não identificada) não pode ser validado por empresa, e
   * exigir uma empresa que não existe deixaria a fila "Empresa não identificada"
   * inacessível. Nesse caso a validação sobe para a organização.
   */
  private async assertDocumentPermission(
    id: string,
    actor: RequestUser,
    permission: string,
  ) {
    const scope = await this.intake.scopeOf(id);

    if (scope.companyId) {
      assertCompanyPermission(actor, scope.companyId, permission);
    } else {
      assertOrganizationPermission(actor, scope.organizationId, permission);
    }

    return scope;
  }

  // ── Visão geral ───────────────────────────────────────────────────────────

  @Get('overview')
  @ApiOperation({
    summary:
      'Consolidado da entrada de documentos: contagens, pendências, fila e indicadores.',
  })
  overview(
    @Query('organizationId') organizationId: string,
    @Query('companyId') companyId: string | undefined,
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(actor, organizationId, 'document_intake.view');
    return this.intake.findOverview(organizationId, companyId);
  }

  @Get('processing-queue')
  @ApiOperation({ summary: 'Situação da fila de processamento.' })
  processingQueue(
    @Query('organizationId') organizationId: string,
    @Query('companyId') companyId: string | undefined,
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(actor, organizationId, 'document_intake.view');
    return this.pipeline.queueStatus(organizationId, companyId);
  }

  // ── Parâmetros ────────────────────────────────────────────────────────────

  @Get('settings')
  @ApiOperation({
    summary:
      'Parâmetros do módulo por empresa. Criados com os padrões conservadores na primeira consulta.',
  })
  findSettings(
    @Query('organizationId') organizationId: string,
    @Query('companyId') companyId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, companyId, 'document_intake.view');
    return this.intake.findSettings(organizationId, companyId);
  }

  @Patch('settings')
  @ApiMessage('Parâmetros atualizados com sucesso.')
  @ApiOperation({ summary: 'Atualiza os parâmetros da entrada de documentos.' })
  updateSettings(
    @Query('organizationId') organizationId: string,
    @Query('companyId') companyId: string,
    @Body() dto: UpdateDocumentIntakeSettingsDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(
      actor,
      companyId,
      'document_intake.manage_settings',
    );
    return this.intake.updateSettings(organizationId, companyId, dto, actor);
  }

  // ── Envio (seção 67) ──────────────────────────────────────────────────────

  @Post('uploads')
  @ApiMessage('Documento enviado com sucesso.')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Envia um documento financeiro.' })
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadIntakeDocumentDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, dto.companyId, 'document_intake.upload');

    const result = await this.intake.receiveUpload({
      organizationId: dto.organizationId,
      companyId: dto.companyId,
      file,
      sourceChannel: dto.sourceChannel,
      documentType: dto.documentType,
      notes: dto.notes,
      priority: dto.priority,
      batchImportId: dto.batchImportId,
      actor,
    });

    return {
      document: result.document,
      warnings: result.validation.warnings,
      detectedKind: result.validation.detectedKind,
      antivirus: result.validation.antivirus,
    };
  }

  @Post('uploads/batch')
  @ApiMessage('Arquivos enviados com sucesso.')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Envia vários documentos no mesmo lote. Arquivos inválidos são registrados sem interromper os demais.',
  })
  @UseInterceptors(FilesInterceptor('files', 200))
  async uploadBatch(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: UploadIntakeDocumentDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(
      actor,
      dto.companyId,
      'document_intake.batch_upload',
    );
    return this.intake.receiveBatch({
      organizationId: dto.organizationId,
      companyId: dto.companyId,
      files: files ?? [],
      documentType: dto.documentType,
      priority: dto.priority,
      actor,
    });
  }

  @Post('capture')
  @ApiMessage('Documento capturado com sucesso.')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Recebe a imagem capturada pela câmera. O tratamento da imagem acontece no dispositivo.',
  })
  @UseInterceptors(FileInterceptor('file'))
  capture(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadIntakeDocumentDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, dto.companyId, 'document_intake.capture');
    return this.intake.receiveUpload({
      organizationId: dto.organizationId,
      companyId: dto.companyId,
      file,
      sourceChannel: 'CAMERA_CAPTURE',
      documentType: dto.documentType,
      notes: dto.notes,
      priority: dto.priority,
      actor,
    });
  }

  @Post('manual')
  @ApiMessage('Documento registrado com sucesso.')
  @ApiOperation({ summary: 'Registra um documento por digitação manual.' })
  manualEntry(@Body() dto: ManualEntryDto, @CurrentUser() actor: RequestUser) {
    assertCompanyPermission(
      actor,
      dto.companyId,
      'document_intake.manual_entry',
    );
    return this.intake.createManualEntry(dto, actor);
  }

  // ── Caixa de entrada (seção 68) ───────────────────────────────────────────

  @Get('documents')
  @ApiOperation({
    summary: 'Lista os documentos recebidos, com filtros e paginação.',
  })
  findAll(
    @Query('organizationId') organizationId: string,
    @Query() query: IntakeDocumentQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(actor, organizationId, 'document_intake.view');
    return this.intake.findAll(organizationId, query, actor);
  }

  @Get('documents/:id')
  @ApiOperation({
    summary: 'Detalhe do documento, com campos extraídos e pendências.',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertDocumentPermission(id, actor, 'document_intake.view');
    return this.intake.findOne(id, actor);
  }

  @Get('documents/:id/access-url')
  @ApiOperation({
    summary:
      'URL assinada e temporária para visualizar o documento. O acesso é registrado na auditoria.',
  })
  async accessUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('intent') intent: 'VIEW' | 'DOWNLOAD' | undefined,
    @CurrentUser() actor: RequestUser,
  ) {
    const permission =
      intent === 'DOWNLOAD'
        ? 'document_intake.download'
        : 'document_intake.view';
    await this.assertDocumentPermission(id, actor, permission);
    return this.intake.createAccessUrl(id, actor, intent ?? 'VIEW');
  }

  @Patch('documents/:id')
  @ApiMessage('Documento atualizado com sucesso.')
  @ApiOperation({ summary: 'Edita os dados do documento.' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIntakeDocumentDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertDocumentPermission(id, actor, 'document_intake.update');
    return this.intake.update(id, dto, actor);
  }

  @Delete('documents/:id')
  @ApiMessage('Documento excluído com sucesso.')
  @ApiOperation({
    summary:
      'Exclusão lógica, permitida apenas para documentos que ainda não entraram no fluxo.',
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertDocumentPermission(id, actor, 'document_intake.delete');
    return this.intake.remove(id, actor);
  }

  // ── Processamento (seção 69) ──────────────────────────────────────────────

  @Post('documents/:id/process')
  @ApiMessage('Documento enviado para processamento.')
  @ApiOperation({ summary: 'Inicia o pipeline de processamento do documento.' })
  async process(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertDocumentPermission(id, actor, 'document_intake.reprocess');
    return this.pipeline.startPipeline(id);
  }

  @Post('documents/:id/reprocess')
  @ApiMessage('Documento reprocessado com sucesso.')
  @ApiOperation({
    summary:
      'Reprocessa o documento do início, preservando as correções manuais.',
  })
  async reprocess(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertDocumentPermission(id, actor, 'document_intake.reprocess');
    return this.pipeline.reprocess(id);
  }

  @Post('documents/:id/cancel-processing')
  @ApiMessage('Processamento cancelado.')
  @ApiOperation({ summary: 'Cancela os jobs pendentes do documento.' })
  async cancelProcessing(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertDocumentPermission(id, actor, 'document_intake.reprocess');
    return this.pipeline.cancelPendingJobs(id, dto.reason);
  }

  @Get('documents/:id/processing-jobs')
  @ApiOperation({
    summary: 'Jobs de processamento do documento, com tentativas e erros.',
  })
  async processingJobs(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertDocumentPermission(id, actor, 'document_intake.view');
    return this.pipeline.findJobs(id);
  }

  // ── Extração (seção 71) ───────────────────────────────────────────────────

  @Get('documents/:id/extracted-fields')
  @ApiOperation({ summary: 'Campos extraídos, com confiança e procedência.' })
  async extractedFields(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertDocumentPermission(id, actor, 'document_intake.view');
    return this.intake.findExtractedFields(id, actor);
  }

  @Patch('documents/:id/extracted-fields/:fieldId')
  @ApiMessage('Campo atualizado com sucesso.')
  @ApiOperation({
    summary:
      'Corrige um campo extraído. A correção manual passa a ter prioridade sobre o reprocessamento.',
  })
  async updateExtractedField(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
    @Body() dto: { normalizedValue: string; originalValue?: string },
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertDocumentPermission(id, actor, 'document_intake.update');
    return this.intake.updateExtractedField(id, fieldId, dto, actor);
  }

  @Post('documents/:id/extract')
  @ApiMessage('Dados extraídos com sucesso.')
  @ApiOperation({ summary: 'Reexecuta apenas a extração de dados.' })
  async extract(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertDocumentPermission(id, actor, 'document_intake.reprocess');
    return this.intake.extractDocument(id);
  }

  @Post('documents/:id/classify')
  @ApiMessage('Classificação aplicada com sucesso.')
  @ApiOperation({ summary: 'Reexecuta a classificação do tipo do documento.' })
  async classify(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertDocumentPermission(id, actor, 'document_intake.classify');
    return this.intake.classifyDocument(id);
  }

  @Post('documents/:id/identify-parties')
  @ApiMessage('Identificação executada com sucesso.')
  @ApiOperation({
    summary: 'Reexecuta a identificação de empresa, fornecedor e cliente.',
  })
  async identifyParties(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertDocumentPermission(id, actor, 'document_intake.classify');
    return this.intake.identifyParties(id);
  }

  // ── Revisão (seção 70) ────────────────────────────────────────────────────

  @Post('documents/:id/review')
  @ApiMessage('Revisão salva com sucesso.')
  @ApiOperation({ summary: 'Salva a revisão sem encaminhar.' })
  async review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDocumentDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertDocumentPermission(id, actor, 'document_intake.review');
    return this.intake.review(id, dto, actor);
  }

  @Post('documents/:id/forward')
  @ApiMessage('Documento encaminhado para processamento.')
  @ApiOperation({
    summary:
      'Encaminha o documento. Nenhuma obrigação financeira é criada nesta etapa: o documento fica pronto para o módulo financeiro.',
  })
  async forward(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ForwardDocumentDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertDocumentPermission(id, actor, 'document_intake.forward');
    return this.intake.forward(id, dto, actor);
  }

  @Post('documents/:id/reject')
  @ApiMessage('Documento rejeitado com sucesso.')
  @ApiOperation({ summary: 'Rejeita o documento, preservando o histórico.' })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectDocumentDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertDocumentPermission(id, actor, 'document_intake.reject');
    return this.intake.reject(id, dto, actor);
  }

  @Post('documents/:id/reopen')
  @ApiMessage('Documento reaberto com sucesso.')
  @ApiOperation({ summary: 'Reabre um documento rejeitado ou arquivado.' })
  async reopen(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertDocumentPermission(id, actor, 'document_intake.reopen');
    return this.intake.reopen(id, dto.reason, actor);
  }

  @Post('documents/:id/archive')
  @ApiMessage('Documento arquivado com sucesso.')
  @ApiOperation({ summary: 'Arquiva o documento.' })
  async archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { reason?: string },
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertDocumentPermission(id, actor, 'document_intake.archive');
    return this.intake.archive(id, dto.reason, actor);
  }

  @Post('documents/:id/assign')
  @ApiMessage('Responsável atribuído com sucesso.')
  @ApiOperation({ summary: 'Atribui o documento a um usuário ou equipe.' })
  async assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignDocumentDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertDocumentPermission(id, actor, 'document_intake.assign');
    return this.intake.assign(id, dto, actor);
  }

  @Post('documents/:id/change-company')
  @ApiMessage('Empresa alterada com sucesso.')
  @ApiOperation({
    summary:
      'Altera a empresa do documento. Exige permissão nas duas empresas: a de origem e a de destino.',
  })
  async changeCompany(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeCompanyDto,
    @CurrentUser() actor: RequestUser,
  ) {
    // Mover um documento entre empresas move a despesa de um CNPJ para outro: quem faz
    // isso precisa ter acesso aos dois lados.
    await this.assertDocumentPermission(
      id,
      actor,
      'document_intake.change_company',
    );
    assertCompanyPermission(
      actor,
      dto.companyId,
      'document_intake.change_company',
    );
    return this.intake.changeCompany(id, dto.companyId, dto.reason, actor);
  }

  // ── Duplicidade (seção 73) ────────────────────────────────────────────────

  @Get('documents/:id/duplicates')
  @ApiOperation({ summary: 'Suspeitas de duplicidade do documento.' })
  async findDuplicates(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertDocumentPermission(id, actor, 'document_intake.view');
    return this.duplicates.findMatches(id);
  }

  @Post('documents/:id/duplicates/check')
  @ApiMessage('Verificação de duplicidade concluída.')
  @ApiOperation({ summary: 'Reexecuta a detecção de duplicidade.' })
  async checkDuplicates(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertDocumentPermission(
      id,
      actor,
      'document_intake.manage_duplicates',
    );
    return this.duplicates.check(id);
  }

  @Get('documents/:id/duplicates/:matchId/compare')
  @ApiOperation({
    summary: 'Comparação campo a campo com o documento suspeito.',
  })
  async compareDuplicate(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertDocumentPermission(id, actor, 'document_intake.view');
    return this.duplicates.compare(id, matchId);
  }

  @Post('documents/:id/duplicates/:matchId/confirm')
  @ApiMessage('Duplicidade confirmada.')
  @ApiOperation({
    summary:
      'Confirma a duplicidade: o documento não segue para processamento.',
  })
  async confirmDuplicate(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Body() dto: DuplicateDecisionDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertDocumentPermission(
      id,
      actor,
      'document_intake.manage_duplicates',
    );
    return this.duplicates.confirm(id, matchId, dto.reason, actor);
  }

  @Post('documents/:id/duplicates/:matchId/dismiss')
  @ApiMessage('Suspeita liberada.')
  @ApiOperation({
    summary:
      'Libera a suspeita. Semelhança alta exige justificativa e a permissão de exceção.',
  })
  async dismissDuplicate(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Body() dto: DuplicateDecisionDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertDocumentPermission(
      id,
      actor,
      'document_intake.override_duplicate',
    );
    return this.duplicates.dismiss(id, matchId, dto.reason, actor);
  }

  @Post('documents/:id/duplicates/:matchId/replace')
  @ApiMessage('Documento anterior substituído.')
  @ApiOperation({
    summary: 'Substitui o documento anterior, arquivando-o com histórico.',
  })
  async replaceDuplicate(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Body() dto: DuplicateDecisionDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertDocumentPermission(
      id,
      actor,
      'document_intake.manage_duplicates',
    );
    return this.duplicates.replace(id, matchId, dto.reason, actor);
  }

  // ── Pendências (seção 74) ─────────────────────────────────────────────────

  @Get('documents/:id/issues')
  @ApiOperation({ summary: 'Pendências do documento.' })
  async findIssues(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertDocumentPermission(id, actor, 'document_intake.view');
    return this.issues.findAll(id);
  }

  @Post('documents/:id/issues')
  @ApiMessage('Pendência registrada com sucesso.')
  @ApiOperation({ summary: 'Registra uma pendência manualmente.' })
  async createIssue(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateIssueDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertDocumentPermission(id, actor, 'document_intake.review');
    return this.issues.raise({ documentId: id, ...dto });
  }

  @Patch('documents/:id/issues/:issueId')
  @ApiMessage('Pendência atualizada com sucesso.')
  @ApiOperation({
    summary: 'Altera severidade, descrição ou responsável da pendência.',
  })
  async updateIssue(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('issueId', ParseUUIDPipe) issueId: string,
    @Body() dto: UpdateIssueDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertDocumentPermission(id, actor, 'document_intake.review');
    return this.issues.update(id, issueId, dto);
  }

  @Post('documents/:id/issues/:issueId/resolve')
  @ApiMessage('Pendência resolvida com sucesso.')
  @ApiOperation({
    summary: 'Resolve a pendência, registrando como foi resolvida.',
  })
  async resolveIssue(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('issueId', ParseUUIDPipe) issueId: string,
    @Body() dto: ResolveIssueDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertDocumentPermission(id, actor, 'document_intake.review');
    return this.issues.resolve(id, issueId, dto.resolution, actor);
  }

  // ── Divisão e relações (seções 40, 41 e 75) ───────────────────────────────

  @Post('documents/:id/split')
  @ApiMessage('Documento dividido com sucesso.')
  @ApiOperation({
    summary:
      'Divide o documento em parcelas. O arquivo original não é alterado; as parcelas são registros derivados.',
  })
  async split(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SplitDocumentDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertDocumentPermission(id, actor, 'document_intake.update');
    return this.intake.split(id, dto, actor);
  }

  @Get('documents/:id/relations')
  @ApiOperation({ summary: 'Documentos relacionados.' })
  async findRelations(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertDocumentPermission(id, actor, 'document_intake.view');
    return this.intake.findRelations(id);
  }

  @Post('documents/:id/relations')
  @ApiMessage('Documentos relacionados com sucesso.')
  @ApiOperation({
    summary:
      'Relaciona dois documentos logicamente. Os arquivos não são fundidos.',
  })
  async relate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RelateDocumentDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertDocumentPermission(id, actor, 'document_intake.update');
    return this.intake.relate(id, dto, actor);
  }

  @Delete('documents/:id/relations/:relationId')
  @ApiMessage('Relacionamento removido com sucesso.')
  @ApiOperation({ summary: 'Remove o relacionamento entre documentos.' })
  async removeRelation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('relationId', ParseUUIDPipe) relationId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertDocumentPermission(id, actor, 'document_intake.update');
    return this.intake.removeRelation(id, relationId, actor);
  }

  // ── Boleto (seção 72) ─────────────────────────────────────────────────────

  @Post('boleto/validate')
  @ApiOperation({
    summary:
      'Valida uma linha digitável ou código de barras e devolve os dados embutidos. Não efetua pagamento.',
  })
  validateBoleto(@Body() dto: ValidateBoletoDto) {
    return this.boleto.validate(dto.code);
  }

  @Post('boleto/read-barcode')
  @ApiOperation({ summary: 'Interpreta um código de barras lido pela câmera.' })
  readBarcode(@Body() dto: ValidateBoletoDto) {
    return this.boleto.validate(dto.code);
  }

  @Post('boleto/convert-digitable-line')
  @ApiOperation({
    summary:
      'Converte entre linha digitável e código de barras, nos dois sentidos.',
  })
  convertDigitableLine(@Body() dto: ValidateBoletoDto) {
    const digits = this.boleto.normalize(dto.code);

    return {
      input: digits,
      barcode:
        digits.length === 47
          ? this.boleto.digitableLineToBarcode(digits)
          : digits,
      digitableLine:
        digits.length === 44
          ? this.boleto.barcodeToDigitableLine(digits)
          : digits,
    };
  }

  @Post('boleto/compare')
  @ApiOperation({
    summary: 'Compara o boleto lido com os valores informados pelo usuário.',
  })
  compareBoleto(@Body() dto: CompareBoletoDto) {
    const parsed = this.boleto.validate(dto.code);

    return {
      parsed,
      comparison: this.boleto.compare(
        {
          amount: parsed.amount,
          dueDate: parsed.dueDate,
          digitableLine: parsed.digitableLine,
        },
        {
          amount: dto.amount ?? null,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        },
      ),
    };
  }

  // ── Ações em lote (seção 76) ──────────────────────────────────────────────

  @Post('documents/batch/assign')
  @ApiMessage('Responsável atribuído aos documentos selecionados.')
  @ApiOperation({ summary: 'Atribui responsável a vários documentos.' })
  batchAssign(@Body() dto: BatchAssignDto, @CurrentUser() actor: RequestUser) {
    return this.intake.runBatch(
      dto.documentIds,
      actor,
      'document_intake.assign',
      (id) =>
        this.intake.assign(
          id,
          {
            assignedUserId: dto.assignedUserId,
            assignedTeamId: dto.assignedTeamId,
            reason: dto.reason,
          },
          actor,
        ),
    );
  }

  @Post('documents/batch/classify')
  @ApiMessage('Classificação aplicada aos documentos selecionados.')
  @ApiOperation({
    summary:
      'Aplica categoria, centro de custo, projeto ou prioridade em lote.',
  })
  batchClassify(
    @Body() dto: BatchClassifyDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.intake.runBatch(
      dto.documentIds,
      actor,
      'document_intake.classify',
      (id) =>
        this.intake.update(
          id,
          {
            categoryId: dto.categoryId,
            costCenterId: dto.costCenterId,
            projectId: dto.projectId,
            priority: dto.priority,
          },
          actor,
        ),
    );
  }

  @Post('documents/batch/forward')
  @ApiMessage('Documentos encaminhados.')
  @ApiOperation({
    summary:
      'Encaminha vários documentos. Cada um passa pelas mesmas validações; os que falharem são listados.',
  })
  batchForward(@Body() dto: BatchActionDto, @CurrentUser() actor: RequestUser) {
    return this.intake.runBatch(
      dto.documentIds,
      actor,
      'document_intake.forward',
      (id) => this.intake.forward(id, { notes: dto.reason }, actor),
    );
  }

  @Post('documents/batch/reprocess')
  @ApiMessage('Documentos reprocessados.')
  @ApiOperation({ summary: 'Reprocessa vários documentos.' })
  batchReprocess(
    @Body() dto: BatchActionDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.intake.runBatch(
      dto.documentIds,
      actor,
      'document_intake.reprocess',
      (id) => this.pipeline.reprocess(id),
    );
  }

  @Post('documents/batch/archive')
  @ApiMessage('Documentos arquivados.')
  @ApiOperation({ summary: 'Arquiva vários documentos.' })
  batchArchive(@Body() dto: BatchActionDto, @CurrentUser() actor: RequestUser) {
    return this.intake.runBatch(
      dto.documentIds,
      actor,
      'document_intake.archive',
      (id) => this.intake.archive(id, dto.reason, actor),
    );
  }

  @Post('documents/batch/reject')
  @ApiMessage('Documentos rejeitados.')
  @ApiOperation({ summary: 'Rejeita vários documentos com o mesmo motivo.' })
  batchReject(@Body() dto: BatchRejectDto, @CurrentUser() actor: RequestUser) {
    return this.intake.runBatch(
      dto.documentIds,
      actor,
      'document_intake.reject',
      (id) =>
        this.intake.reject(
          id,
          { rejectionReason: dto.rejectionReason, notes: dto.reason },
          actor,
        ),
    );
  }
}
