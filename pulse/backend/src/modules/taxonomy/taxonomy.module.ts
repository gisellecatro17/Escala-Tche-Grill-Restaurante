import { Module } from '@nestjs/common';

import { FinancialStructureModule } from '../financial-structure/financial-structure.module';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { CostCentersController } from './cost-centers.controller';
import { CostCentersService } from './cost-centers.service';

/**
 * Categorias financeiras (com subcategorias na própria hierarquia) e centros de custo.
 * Importa `FinancialStructureModule` para reaproveitar o versionamento de árvores.
 */
@Module({
  imports: [FinancialStructureModule],
  controllers: [CategoriesController, CostCentersController],
  providers: [CategoriesService, CostCentersService],
  exports: [CategoriesService, CostCentersService],
})
export class TaxonomyModule {}
