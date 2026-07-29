import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

import { CreateCustomerDto } from './create-customer.dto';

/** Usado para salvar o cadastro de cliente em andamento (rascunho). */
export class SaveDraftCustomerDto extends PartialType(CreateCustomerDto) {
  @ApiProperty()
  @IsUUID()
  declare organizationId: string;
}
