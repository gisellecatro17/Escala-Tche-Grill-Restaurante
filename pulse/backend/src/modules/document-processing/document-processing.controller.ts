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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { paginate } from '../../common/dto/pagination-query.dto';
import type { RequestUser } from '../../common/types/authenticated-request';
import {
  assertCompanyPermission,
  assertOrganizationPermission,
} from '../../common/utils/access-control.util';
import { DocumentIntakeService } from '../document-intake/document-intake.service';
import { DocumentProcessingService } from './document-processing.service';
import { FinancialEntriesService } from './financial-entries.service';
import {
  FinancialEntryQueryDto,
  ManualWithholdingDto,
  ProcessDocumentDto,
  ProcessingQueueQueryDto,
  ReasonDto,
  UpdateFinancialEntryDto,
  UpdateInstallmentDto,
  UpdateProcessingSettingsDto,
  WithholdingDecisionDto,
} from './dto/document-processing.dto';

/**
 * Processamento de documentos e lançamentos financeiros.
 *
 * A permissão é sempre validada contra a empresa do **registro**, lida do banco — nunca
 * contra o que veio no corpo da requisição.
 *
 * Nenhuma rota aqui autoriza, agenda, remete ou executa pagamento, e nenhuma dá baixa. O
 * lançamento vai até `OPEN` e para.
 */
@ApiTags('Processamento de Documentos')
@ApiBearerAuth()
@Controller('document-processing')
export class DocumentProcessingController {
  constructor(
    private readonly processing: DocumentProcessingService,
    private readonly entries: FinancialEntriesService,
    private readonly intake: DocumentIntakeService,
  ) {}

  /**
   * Valida a permissão contra a empresa do **documento**.
   *
   * Documento sem empresa não chega aqui — a entrada não deixa encaminhá-lo —, mas o tipo
   * permite nulo, e cair para a organização é mais seguro que assumir uma empresa.
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

  private async assertEntryPermission(
    id: string,
    actor: RequestUser,
    permission: string,
  ) {
    const scope = await this.entries.scopeOf(id);
    assertCompanyPermission(actor, scope.companyId, permission);
    return scope;
  }

  // ── Parâmetros ────────────────────────────────────────────────────────────

  @Get('settings')
  @ApiOperation({ summary: 'Parâmetros do processamento da empresa.' })
  async settings(
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, companyId, 'document_processing.view');
    return this.processing.findSettings(organizationId, companyId);
  }

  @Patch('settings')
  @ApiMessage('Parâmetros atualizados com sucesso.')
  @ApiOperation({ summary: 'Altera os parâmetros do processamento.' })
  async updateSettings(
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: UpdateProcessingSettingsDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(
      actor,
      companyId,
      'document_processing.manage_settings',
    );
    return this.processing.updateSettings(
      organizationId,
      companyId,
      dto,
      actor,
    );
  }

  // ── Fila e processamento ──────────────────────────────────────────────────

  @Get('queue')
  @ApiOperation({
    summary: 'Documentos encaminhados aguardando virar lançamento.',
  })
  async queue(
    @Query() query: ProcessingQueueQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    if (query.companyId) {
      assertCompanyPermission(
        actor,
        query.companyId,
        'document_processing.view',
      );
    } else {
      assertOrganizationPermission(
        actor,
        query.organizationId,
        'document_processing.view',
      );
    }

    const { items, total } = await this.processing.findQueue(
      query.organizationId,
      query.companyId,
      query.page,
      query.perPage,
    );

    return paginate(items, total, query.page, query.perPage);
  }

  @Get('documents/:id/preview')
  @ApiOperation({
    summary:
      'Mostra a classificação, as parcelas, o rateio e as retenções que o processamento aplicaria. Não grava nada.',
  })
  async preview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertDocumentPermission(id, actor, 'document_processing.view');
    return this.processing.preview(id);
  }

  @Post('documents/:id/process')
  @ApiMessage('Documento processado e lançamento gerado com sucesso.')
  @ApiOperation({
    summary:
      'Gera o lançamento financeiro do documento encaminhado. O título nasce em aberto ou como rascunho — nenhum pagamento é autorizado.',
  })
  async process(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProcessDocumentDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertDocumentPermission(
      id,
      actor,
      'document_processing.process',
    );
    return this.processing.process(id, dto, actor);
  }

  // ── Lançamentos ───────────────────────────────────────────────────────────

  @Get('entries')
  @ApiOperation({ summary: 'Contas a pagar e a receber.' })
  async findAll(
    @Query() query: FinancialEntryQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    if (query.companyId) {
      assertCompanyPermission(
        actor,
        query.companyId,
        'document_processing.view',
      );
    } else if (query.organizationId) {
      assertOrganizationPermission(
        actor,
        query.organizationId,
        'document_processing.view',
      );
    }

    return this.entries.findAll(query, actor);
  }

  @Get('entries/summary')
  @ApiOperation({ summary: 'Totais em aberto a pagar e a receber.' })
  async summary(
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('companyId') companyId: string | undefined,
    @CurrentUser() actor: RequestUser,
  ) {
    if (companyId) {
      assertCompanyPermission(actor, companyId, 'document_processing.view');
    } else {
      assertOrganizationPermission(
        actor,
        organizationId,
        'document_processing.view',
      );
    }

    return this.entries.findSummary(organizationId, companyId);
  }

  @Get('entries/:id')
  @ApiOperation({ summary: 'Detalhe do lançamento.' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertEntryPermission(id, actor, 'document_processing.view');
    return this.entries.findOne(id, actor);
  }

  @Patch('entries/:id')
  @ApiMessage('Lançamento atualizado com sucesso.')
  @ApiOperation({
    summary: 'Edita o lançamento enquanto ele não está em aberto.',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFinancialEntryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertEntryPermission(id, actor, 'document_processing.update');
    return this.entries.update(id, dto, actor);
  }

  @Post('entries/:id/approve')
  @ApiMessage('Lançamento conferido com sucesso.')
  @ApiOperation({
    summary:
      'Confere o lançamento que ficou acima do limite. Confere os dados, não autoriza pagamento.',
  })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertEntryPermission(id, actor, 'document_processing.approve');
    return this.entries.approve(id, actor);
  }

  @Post('entries/:id/open')
  @ApiMessage('Lançamento aberto com sucesso.')
  @ApiOperation({
    summary: 'Abre o título: daqui em diante ele é a obrigação.',
  })
  async open(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertEntryPermission(id, actor, 'document_processing.open');
    return this.entries.open(id, actor);
  }

  @Post('entries/:id/cancel')
  @ApiMessage('Lançamento cancelado com sucesso.')
  @ApiOperation({
    summary:
      'Cancela o lançamento com motivo e devolve o documento à fila do processamento.',
  })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertEntryPermission(id, actor, 'document_processing.cancel');
    return this.entries.cancel(id, dto, actor);
  }

  // ── Parcelas ──────────────────────────────────────────────────────────────

  @Patch('entries/:id/installments/:installmentId')
  @ApiMessage('Parcela atualizada com sucesso.')
  @ApiOperation({ summary: 'Ajusta vencimento ou valor de uma parcela.' })
  async updateInstallment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('installmentId', ParseUUIDPipe) installmentId: string,
    @Body() dto: UpdateInstallmentDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertEntryPermission(id, actor, 'document_processing.update');
    return this.entries.updateInstallment(id, installmentId, dto, actor);
  }

  // ── Retenções ─────────────────────────────────────────────────────────────

  @Post('entries/:id/withholdings')
  @ApiMessage('Retenção incluída com sucesso.')
  @ApiOperation({
    summary:
      'Inclui uma retenção que o cadastro não previa. Nasce como sugestão.',
  })
  async addWithholding(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ManualWithholdingDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertEntryPermission(
      id,
      actor,
      'document_processing.manage_withholdings',
    );
    return this.entries.addWithholding(id, dto, actor);
  }

  @Post('entries/:id/withholdings/:withholdingId/confirm')
  @ApiMessage('Retenção confirmada com sucesso.')
  @ApiOperation({
    summary:
      'Confirma a retenção. É a confirmação que desconta o valor líquido.',
  })
  async confirmWithholding(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('withholdingId', ParseUUIDPipe) withholdingId: string,
    @Body() dto: WithholdingDecisionDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertEntryPermission(
      id,
      actor,
      'document_processing.manage_withholdings',
    );
    return this.entries.confirmWithholding(id, withholdingId, dto, actor);
  }

  @Post('entries/:id/withholdings/:withholdingId/dismiss')
  @ApiMessage('Retenção descartada com sucesso.')
  @ApiOperation({ summary: 'Descarta a retenção sugerida, com motivo.' })
  async dismissWithholding(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('withholdingId', ParseUUIDPipe) withholdingId: string,
    @Body() dto: ReasonDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertEntryPermission(
      id,
      actor,
      'document_processing.manage_withholdings',
    );
    return this.entries.dismissWithholding(id, withholdingId, dto, actor);
  }
}
