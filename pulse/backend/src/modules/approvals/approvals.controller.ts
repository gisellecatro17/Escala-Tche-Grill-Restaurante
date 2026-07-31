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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ApiMessage } from '../../common/decorators/api-message.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/types/authenticated-request';
import {
  assertCompanyPermission,
  assertOrganizationPermission,
} from '../../common/utils/access-control.util';
import { ApprovalDashboardService } from './approval-dashboard.service';
import { ApprovalFlowsService } from './approval-flows.service';
import { ApprovalRequestsService } from './approval-requests.service';
import {
  ApprovalQueryDto,
  BatchApprovalDto,
  CommentDto,
  CreateApprovalFlowDto,
  CreateDelegationDto,
  DecisionDto,
  DelegateRequestDto,
  DelegationQueryDto,
  ForwardRequestDto,
  PriorityDto,
  ReasonDto,
  UpdateApprovalFlowDto,
  UpdateApprovalSettingsDto,
} from './dto/approvals.dto';

/**
 * Autorizações: fluxos, alçadas, aprovações, delegações e histórico.
 *
 * A permissão é sempre validada contra a empresa do **registro**, lida do banco.
 *
 * Aprovar aqui significa "esta despesa está autorizada a virar obrigação". Nenhuma rota
 * autoriza saída de dinheiro no banco, agenda pagamento ou executa remessa.
 */
@ApiTags('Autorizações')
@ApiBearerAuth()
@Controller()
export class ApprovalsController {
  constructor(
    private readonly requests: ApprovalRequestsService,
    private readonly flows: ApprovalFlowsService,
    private readonly dashboard: ApprovalDashboardService,
  ) {}

  private async assertRequestPermission(
    id: string,
    actor: RequestUser,
    permission: string,
  ) {
    const scope = await this.requests.scopeOf(id);
    assertCompanyPermission(actor, scope.companyId, permission);
    return scope;
  }

  private async assertFlowPermission(
    id: string,
    actor: RequestUser,
    permission: string,
  ) {
    const scope = await this.flows.scopeOf(id);
    assertCompanyPermission(actor, scope.companyId, permission);
    return scope;
  }

  // ── Dashboard e parâmetros ────────────────────────────────────────────────

  @Get('approvals/dashboard')
  @ApiOperation({ summary: 'Indicadores das autorizações.' })
  async dashboardData(
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('companyId') companyId: string | undefined,
    @CurrentUser() actor: RequestUser,
  ) {
    if (companyId) {
      assertCompanyPermission(actor, companyId, 'approvals.view');
    } else {
      assertOrganizationPermission(actor, organizationId, 'approvals.view');
    }

    return this.dashboard.build(organizationId, companyId);
  }

  @Get('approvals/settings')
  @ApiOperation({ summary: 'Parâmetros das autorizações da empresa.' })
  async settings(
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, companyId, 'approvals.view');
    return this.requests.findSettings(organizationId, companyId);
  }

  @Patch('approvals/settings')
  @ApiMessage('Parâmetros atualizados com sucesso.')
  @ApiOperation({ summary: 'Altera os parâmetros das autorizações.' })
  async updateSettings(
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: UpdateApprovalSettingsDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, companyId, 'approvals.manage');
    return this.requests.updateSettings(organizationId, companyId, dto, actor);
  }

  // ── Solicitações ──────────────────────────────────────────────────────────

  @Get('approvals')
  @ApiOperation({ summary: 'Fila de autorizações.' })
  async findAll(
    @Query() query: ApprovalQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    if (query.companyId) {
      assertCompanyPermission(actor, query.companyId, 'approvals.view');
    } else if (query.organizationId) {
      assertOrganizationPermission(
        actor,
        query.organizationId,
        'approvals.view',
      );
    }

    return this.requests.findAll(query);
  }

  @Get('approvals/:id')
  @ApiOperation({
    summary: 'Detalhe da solicitação, com etapas, comentários e histórico.',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertRequestPermission(id, actor, 'approvals.view');
    return this.requests.findOne(id);
  }

  @Post('approvals/:id/approve')
  @ApiMessage('Etapa aprovada com sucesso.')
  @ApiOperation({
    summary:
      'Aprova a etapa atual. Autoriza a despesa a virar obrigação — não autoriza pagamento.',
  })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecisionDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertRequestPermission(id, actor, 'approvals.approve');
    return this.requests.approve(id, dto, actor);
  }

  @Post('approvals/:id/reject')
  @ApiMessage('Solicitação reprovada.')
  @ApiOperation({ summary: 'Reprova a solicitação, com motivo obrigatório.' })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertRequestPermission(id, actor, 'approvals.reject');
    return this.requests.reject(id, dto, actor);
  }

  @Post('approvals/:id/request-changes')
  @ApiMessage('Ajuste solicitado.')
  @ApiOperation({
    summary: 'Devolve a solicitação pedindo ajuste, sem reprovar.',
  })
  async requestChanges(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertRequestPermission(id, actor, 'approvals.approve');
    return this.requests.requestChanges(id, dto, actor);
  }

  @Post('approvals/:id/request-documents')
  @ApiMessage('Documentos solicitados.')
  @ApiOperation({ summary: 'Pede documentos complementares, sem reprovar.' })
  async requestDocuments(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertRequestPermission(id, actor, 'approvals.approve');
    return this.requests.requestChanges(id, dto, actor, { documents: true });
  }

  @Post('approvals/:id/resume')
  @ApiMessage('Solicitação retomada.')
  @ApiOperation({
    summary: 'Retoma a solicitação devolvida, prestadas as informações.',
  })
  async resume(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CommentDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertRequestPermission(id, actor, 'approvals.view');
    return this.requests.resume(id, dto, actor);
  }

  @Post('approvals/:id/comment')
  @ApiMessage('Comentário registrado.')
  @ApiOperation({ summary: 'Adiciona um comentário à solicitação.' })
  async comment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CommentDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertRequestPermission(id, actor, 'approvals.view');
    return this.requests.comment(id, dto, actor);
  }

  @Get('approvals/:id/comments')
  @ApiOperation({ summary: 'Comentários da solicitação.' })
  async comments(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertRequestPermission(id, actor, 'approvals.view');
    return this.requests.findComments(id);
  }

  @Get('approvals/:id/history')
  @ApiOperation({ summary: 'Histórico completo da solicitação.' })
  async history(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertRequestPermission(id, actor, 'approvals.audit');
    return this.requests.findHistory(id);
  }

  @Post('approvals/:id/delegate')
  @ApiMessage('Aprovação delegada.')
  @ApiOperation({
    summary: 'Delega a etapa atual a outra pessoa com permissão de aprovar.',
  })
  async delegate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DelegateRequestDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertRequestPermission(id, actor, 'approvals.delegate');
    return this.requests.delegate(id, dto, actor);
  }

  @Post('approvals/:id/forward')
  @ApiMessage('Solicitação encaminhada.')
  @ApiOperation({
    summary: 'Encaminha para outra pessoa opinar, sem transferir a decisão.',
  })
  async forward(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ForwardRequestDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertRequestPermission(id, actor, 'approvals.view');
    return this.requests.forward(id, dto, actor);
  }

  @Post('approvals/:id/priority')
  @ApiMessage('Prioridade alterada.')
  @ApiOperation({ summary: 'Altera a urgência da solicitação.' })
  async priority(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PriorityDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertRequestPermission(id, actor, 'approvals.manage');
    return this.requests.changePriority(id, dto, actor);
  }

  @Post('approvals/:id/cancel')
  @ApiMessage('Fluxo cancelado.')
  @ApiOperation({ summary: 'Cancela a solicitação com motivo.' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertRequestPermission(id, actor, 'approvals.manage');
    return this.requests.cancel(id, dto, actor);
  }

  @Post('approvals/:id/restart')
  @ApiMessage('Fluxo reiniciado.')
  @ApiOperation({
    summary:
      'Encerra a solicitação e abre outra do zero. A anterior fica no histórico.',
  })
  async restart(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertRequestPermission(id, actor, 'approvals.manage');
    return this.requests.restart(id, dto, actor);
  }

  @Post('approvals/batch')
  @ApiMessage('Ação em lote concluída.')
  @ApiOperation({
    summary:
      'Aplica a mesma ação a várias solicitações. Cada uma é tratada isoladamente e as falhas são devolvidas.',
  })
  async batch(
    @Body() dto: BatchApprovalDto,
    @CurrentUser() actor: RequestUser,
  ) {
    // A permissão é conferida solicitação a solicitação dentro de cada ação: um lote pode
    // atravessar empresas, e validar só a primeira deixaria as demais sem verificação.
    for (const id of dto.requestIds) {
      const permission =
        dto.action === 'REJECT'
          ? 'approvals.reject'
          : dto.action === 'DELEGATE'
            ? 'approvals.delegate'
            : dto.action === 'PRIORITY'
              ? 'approvals.manage'
              : 'approvals.approve';

      await this.assertRequestPermission(id, actor, permission);
    }

    return this.requests.runBatch(dto, actor);
  }

  @Post('approvals/expire-overdue')
  @ApiMessage('Solicitações vencidas atualizadas.')
  @ApiOperation({
    summary: 'Marca como expiradas as solicitações que passaram do prazo.',
  })
  async expire(
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, companyId, 'approvals.manage');
    return this.requests.expireOverdue(companyId);
  }

  // ── Fluxos ────────────────────────────────────────────────────────────────

  @Get('approval-flows')
  @ApiOperation({ summary: 'Fluxos de aprovação da empresa.' })
  async flowList(
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @Query('includeInactive') includeInactive: string | undefined,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, companyId, 'approvals.view');
    return this.flows.findAll(companyId, includeInactive === 'true');
  }

  @Get('approval-flows/:id')
  @ApiOperation({ summary: 'Detalhe do fluxo, com as etapas e as alçadas.' })
  async flowDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertFlowPermission(id, actor, 'approvals.view');
    return this.flows.findOne(id);
  }

  @Post('approval-flows')
  @ApiMessage('Fluxo criado com sucesso.')
  @ApiOperation({
    summary: 'Cria um fluxo de aprovação com suas etapas e alçadas.',
  })
  async createFlow(
    @Body() dto: CreateApprovalFlowDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, dto.companyId, 'approvals.manage');
    return this.flows.create(dto, actor);
  }

  @Patch('approval-flows/:id')
  @ApiMessage('Fluxo atualizado com sucesso.')
  @ApiOperation({
    summary:
      'Edita o fluxo. Solicitações em andamento não são afetadas — elas guardam cópias das etapas.',
  })
  async updateFlow(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApprovalFlowDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertFlowPermission(id, actor, 'approvals.manage');
    return this.flows.update(id, dto, actor);
  }

  @Delete('approval-flows/:id')
  @ApiMessage('Fluxo excluído com sucesso.')
  @ApiOperation({ summary: 'Exclui o fluxo logicamente.' })
  async removeFlow(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertFlowPermission(id, actor, 'approvals.manage');
    return this.flows.remove(id, actor);
  }

  // ── Delegações por período ────────────────────────────────────────────────

  @Get('approval-delegations')
  @ApiOperation({ summary: 'Delegações de aprovação da empresa.' })
  async delegations(
    @Query() query: DelegationQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, query.companyId, 'approvals.view');
    return this.flows.findDelegations(query);
  }

  @Post('approval-delegations')
  @ApiMessage('Delegação criada com sucesso.')
  @ApiOperation({
    summary:
      'Delega aprovações por período. Delegar não concede permissão: quem recebe já precisa poder aprovar.',
  })
  async createDelegation(
    @Body() dto: CreateDelegationDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, dto.companyId, 'approvals.delegate');
    return this.flows.createDelegation(dto, actor);
  }

  @Post('approval-delegations/:id/revoke')
  @ApiMessage('Delegação revogada.')
  @ApiOperation({ summary: 'Revoga a delegação antes do fim do período.' })
  async revokeDelegation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    const scope = await this.flows.delegationScopeOf(id);
    assertCompanyPermission(actor, scope.companyId, 'approvals.delegate');

    return this.flows.revokeDelegation(id, actor);
  }
}
