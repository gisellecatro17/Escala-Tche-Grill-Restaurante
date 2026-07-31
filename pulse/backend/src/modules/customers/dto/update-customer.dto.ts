import { OmitType, PartialType } from '@nestjs/swagger';

import { CreateCustomerDto } from './create-customer.dto';

export class UpdateCustomerDto extends PartialType(
  OmitType(CreateCustomerDto, ['organizationId', 'companyLink'] as const),
) {}
