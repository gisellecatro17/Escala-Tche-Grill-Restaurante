import { ApiProperty } from '@nestjs/swagger';
import { CustomerRiskLevel } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

/** Configuração de crédito e risco do vínculo (seção 40-45) — protegida pela permissão
 * dedicada `customer.update_credit_limit`, distinta de `customer.manage_credit`. */
export class UpdateCreditDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'O limite de crédito não pode ser negativo.' })
  creditLimit?: number;

  @ApiProperty({ required: false, enum: CustomerRiskLevel })
  @IsOptional()
  @IsEnum(CustomerRiskLevel)
  riskLevel?: CustomerRiskLevel;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  allowOverCreditLimit?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  requiresOverLimitApproval?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  maximumPaymentTermDays?: number;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  automaticBlockEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  automaticBlockDays?: number;
}
