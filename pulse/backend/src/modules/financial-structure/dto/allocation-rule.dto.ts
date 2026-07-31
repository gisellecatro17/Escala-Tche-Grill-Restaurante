import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import {
  AllocationCriterion,
  AllocationTargetType,
  RecordStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Linha de rateio. O destino é indicado por `targetType` + o id correspondente —
 * validado no serviço para garantir que o id do tipo escolhido foi informado.
 */
export class AllocationRuleLineDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ enum: AllocationTargetType })
  @IsEnum(AllocationTargetType)
  targetType: AllocationTargetType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  costCenterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  resultCenterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  businessUnitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  accountPlanId?: string;

  @ApiPropertyOptional({
    description: 'Obrigatório quando o critério é PERCENTAGE.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentage?: number;

  @ApiPropertyOptional({
    description: 'Obrigatório quando o critério é FIXED_AMOUNT.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fixedAmount?: number;

  @ApiPropertyOptional({
    description:
      'Peso bruto para QUANTITY/HOURS/WEIGHT/CUSTOM — o percentual é derivado da soma dos pesos.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

/** Rateio padrão reutilizável (ex.: Energia 60% Restaurante / 40% Administrativo). */
export class CreateAllocationRuleDto {
  @ApiProperty()
  @IsUUID()
  companyId: string;

  @ApiProperty({ example: 'Rateio de energia' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do rateio.' })
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    enum: AllocationCriterion,
    default: AllocationCriterion.PERCENTAGE,
  })
  @IsOptional()
  @IsEnum(AllocationCriterion)
  criterion?: AllocationCriterion;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Descreve o critério quando `criterion = CUSTOM`.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  customCriterionLabel?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiProperty({ type: [AllocationRuleLineDto] })
  @IsArray()
  @ArrayNotEmpty({ message: 'Informe ao menos uma linha de rateio.' })
  @ValidateNested({ each: true })
  @Type(() => AllocationRuleLineDto)
  lines: AllocationRuleLineDto[];

  @ApiPropertyOptional({ enum: RecordStatus })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}

export class UpdateAllocationRuleDto extends PartialType(
  OmitType(CreateAllocationRuleDto, ['companyId'] as const),
) {}
