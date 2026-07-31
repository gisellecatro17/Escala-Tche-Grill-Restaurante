import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { AccountBalanceService } from './account-balance.service';
import { PaymentBatchesService } from './payment-batches.service';
import { PaymentSchedulingController } from './payment-scheduling.controller';
import { PaymentSchedulingDashboardService } from './payment-scheduling-dashboard.service';
import { PaymentSchedulesService } from './payment-schedules.service';
import { PaymentSimulationService } from './payment-simulation.service';

/**
 * Módulo de Agendamento Bancário.
 *
 * Importa só Prisma e Auditoria. Ele **lê** o Contas a Pagar e a Tesouraria direto pelo
 * Prisma, sem importar os módulos: a seta continua apontando em um sentido só, e nem o
 * Contas a Pagar nem a Tesouraria sabem que o agendamento existe.
 *
 * `AccountBalanceService` é exportado porque é o único lugar que responde "quanto há nesta
 * conta" — quando a conciliação bancária chegar, ela substitui a fonte lá dentro e todo o
 * resto do sistema continua igual.
 */
@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [PaymentSchedulingController],
  providers: [
    PaymentSchedulesService,
    PaymentBatchesService,
    PaymentSchedulingDashboardService,
    PaymentSimulationService,
    AccountBalanceService,
  ],
  exports: [PaymentSchedulesService, AccountBalanceService],
})
export class PaymentSchedulingModule {}
