import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { DocumentIntakeModule } from '../document-intake/document-intake.module';
import { FinancialStructureModule } from '../financial-structure/financial-structure.module';
import { AllocationApplicationService } from './allocation-application.service';
import { DocumentProcessingController } from './document-processing.controller';
import { DocumentProcessingService } from './document-processing.service';
import { EntryClassificationService } from './entry-classification.service';
import { FinancialEntriesService } from './financial-entries.service';
import { InstallmentGeneratorService } from './installment-generator.service';
import { WithholdingCalculatorService } from './withholding-calculator.service';

/**
 * Módulo de Processamento de Documentos.
 *
 * Consome os dois módulos anteriores em vez de recriar o que eles fazem: a entrada de
 * documentos para ler o documento encaminhado, e a estrutura financeira para a regra de
 * classificação automática — que existia desde o Prompt 5 e só era simulável até aqui.
 */
@Module({
  imports: [
    PrismaModule,
    AuditModule,
    DocumentIntakeModule,
    FinancialStructureModule,
  ],
  controllers: [DocumentProcessingController],
  providers: [
    DocumentProcessingService,
    FinancialEntriesService,
    EntryClassificationService,
    WithholdingCalculatorService,
    InstallmentGeneratorService,
    AllocationApplicationService,
  ],
  exports: [DocumentProcessingService, FinancialEntriesService],
})
export class DocumentProcessingModule {}
