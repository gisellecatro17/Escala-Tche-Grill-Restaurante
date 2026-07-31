import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Regra de classificação alternativa por condição (seção 31 do prompt de fornecedores). */
export class ClassificationRuleDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ruleType?: string;

  @ApiProperty({ example: 'description' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o campo da condição.' })
  conditionField: string;

  @ApiProperty({ example: 'contains' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o operador da condição.' })
  conditionOperator: string;

  @ApiProperty({ example: 'MATERIAL DE LIMPEZA' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o valor da condição.' })
  conditionValue: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  subcategoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  costCenterId?: string;

  @ApiProperty({ required: false, default: 100 })
  @IsOptional()
  @IsNumber()
  priority?: number;

  @ApiProperty({ required: false, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  confidence?: number;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  automatic?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  requiresConfirmation?: boolean;
}
