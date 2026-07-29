import { ApiProperty } from '@nestjs/swagger';
import {
  AbcClassification,
  CustomerOrigin,
  CustomerPaymentMethod,
  CustomerType,
  RecurrencePeriodicity,
  RevenuePotentialLevel,
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

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  relationshipType?: string;

  @ApiProperty({ required: false, enum: CustomerType, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(CustomerType, { each: true })
  customerTypes?: CustomerType[];

  @ApiProperty({ required: false, enum: CustomerOrigin })
  @IsOptional()
  @IsEnum(CustomerOrigin)
  source?: CustomerOrigin;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  segment?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  commercialResponsibleId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  relationshipResponsibleId?: string;

  // ── Classificação comercial (etapa 4) ──────────────────────────────────────
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  defaultRevenueCategoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  defaultSubcategoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  defaultResultCenterId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  defaultAccountingAccount?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  defaultProductService?: string;

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

  @ApiProperty({ required: false, enum: AbcClassification })
  @IsOptional()
  @IsEnum(AbcClassification)
  abcClassification?: AbcClassification;

  @ApiProperty({ required: false, enum: RevenuePotentialLevel })
  @IsOptional()
  @IsEnum(RevenuePotentialLevel)
  revenuePotentialLevel?: RevenuePotentialLevel;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedMonthlyRevenue?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedAnnualRevenue?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedAverageTicket?: number;

  @ApiProperty({ required: false, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  estimatedMarginPercentage?: number;

  // ── Condições de recebimento (etapa 5) ─────────────────────────────────────
  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  paymentTermDays?: number;

  @ApiProperty({ required: false, minimum: 1, maximum: 31 })
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'O dia de vencimento deve estar entre 1 e 31.' })
  @Max(31, { message: 'O dia de vencimento deve estar entre 1 e 31.' })
  defaultDueDay?: number;

  @ApiProperty({ required: false, enum: RecurrencePeriodicity })
  @IsOptional()
  @IsEnum(RecurrencePeriodicity)
  billingFrequency?: RecurrencePeriodicity;

  @ApiProperty({ required: false, enum: CustomerPaymentMethod })
  @IsOptional()
  @IsEnum(CustomerPaymentMethod)
  preferredPaymentMethod?: CustomerPaymentMethod;

  @ApiProperty({
    required: false,
    description:
      'Conta bancária da empresa para recebimento (módulo de contas bancárias ainda não construído).',
  })
  @IsOptional()
  @IsUUID()
  preferredCompanyBankAccountId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  preferredCompanyPixKeyId?: string;

  @ApiProperty({ required: false, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  defaultLateFeePercentage?: number;

  @ApiProperty({ required: false, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  defaultMonthlyInterestPercentage?: number;

  @ApiProperty({ required: false, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  defaultDiscountPercentage?: number;

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
  earlyPaymentDays?: number;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  gracePeriodDays?: number;

  // ── Regras de automação (seção 38) ─────────────────────────────────────────
  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  autoIdentificationEnabled?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  autoRevenueClassificationEnabled?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  autoResultCenterEnabled?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  receivableSuggestionEnabled?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  autoReceivableCreationEnabled?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  autoReceiptMatchingEnabled?: boolean;

  @ApiProperty({ required: false, minimum: 0, maximum: 100, default: 95 })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'O limite de confiança deve estar entre 0% e 100%.' })
  @Max(100, { message: 'O limite de confiança deve estar entre 0% e 100%.' })
  confirmationThreshold?: number;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  billingRulesEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  internalNotes?: string;
}
