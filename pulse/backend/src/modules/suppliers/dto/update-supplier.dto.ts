import { OmitType, PartialType } from '@nestjs/swagger';

import { CreateSupplierDto } from './create-supplier.dto';

export class UpdateSupplierDto extends PartialType(
  OmitType(CreateSupplierDto, ['organizationId', 'companyLink'] as const),
) {}
