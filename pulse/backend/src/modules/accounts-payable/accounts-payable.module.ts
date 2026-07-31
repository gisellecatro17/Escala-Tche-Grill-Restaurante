import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { AccountsPayableController } from './accounts-payable.controller';
import { AccountsPayableDashboardService } from './accounts-payable-dashboard.service';
import { AccountsPayableService } from './accounts-payable.service';
import { PayableBalanceService } from './payable-balance.service';
import { PayableGenerationService } from './payable-generation.service';
import { PayableSettlementService } from './payable-settlement.service';

/**
 * Módulo do Contas a Pagar.
 *
 * Importa só Prisma e Auditoria. Quem chama quem: o processamento e as autorizações
 * importam **este** para gerar o título — este não importa nenhum dos dois. A seta em um
 * sentido só evita a dependência circular e mantém a hierarquia legível: a governança
 * decide, o contas a pagar registra.
 *
 * `PayableGenerationService` é exportado porque é o ponto de entrada que os módulos
 * anteriores usam; `AccountsPayableService` é exportado para o Agendamento Bancário poder
 * ler e programar títulos quando existir, sem que este módulo precise mudar.
 */
@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [AccountsPayableController],
  providers: [
    AccountsPayableService,
    AccountsPayableDashboardService,
    PayableBalanceService,
    PayableGenerationService,
    PayableSettlementService,
  ],
  exports: [PayableGenerationService, AccountsPayableService],
})
export class AccountsPayableModule {}
