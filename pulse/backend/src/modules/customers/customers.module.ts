import { Module } from '@nestjs/common';

import { CompanyRegistryModule } from '../../integrations/company-registry/company-registry.module';
import { CustomerCompanyLinksController } from './customer-company-links.controller';
import { CustomerCompanyLinksService } from './customer-company-links.service';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  imports: [CompanyRegistryModule],
  controllers: [CustomersController, CustomerCompanyLinksController],
  providers: [CustomersService, CustomerCompanyLinksService],
  exports: [CustomersService, CustomerCompanyLinksService],
})
export class CustomersModule {}
