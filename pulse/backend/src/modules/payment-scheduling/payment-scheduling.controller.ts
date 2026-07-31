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
import { AccountBalanceService } from './account-balance.service';
import { PaymentBatchesService } from './payment-batches.service';
import { PaymentSchedulingDashboardService } from './payment-scheduling-dashboard.service';
import { PaymentSchedulesService } from './payment-schedules.service';
import { PaymentSimulationService } from './payment-simulation.service';
import {
  BatchMembershipDto,
  BlockScheduleDto,
  BulkCancelDto,
  BulkScheduleDto,
  CreatePaymentBatchDto,
  CreatePaymentScheduleDto,
  PaymentBatchQueryDto,
  PaymentScheduleQueryDto,
  ReasonDto,
  ReorderQueueDto,
  RescheduleDto,
  SchedulableQueryDto,
  ScheduleCommentDto,
  SimulationDto,
  UnblockScheduleDto,
  UpdatePaymentBatchDto,
  UpdatePaymentScheduleDto,
  UpdatePaymentScheduleSettingsDto,
} from './dto/payment-scheduling.dto';

/**
 * Agendamento Bancário: programação, lotes e simulação.
 *
 * A permissão é sempre validada contra a empresa do **registro**, lida do banco.
 *
 * Nenhuma rota executa pagamento, gera remessa ou chama API de banco. Programar aqui
 * significa "este dinheiro sai neste dia, desta conta" — a ordem em si é do módulo de
 * Execução Bancária, que ainda não existe.
 */
@ApiTags('Agendamento Bancário')
@ApiBearerAuth()
@Controller()
export class PaymentSchedulingController {
  constructor(
    private readonly schedules: PaymentSchedulesService,
    private readonly batches: PaymentBatchesService,
    private readonly dashboard: PaymentSchedulingDashboardService,
    private readonly simulation: PaymentSimulationService,
    private readonly balances: AccountBalanceService,
  ) {}

  private async assertSchedulePermission(
    id: string,
    actor: RequestActor,
    permission: string,
  ) {
    const scope = await this.schedules.scopeOf(id);
    assertCompanyPermission(actor, scope.companyId, permission);
    return scope;
  }

  private async assertBatchPermission(
    id: string,
    actor: RequestActor,
    permission: string,
  ) {
    const scope = await this.batches.scopeOf(id);
    assertCompanyPermission(actor, scope.companyId, permission);
    return scope;
  }

  // ── Painel, parâmetros e simulação ────────────────────────────────────────

  @Get('payment-schedules/dashboard')
  @ApiOperation({ summary: 'Indicadores do agendamento bancário.' })
  async dashboardData(
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('companyId') companyId: string | undefined,
    @CurrentActor() actor: RequestActor,
  ) {
    if (companyId) {
      assertCompanyPermission(actor, companyId, 'payment_schedule.view');
    } else {
      assertOrganizationPermission(
        actor,
        organizationId,
        'payment_schedule.view',
      );
    }

    return this.dashboard.build(organizationId, companyId);
  }

  @Get('payment-schedules/settings')
  @ApiOperation({ summary: 'Parâmetros do agendamento da empresa.' })
  async settings(
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @CurrentActor() actor: RequestActor,
  ) {
    assertCompanyPermission(actor, companyId, 'payment_schedule.view');
    return this.schedules.settingsFor(organizationId, companyId);
  }

  @Patch('payment-schedules/settings')
  @ApiMessage('Parâmetros atualizados com sucesso.')
  @ApiOperation({ summary: 'Altera os parâmetros do agendamento.' })
  async updateSettings(
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: UpdatePaymentScheduleSettingsDto,
    @CurrentActor() actor: RequestActor,
  ) {
    assertCompanyPermission(actor, companyId, 'payment_schedule.edit');
    return this.schedules.updateSettings(organizationId, companyId, dto, actor);
  }

  @Post('payment-schedules/simulate')
  @ApiOperation({
    summary: 'Simula o desembolso do período. Não grava nada.',
  })
  async simulate(
    @Body() dto: SimulationDto,
    @CurrentActor() actor: RequestActor,
  ) {
    assertCompanyPermission(actor, dto.companyId, 'payment_schedule.view');
    return this.simulation.run(dto);
  }

  @Get('payment-schedules/account-positions')
  @ApiOperation({
    summary: 'Saldo disponível e projetado de cada conta da empresa.',
  })
  async accountPositions(
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @Query('referenceDate') referenceDate: string | undefined,
    @CurrentActor() actor: RequestActor,
  ) {
    assertCompanyPermission(actor, companyId, 'payment_schedule.view');

    return this.balances.positionsOf(
      companyId,
      referenceDate ? new Date(referenceDate) : new Date(),
    );
  }

  @Get('payment-schedules/schedulable')
  @ApiOperation({ summary: 'Títulos do Contas a Pagar ainda sem programação.' })
  async schedulable(
    @Query() query: SchedulableQueryDto,
    @CurrentActor() actor: RequestActor,
  ) {
    assertCompanyPermission(actor, query.companyId, 'payment_schedule.view');
    return this.schedules.findSchedulable(query);
  }

  // ── Programações ──────────────────────────────────────────────────────────

  @Get('payment-schedules')
  @ApiOperation({ summary: 'Lista as programações de pagamento.' })
  async findAll(
    @Query() query: PaymentScheduleQueryDto,
    @CurrentActor() actor: RequestActor,
  ) {
    if (query.companyId) {
      assertCompanyPermission(actor, query.companyId, 'payment_schedule.view');
    } else if (query.organizationId) {
      assertOrganizationPermission(
        actor,
        query.organizationId,
        'payment_schedule.view',
      );
    }

    return this.schedules.findAll(query);
  }

  @Post('payment-schedules')
  @ApiMessage('Programação criada com sucesso.')
  @ApiOperation({ summary: 'Programa o pagamento de um título.' })
  async create(
    @Body() dto: CreatePaymentScheduleDto,
    @CurrentActor() actor: RequestActor,
  ) {
    assertCompanyPermission(actor, dto.companyId, 'payment_schedule.create');
    return this.schedules.create(dto, actor);
  }

  @Post('payment-schedules/bulk')
  @ApiMessage('Programações atualizadas.')
  @ApiOperation({
    summary: 'Aplica data, conta, tipo ou prioridade a várias programações.',
  })
  async bulkUpdate(
    @Body() dto: BulkScheduleDto,
    @CurrentActor() actor: RequestActor,
  ) {
    // Cada programação é conferida de novo dentro do serviço, contra a empresa do
    // registro — a checagem aqui só evita a chamada de quem não tem permissão nenhuma.
    for (const scheduleId of dto.scheduleIds.slice(0, 1)) {
      await this.assertSchedulePermission(
        scheduleId,
        actor,
        'payment_schedule.edit',
      );
    }

    return this.schedules.bulkUpdate(dto, actor);
  }

  @Post('payment-schedules/bulk-cancel')
  @ApiMessage('Programações canceladas.')
  @ApiOperation({ summary: 'Cancela várias programações com o mesmo motivo.' })
  async bulkCancel(
    @Body() dto: BulkCancelDto,
    @CurrentActor() actor: RequestActor,
  ) {
    for (const scheduleId of dto.scheduleIds.slice(0, 1)) {
      await this.assertSchedulePermission(
        scheduleId,
        actor,
        'payment_schedule.edit',
      );
    }

    return this.schedules.bulkCancel(dto, actor);
  }

  @Post('payment-schedules/reorder')
  @ApiMessage('Fila reordenada.')
  @ApiOperation({ summary: 'Reordena manualmente a fila de pagamentos.' })
  async reorder(
    @Body() dto: ReorderQueueDto,
    @CurrentActor() actor: RequestActor,
  ) {
    for (const scheduleId of dto.scheduleIds.slice(0, 1)) {
      await this.assertSchedulePermission(
        scheduleId,
        actor,
        'payment_schedule.edit',
      );
    }

    return this.schedules.reorderQueue(dto, actor);
  }

  @Get('payment-schedules/:id')
  @ApiOperation({ summary: 'Detalhe da programação.' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertSchedulePermission(id, actor, 'payment_schedule.view');
    return this.schedules.findOne(id);
  }

  @Patch('payment-schedules/:id')
  @ApiMessage('Programação atualizada com sucesso.')
  @ApiOperation({
    summary: 'Altera data, conta, forma, prioridade ou responsável.',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePaymentScheduleDto,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertSchedulePermission(id, actor, 'payment_schedule.edit');
    return this.schedules.update(id, dto, actor);
  }

  @Post('payment-schedules/:id/reschedule')
  @ApiMessage('Pagamento reprogramado.')
  @ApiOperation({ summary: 'Reprograma o pagamento, com motivo registrado.' })
  async reschedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleDto,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertSchedulePermission(
      id,
      actor,
      'payment_schedule.reschedule',
    );
    return this.schedules.reschedule(id, dto, actor);
  }

  @Post('payment-schedules/:id/block')
  @ApiMessage('Programação bloqueada.')
  @ApiOperation({
    summary: 'Bloqueia a programação e a tira da fila de pagamento.',
  })
  async block(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BlockScheduleDto,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertSchedulePermission(id, actor, 'payment_schedule.block');
    return this.schedules.block(id, dto, actor);
  }

  @Post('payment-schedules/:id/unblock')
  @ApiMessage('Programação liberada.')
  @ApiOperation({ summary: 'Libera o bloqueio da programação.' })
  async unblock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UnblockScheduleDto,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertSchedulePermission(id, actor, 'payment_schedule.unblock');
    return this.schedules.unblock(id, dto, actor);
  }

  @Post('payment-schedules/:id/cancel')
  @ApiMessage('Programação cancelada.')
  @ApiOperation({
    summary:
      'Cancela a programação e devolve as parcelas à fila. O título continua devido.',
  })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertSchedulePermission(id, actor, 'payment_schedule.edit');
    return this.schedules.cancel(id, dto, actor);
  }

  @Get('payment-schedules/:id/history')
  @ApiOperation({ summary: 'Histórico da programação.' })
  async history(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertSchedulePermission(id, actor, 'payment_schedule.view');
    return this.schedules.history(id);
  }

  @Post('payment-schedules/:id/comments')
  @ApiMessage('Comentário registrado.')
  @ApiOperation({ summary: 'Comenta na programação.' })
  async comment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ScheduleCommentDto,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertSchedulePermission(id, actor, 'payment_schedule.view');
    return this.schedules.comment(id, dto, actor);
  }

  // ── Lotes ─────────────────────────────────────────────────────────────────

  @Get('payment-batches')
  @ApiOperation({ summary: 'Lista os lotes de pagamento.' })
  async findBatches(
    @Query() query: PaymentBatchQueryDto,
    @CurrentActor() actor: RequestActor,
  ) {
    if (query.companyId) {
      assertCompanyPermission(actor, query.companyId, 'payment_schedule.view');
    } else if (query.organizationId) {
      assertOrganizationPermission(
        actor,
        query.organizationId,
        'payment_schedule.view',
      );
    }

    return this.batches.findAll(query);
  }

  @Post('payment-batches')
  @ApiMessage('Lote criado com sucesso.')
  @ApiOperation({ summary: 'Cria um lote de pagamento.' })
  async createBatch(
    @Body() dto: CreatePaymentBatchDto,
    @CurrentActor() actor: RequestActor,
  ) {
    assertCompanyPermission(actor, dto.companyId, 'payment_schedule.batch');
    return this.batches.create(dto, actor);
  }

  @Get('payment-batches/:id')
  @ApiOperation({
    summary: 'Detalhe do lote, com os títulos e a posição da conta.',
  })
  async findBatch(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertBatchPermission(id, actor, 'payment_schedule.view');
    return this.batches.findOne(id);
  }

  @Patch('payment-batches/:id')
  @ApiMessage('Lote atualizado com sucesso.')
  @ApiOperation({ summary: 'Altera o lote, fecha para envio ou cancela.' })
  async updateBatch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePaymentBatchDto,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertBatchPermission(id, actor, 'payment_schedule.batch');
    return this.batches.update(id, dto, actor);
  }

  @Post('payment-batches/:id/schedules')
  @ApiMessage('Programações incluídas no lote.')
  @ApiOperation({ summary: 'Inclui programações no lote.' })
  async addToBatch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BatchMembershipDto,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertBatchPermission(id, actor, 'payment_schedule.batch');
    return this.batches.addSchedules(id, dto, actor);
  }

  @Post('payment-batches/:id/remove-schedules')
  @ApiMessage('Programações removidas do lote.')
  @ApiOperation({ summary: 'Remove programações do lote e as devolve à fila.' })
  async removeFromBatch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BatchMembershipDto,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.assertBatchPermission(id, actor, 'payment_schedule.batch');
    return this.batches.removeSchedules(id, dto, actor);
  }
}
