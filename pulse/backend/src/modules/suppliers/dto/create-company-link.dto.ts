import { ApiProperty } from '@nestjs/swagger';
import {
  FinancialNature,
  PaymentMethod,
  SupplierType,
  TaxWithholdingPolicy,
} from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCompanyLinkDto {
  @ApiProperty()
  @IsUUID()
  companyId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  internalCode?: string;

  @ApiProperty({ required: false, enum: SupplierType, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(SupplierType, { each: true })
  supplierTypes?: SupplierType[];

  // ── Classificação financeira (etapa 5) ────────────────────────────────────
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  defaultCategoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  defaultSubcategoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  defaultCostCenterId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  defaultAccountingAccount?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  defaultDescription?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  defaultHistory?: string;

  @ApiProperty({ required: false, enum: FinancialNature })
  @IsOptional()
  @IsEnum(FinancialNature)
  financialNature?: FinancialNature;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  categoryRequired?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  costCenterRequired?: boolean;

  // ── Condições comerciais (etapa 6) ────────────────────────────────────────
  @ApiProperty({ required: false, enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  preferredPaymentMethod?: PaymentMethod;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  paymentTermDays?: number;

  @ApiProperty({ required: false, minimum: 1, maximum: 31 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  paymentTermFixedDueDay?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  paymentTermPeriodicity?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  preferredBankAccountId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  preferredPixKeyId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumAmount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maximumAmountWithoutApproval?: number;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  hasContract?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  requiresMatchingBeneficiary?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  allowsThirdPartyPayment?: boolean;

  // ── Retenções (etapa 7) ────────────────────────────────────────────────────
  @ApiProperty({ required: false, enum: TaxWithholdingPolicy })
  @IsOptional()
  @IsEnum(TaxWithholdingPolicy)
  taxWithholdingPolicy?: TaxWithholdingPolicy;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  allocationEnabled?: boolean;

  // ── Regras automáticas (etapa 8) ───────────────────────────────────────────
  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  autoIdentificationEnabled?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  autoClassificationEnabled?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  autoCostCenterEnabled?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  autoAllocationEnabled?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  reconciliationSuggestionEnabled?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  autoEntryCreationEnabled?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  autoReconciliationEnabled?: boolean;

  @ApiProperty({ required: false, minimum: 0, maximum: 100, default: 95 })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'O limite de confiança deve estar entre 0% e 100%.' })
  @Max(100, { message: 'O limite de confiança deve estar entre 0% e 100%.' })
  confirmationThreshold?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  internalNotes?: string;
}
