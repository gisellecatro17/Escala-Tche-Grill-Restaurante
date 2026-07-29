import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class DocumentQueryCustomerDto {
  @ApiProperty({ example: '12.345.678/0001-90' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o CPF/CNPJ a ser consultado.' })
  documentNumber: string;

  @ApiProperty({
    required: false,
    description:
      'Organização em contexto (para registrar a consulta), quando já conhecida.',
  })
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}
