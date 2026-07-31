import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class DocumentQueryDto {
  @ApiProperty({ example: '12.345.678/0001-90' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o CNPJ a ser consultado.' })
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
