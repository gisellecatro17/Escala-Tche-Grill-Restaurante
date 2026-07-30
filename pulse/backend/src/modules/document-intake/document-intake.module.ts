import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { StorageModule } from '../../storage/storage.module';
import { AuditModule } from '../audit/audit.module';
import { BoletoValidationService } from './boleto-validation.service';
import { DocumentIntakeController } from './document-intake.controller';
import { DocumentIntakeService } from './document-intake.service';
import { DuplicateDetectionService } from './duplicate-detection.service';
import { FileValidationService } from './file-validation.service';
import { IntakeIssuesService } from './intake-issues.service';
import { IntakePipelineService } from './intake-pipeline.service';
import { IntakeWorkerService } from './intake-worker.service';
import { PartyIdentificationService } from './party-identification.service';
import { AntivirusScanner } from './providers/antivirus.provider';
import {
  DocumentExtractionProvider,
  LocalDocumentExtractionProvider,
} from './providers/document-extraction.provider';

/**
 * Módulo de Entrada de Documentos.
 *
 * A extração é registrada pela **abstração** (`DocumentExtractionProvider`) apontando para a
 * implementação local: trocar por um provedor externo é mudar este `useClass`, sem tocar em
 * quem consome.
 */
@Module({
  imports: [PrismaModule, AuditModule, StorageModule],
  controllers: [DocumentIntakeController],
  providers: [
    DocumentIntakeService,
    FileValidationService,
    BoletoValidationService,
    PartyIdentificationService,
    DuplicateDetectionService,
    IntakeIssuesService,
    IntakePipelineService,
    IntakeWorkerService,
    AntivirusScanner,
    LocalDocumentExtractionProvider,
    {
      provide: DocumentExtractionProvider,
      useClass: LocalDocumentExtractionProvider,
    },
  ],
  exports: [
    DocumentIntakeService,
    BoletoValidationService,
    IntakePipelineService,
    PartyIdentificationService,
  ],
})
export class DocumentIntakeModule {}
