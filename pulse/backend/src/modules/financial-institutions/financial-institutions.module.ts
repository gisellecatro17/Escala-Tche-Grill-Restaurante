import { Module } from '@nestjs/common';

import { FinancialInstitutionsController } from './financial-institutions.controller';
import { FinancialInstitutionsService } from './financial-institutions.service';

@Module({
  controllers: [FinancialInstitutionsController],
  providers: [FinancialInstitutionsService],
  exports: [FinancialInstitutionsService],
})
export class FinancialInstitutionsModule {}
