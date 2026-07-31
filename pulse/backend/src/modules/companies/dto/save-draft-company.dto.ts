import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

import { CreateCompanyDto } from './create-company.dto';

/**
 * Usado para salvar o cadastro em andamento (rascunho). Todos os campos são opcionais,
 * exceto a organização — uma empresa sempre precisa pertencer a uma organização, mesmo
 * em rascunho. Os campos informados ainda passam pelas mesmas validações de formato.
 */
export class SaveDraftCompanyDto extends PartialType(CreateCompanyDto) {
  @ApiProperty()
  @IsUUID()
  declare organizationId: string;
}
