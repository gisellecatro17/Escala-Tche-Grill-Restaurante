import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
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
 */
@Module({
  imports: [PrismaModule, AuditModule],
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
