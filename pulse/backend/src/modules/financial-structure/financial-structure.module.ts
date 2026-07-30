import { Module } from '@nestjs/common';

import { AccountPlanVersionsController } from './account-plan-versions.controller';
import { AccountPlanVersionsService } from './account-plan-versions.service';
import { AccountPlansController } from './account-plans.controller';
import { AccountPlansService } from './account-plans.service';
import { AllocationRulesController } from './allocation-rules.controller';
import { AllocationRulesService } from './allocation-rules.service';
import { BusinessUnitsController } from './business-units.controller';
import { BusinessUnitsService } from './business-units.service';
import { ClassificationRulesController } from './classification-rules.controller';
import { ClassificationRulesService } from './classification-rules.service';
import { FinancialNaturesController } from './financial-natures.controller';
import { FinancialNaturesService } from './financial-natures.service';
import { FinancialStructureController } from './financial-structure.controller';
import { FinancialTagsController } from './financial-tags.controller';
import { FinancialTagsService } from './financial-tags.service';
import { HierarchyVersionsService } from './hierarchy-versions.service';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ResultCentersController } from './result-centers.controller';
import { ResultCentersService } from './result-centers.service';
import { StructureDiagnosticsService } from './structure-diagnostics.service';
import { StructureImportService } from './structure-import.service';

/**
 * Estrutura financeira: plano de contas, centros de resultado, projetos, unidades de
 * negócio, naturezas, tags, rateios, regras de classificação, importação/exportação e
 * versionamento. Categorias e centros de custo continuam no módulo `taxonomy`, que
 * reaproveita os utilitários de árvore e o versionamento exportados daqui.
 */
@Module({
  controllers: [
    AccountPlansController,
    AccountPlanVersionsController,
    ResultCentersController,
    ProjectsController,
    BusinessUnitsController,
    FinancialNaturesController,
    FinancialTagsController,
    AllocationRulesController,
    ClassificationRulesController,
    FinancialStructureController,
  ],
  providers: [
    AccountPlansService,
    AccountPlanVersionsService,
    StructureDiagnosticsService,
    ResultCentersService,
    ProjectsService,
    BusinessUnitsService,
    FinancialNaturesService,
    FinancialTagsService,
    AllocationRulesService,
    ClassificationRulesService,
    HierarchyVersionsService,
    StructureImportService,
  ],
  exports: [
    AccountPlansService,
    AccountPlanVersionsService,
    StructureDiagnosticsService,
    ResultCentersService,
    ProjectsService,
    BusinessUnitsService,
    FinancialNaturesService,
    FinancialTagsService,
    AllocationRulesService,
    ClassificationRulesService,
    HierarchyVersionsService,
  ],
})
export class FinancialStructureModule {}
