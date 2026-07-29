import { Module } from '@nestjs/common';

import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { CostCentersController } from './cost-centers.controller';
import { CostCentersService } from './cost-centers.service';

@Module({
  controllers: [CategoriesController, CostCentersController],
  providers: [CategoriesService, CostCentersService],
  exports: [CategoriesService, CostCentersService],
})
export class TaxonomyModule {}
