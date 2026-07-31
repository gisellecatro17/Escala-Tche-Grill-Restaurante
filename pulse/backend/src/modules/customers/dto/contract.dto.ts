import { ApiProperty } from '@nestjs/swagger';
import {
  AdjustmentType,
  CustomerContractStatus,
  CustomerPaymentMethod,
  RecurrencePeriodicity,
} from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

/** Contrato do cliente com a empresa (seção 53-57 do prompt de clientes). */
export class ContractDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  contractNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  object?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  productService?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  planName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  initialValue?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  currentValue?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  signatureDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isIndefiniteTerm?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  automaticRenewal?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  renewalNoticeDays?: number;

  @ApiProperty({ required: false, enum: RecurrencePeriodicity })
  @IsOptional()
  @IsEnum(RecurrencePeriodicity)
  billingFrequency?: RecurrencePeriodicity;

  @ApiProperty({ required: false, minimum: 1, maximum: 31 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay?: number;

  @ApiProperty({ required: false, enum: AdjustmentType })
  @IsOptional()
  @IsEnum(AdjustmentType)
  adjustmentType?: AdjustmentType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  adjustmentIndex?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  adjustmentPercentage?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  adjustmentBaseDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  nextAdjustmentDate?: string;

  @ApiProperty({ required: false, enum: CustomerPaymentMethod })
  @IsOptional()
  @IsEnum(CustomerPaymentMethod)
  preferredPaymentMethod?: CustomerPaymentMethod;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  companyBankAccountId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  revenueCategoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  resultCenterId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  internalResponsibleId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  customerContactId?: string;

  @ApiProperty({ required: false, enum: CustomerContractStatus })
  @IsOptional()
  @IsEnum(CustomerContractStatus)
  status?: CustomerContractStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
