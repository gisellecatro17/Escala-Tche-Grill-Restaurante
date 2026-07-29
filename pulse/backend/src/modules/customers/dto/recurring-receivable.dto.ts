import { ApiProperty } from '@nestjs/swagger';
import { CustomerPaymentMethod, RecurrencePeriodicity } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

/** Recorrência financeira vinculada ao contrato (seção 56). Enquanto o módulo de contas a
 * receber não existir, o processamento permanece "aguardando módulo financeiro". */
export class RecurringReceivableDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  contractId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.01, { message: 'Informe o valor da recorrência.' })
  amount: number;

  @ApiProperty({ enum: RecurrencePeriodicity })
  @IsEnum(RecurrencePeriodicity)
  frequency: RecurrencePeriodicity;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  firstDueDate?: string;

  @ApiProperty({ required: false, minimum: 1, maximum: 31 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  fixedDueDay?: number;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty({ message: 'Informe a data inicial.' })
  startDate: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  installmentCount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  revenueCategoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  subcategoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  resultCenterId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  companyBankAccountId?: string;

  @ApiProperty({ required: false, enum: CustomerPaymentMethod })
  @IsOptional()
  @IsEnum(CustomerPaymentMethod)
  paymentMethod?: CustomerPaymentMethod;

  @ApiProperty({ required: false, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  lateFeePercentage?: number;

  @ApiProperty({ required: false, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  monthlyInterestPercentage?: number;

  @ApiProperty({ required: false, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercentage?: number;

  @ApiProperty({ required: false, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  earlyPaymentDiscountPercentage?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  generationAdvanceDays?: number;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  automaticGenerationEnabled?: boolean;
}
