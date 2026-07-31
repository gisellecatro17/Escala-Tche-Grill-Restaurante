import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { DocumentIntakeModule } from '../document-intake/document-intake.module';
import { BankTransactionNormalizationService } from './bank-transaction-normalization.service';
import { BankTransactionsService } from './bank-transactions.service';
import { ReconciliationDuplicateService } from './duplicate-detection.service';
import { ImportTemplatesService } from './import-templates.service';
import { OfxImportService } from './parsers/ofx-import.service';
import { TabularImportService } from './parsers/tabular-import.service';
import { ReconciliationController } from './reconciliation.controller';
import { ReconciliationDashboardService } from './reconciliation-dashboard.service';
import { ReconciliationMatchingService } from './reconciliation-matching.service';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationSettingsService } from './reconciliation-settings.service';
import { StatementImportService } from './statement-import.service';

/**
 * Módulo do Centro de Conciliação Financeira.
 *
 * Importa Prisma, Auditoria e a Entrada de Documentos — nada do Contas a Pagar nem do
 * Agendamento. Ele **lê** essas tabelas direto pelo Prisma, como o Agendamento já faz: a
 * seta continua apontando em um sentido só, e nenhum módulo anterior precisa saber que a
 * conciliação existe. Importar o Contas a Pagar aqui criaria o primeiro ciclo do grafo.
 *
 * Da Entrada de Documentos vem só o `FileValidationService` (MIME, hash, antivírus); o
 * `StorageService` já é global. Nada disso foi recriado: um segundo caminho de upload seria
 * um segundo conjunto de regras de segurança para manter em dia.
 */
@Module({
  imports: [PrismaModule, AuditModule, DocumentIntakeModule],
  controllers: [ReconciliationController],
  providers: [
    OfxImportService,
    TabularImportService,
    BankTransactionNormalizationService,
    ReconciliationDuplicateService,
    ReconciliationMatchingService,
    ReconciliationSettingsService,
    StatementImportService,
    BankTransactionsService,
    ReconciliationService,
    ReconciliationDashboardService,
    ImportTemplatesService,
  ],
  exports: [ReconciliationService, ReconciliationSettingsService],
})
export class ReconciliationModule {}
