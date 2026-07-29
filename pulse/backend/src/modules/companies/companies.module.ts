import { Module } from '@nestjs/common';

import { CompanyRegistryModule } from '../../integrations/company-registry/company-registry.module';
import { PostalCodeModule } from '../../integrations/postal-code/postal-code.module';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';

@Module({
  imports: [CompanyRegistryModule, PostalCodeModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
