import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { RecordStatus } from '@prisma/client';
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

/**
 * Centro de custo. Mantém `companyId`/`name` do cadastro rápido original e acrescenta a
 * hierarquia de profundidade ilimitada exigida pelo módulo de estrutura financeira.
 */
export class CreateCostCenterDto {
  @ApiProperty()
  @IsUUID()
  companyId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do centro de custo.' })
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({
    description:
      'Centro de custo pai. A hierarquia não tem limite de profundidade.',
  })
  @IsOptional()
  @IsUUID()
  parentCostCenterId?: string;

  @ApiPropertyOptional({ example: 'CC-COZINHA' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

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

  @ApiPropertyOptional({
    default: true,
    description:
      'Apenas centros analíticos (folhas) aceitam lançamentos diretos.',
  })
  @IsOptional()
  @IsBoolean()
  acceptsEntries?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  responsibleUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: RecordStatus })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}

export class UpdateCostCenterDto extends PartialType(
  OmitType(CreateCostCenterDto, ['companyId'] as const),
) {}
