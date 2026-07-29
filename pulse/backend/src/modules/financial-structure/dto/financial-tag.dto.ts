import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { RecordStatus } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/** Tag financeira livre (modelo Notion), aplicável a vários cadastros. */
export class CreateFinancialTagDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiPropertyOptional({
    description: 'Ausente = tag compartilhada por toda a organização.',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiProperty({ example: 'Contrato 34' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome da tag.' })
  @MaxLength(80)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '#F59E0B' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional({
    example: 'Contratos',
    description: 'Agrupador opcional para organizar as tags na interface.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  group?: string;

  @ApiPropertyOptional({ enum: RecordStatus })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}

export class UpdateFinancialTagDto extends PartialType(
  OmitType(CreateFinancialTagDto, ['organizationId', 'companyId'] as const),
) {}
