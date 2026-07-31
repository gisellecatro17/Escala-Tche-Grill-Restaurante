import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AccountsPayableModule } from '../accounts-payable/accounts-payable.module';
import { AuditModule } from '../audit/audit.module';
import { ApprovalDashboardService } from './approval-dashboard.service';
import { ApprovalFlowResolverService } from './approval-flow-resolver.service';
import { ApprovalFlowsService } from './approval-flows.service';
import { ApprovalRequestsService } from './approval-requests.service';
import { ApprovalsController } from './approvals.controller';
import { ApproverResolverService } from './approver-resolver.service';

/**
 * Módulo de Autorizações.
 *
 * Não importa o módulo de processamento — é o contrário: o processamento importa este para
 * perguntar se o lançamento pode ser aberto. Manter a seta em um sentido só evita a
 * dependência circular e deixa claro quem manda em quem: a governança decide, o
 * processamento obedece.
 *
 * Importa o Contas a Pagar pelo mesmo motivo, na mesma direção: quando a última etapa
 * obrigatória é aprovada, é aqui que o título nasce. O contas a pagar não sabe que as
 * autorizações existem.
 */
@Module({
  imports: [PrismaModule, AuditModule, AccountsPayableModule],
  controllers: [ApprovalsController],
  providers: [
    ApprovalRequestsService,
    ApprovalFlowsService,
    ApprovalFlowResolverService,
    ApproverResolverService,
    ApprovalDashboardService,
  ],
  exports: [ApprovalRequestsService, ApprovalFlowsService],
})
export class ApprovalsModule {}
