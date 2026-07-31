import { OmitType, PartialType } from '@nestjs/swagger';

import { CreateCompanyLinkDto } from './create-company-link.dto';

export class UpdateCompanyLinkDto extends PartialType(
  OmitType(CreateCompanyLinkDto, ['companyId'] as const),
) {}
