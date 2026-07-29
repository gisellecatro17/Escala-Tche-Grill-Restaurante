import { Module } from '@nestjs/common';

import { CompanyRegistryModule } from '../../integrations/company-registry/company-registry.module';
import { SupplierCompanyLinksController } from './supplier-company-links.controller';
import { SupplierCompanyLinksService } from './supplier-company-links.service';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';

@Module({
  imports: [CompanyRegistryModule],
  controllers: [SuppliersController, SupplierCompanyLinksController],
  providers: [SuppliersService, SupplierCompanyLinksService],
  exports: [SuppliersService, SupplierCompanyLinksService],
})
export class SuppliersModule {}
