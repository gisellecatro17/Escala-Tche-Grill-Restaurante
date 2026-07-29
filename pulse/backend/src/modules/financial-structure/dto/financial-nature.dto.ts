import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { FinancialNatureKind, RecordStatus } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

/** Natureza financeira do catálogo (`financial_natures`). */
export class CreateFinancialNatureDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiPropertyOptional({
    description: 'Ausente = natureza compartilhada por toda a organização.',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @ApiProperty({ example: 'Despesa Operacional' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome da natureza financeira.' })
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: FinancialNatureKind })
  @IsEnum(FinancialNatureKind)
  kind: FinancialNatureKind;

  @ApiPropertyOptional({
    default: true,
    description: 'Se o valor impacta o resultado (DRE gerencial).',
  })
  @IsOptional()
  @IsBoolean()
  affectsResult?: boolean;

  @ApiPropertyOptional({
    default: true,
    description: 'Se o valor impacta o caixa (fluxo de caixa).',
  })
  @IsOptional()
  @IsBoolean()
  affectsCashFlow?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ enum: RecordStatus })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}

export class UpdateFinancialNatureDto extends PartialType(
  OmitType(CreateFinancialNatureDto, ['organizationId', 'companyId'] as const),
) {}
