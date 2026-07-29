import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

import { CreateSupplierDto } from './create-supplier.dto';

/**
 * Usado para salvar o cadastro de fornecedor em andamento (rascunho). Todos os campos são
 * opcionais, exceto a organização — mesma lógica aplicada ao rascunho de empresas.
 */
export class SaveDraftSupplierDto extends PartialType(CreateSupplierDto) {
  @ApiProperty()
  @IsUUID()
  declare organizationId: string;
}
