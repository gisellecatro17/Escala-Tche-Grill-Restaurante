import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import {
  PaymentMethodType,
  ReceiptMethodType,
  RecordStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
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
} from 'class-validator';

// ── Formas de pagamento (seções 41 e 42) ───────────────────────────────────

export class CreatePaymentMethodDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiPropertyOptional({
    description: 'Ausente = forma compartilhada por toda a organização.',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiProperty({ example: 'PIX' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o código da forma de pagamento.' })
  @MaxLength(30)
  code: string;

  @ApiProperty({ example: 'PIX' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome da forma de pagamento.' })
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: PaymentMethodType })
  @IsEnum(PaymentMethodType)
  methodType: PaymentMethodType;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  requiresFinancialAccount?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresBeneficiary?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresBankData?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresPixKey?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresBarcode?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresDigitableLine?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresAttachment?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  allowsScheduling?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowsInstallments?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowsRecurrence?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowsIntegration?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowsBatchPayment?: boolean;

  @ApiPropertyOptional({
    description: 'Valor a partir do qual a forma exige confirmação adicional.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  confirmationThreshold?: number;

  @ApiPropertyOptional({ default: 0, description: 'Dias de compensação.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  settlementDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  defaultFeeCategoryId?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ enum: RecordStatus })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}

export class UpdatePaymentMethodDto extends PartialType(
  OmitType(CreatePaymentMethodDto, ['organizationId', 'companyId'] as const),
) {}

// ── Formas de recebimento (seções 43 e 44) ─────────────────────────────────

export class CreateReceiptMethodDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiProperty({ example: 'CARTAO-CREDITO' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o código da forma de recebimento.' })
  @MaxLength(30)
  code: string;

  @ApiProperty({ example: 'Cartão de crédito' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome da forma de recebimento.' })
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ReceiptMethodType })
  @IsEnum(ReceiptMethodType)
  methodType: ReceiptMethodType;

  @ApiPropertyOptional({ description: 'Conta em que o valor costuma cair.' })
  @IsOptional()
  @IsUUID()
  defaultFinancialAccountId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresCustomer?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresDocument?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresIdentifier?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowsRecurrence?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowsInstallments?: boolean;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maximumInstallments?: number;

  @ApiPropertyOptional({
    example: 30,
    description: 'Prazo de compensação, em dias.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  settlementDays?: number;

  @ApiPropertyOptional({
    example: 0.5,
    description: 'Tarifa fixa por transação.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  fixedFee?: number;

  @ApiPropertyOptional({ example: 3.49, description: 'Tarifa percentual.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100, { message: 'A taxa percentual não pode ultrapassar 100%.' })
  percentageFee?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  anticipationAllowed?: boolean;

  @ApiPropertyOptional({ example: 1.99 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100, { message: 'A taxa de antecipação não pode ultrapassar 100%.' })
  anticipationFeePercentage?: number;

  @ApiPropertyOptional({
    description: 'Categoria em que a tarifa será lançada.',
  })
  @IsOptional()
  @IsUUID()
  defaultFeeCategoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  defaultInterestCategoryId?: string;

  @ApiPropertyOptional({
    description: 'Adquirente ou gateway cadastrado como fornecedor.',
  })
  @IsOptional()
  @IsUUID()
  acquirerSupplierId?: string;

  @ApiPropertyOptional({ example: 'Stone' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  integrationProvider?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ enum: RecordStatus })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}

export class UpdateReceiptMethodDto extends PartialType(
  OmitType(CreateReceiptMethodDto, ['organizationId', 'companyId'] as const),
) {}

export class MethodQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ enum: RecordStatus })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
