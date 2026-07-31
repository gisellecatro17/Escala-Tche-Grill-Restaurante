import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AccountsPayableAdjustmentType,
  AccountsPayableBlockReason,
  AccountsPayablePriority,
  AccountsPayableStatus,
  FinancialEntryWithholdingStatus,
  SupplierAdvanceType,
  TaxWithholdingType,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
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
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/**
 * Situação exibida do título — as onze da seção 4.
 *
 * `VENCIDO` e `BLOQUEADO` não são colunas do banco: chegam calculados. Ver a decisão em
 * `AccountsPayableStatus`, no schema.
 */
export const PAYABLE_SITUATIONS = [
  'OPEN',
  'SCHEDULED',
  'BANK_SCHEDULED',
  'AWAITING_PAYMENT',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
  'RENEGOTIATED',
  'CANCELLED',
  'REVERSED',
  'BLOCKED',
] as const;

export type PayableSituation = (typeof PAYABLE_SITUATIONS)[number];

// ── Consulta ─────────────────────────────────────────────────────────────────

/** Filtros da tela principal (seção 5). */
export class AccountsPayableQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Número do documento (busca parcial).' })
  @IsOptional()
  @IsString()
  documentNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  costCenterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  contractId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  responsibleUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  financialAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @ApiPropertyOptional({ enum: AccountsPayableStatus })
  @IsOptional()
  @IsEnum(AccountsPayableStatus)
  status?: AccountsPayableStatus;

  @ApiPropertyOptional({
    enum: PAYABLE_SITUATIONS,
    description:
      'Situação exibida. `OVERDUE` e `BLOCKED` são calculadas e por isso filtram por data e por bloqueio ativo, não por coluna de situação.',
  })
  @IsOptional()
  @IsEnum(PAYABLE_SITUATIONS)
  situation?: PayableSituation;

  @ApiPropertyOptional({ enum: AccountsPayablePriority })
  @IsOptional()
  @IsEnum(AccountsPayablePriority)
  priority?: AccountsPayablePriority;

  @ApiPropertyOptional({ description: 'Competência a partir de (AAAA-MM-DD).' })
  @IsOptional()
  @IsDateString()
  competenceFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  competenceTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  issueFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  issueTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  paidFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  paidTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxAmount?: number;

  @ApiPropertyOptional({ description: 'Rótulo da tag.' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({ description: 'Somente bloqueados.' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  blocked?: boolean;

  @ApiPropertyOptional({ description: 'Somente vencidos.' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  overdue?: boolean;
}

// ── Título ───────────────────────────────────────────────────────────────────

export class PayableInstallmentInputDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  installmentNumber: number;

  @ApiProperty({ example: '2026-08-10' })
  @IsDateString()
  dueDate: string;

  @ApiProperty({ example: 1500.5 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  barcode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  digitableLine?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/** Criação manual do título — para a obrigação que não chegou como documento. */
export class CreateAccountsPayableDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty()
  @IsUUID()
  companyId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierContractId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  documentType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  documentNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  documentSeries?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  competenceDate?: string;

  @ApiProperty({ example: 'Compra de insumos — julho' })
  @IsString()
  @IsNotEmpty({ message: 'Descreva o título.' })
  @MaxLength(300)
  description: string;

  @ApiProperty({
    description:
      'Parcelas do título. Um título à vista tem uma parcela — assim toda tela lê a mesma estrutura.',
    type: [PayableInstallmentInputDto],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Informe ao menos uma parcela.' })
  @ValidateNested({ each: true })
  @Type(() => PayableInstallmentInputDto)
  installments: PayableInstallmentInputDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  subcategoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  accountPlanId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  financialNatureId?: string;

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
  financialAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  responsibleUserId?: string;

  @ApiPropertyOptional({ enum: AccountsPayablePriority })
  @IsOptional()
  @IsEnum(AccountsPayablePriority)
  priority?: AccountsPayablePriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  purchaseOrderNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

/** Alteração do título. Campos sensíveis exigem justificativa (seção 18). */
export class UpdateAccountsPayableDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  competenceDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  subcategoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  accountPlanId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  financialNatureId?: string;

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
  financialAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  responsibleUserId?: string;

  @ApiPropertyOptional({ enum: AccountsPayablePriority })
  @IsOptional()
  @IsEnum(AccountsPayablePriority)
  priority?: AccountsPayablePriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  purchaseOrderNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description:
      'Obrigatória quando a empresa exige justificativa para o campo alterado.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  justification?: string;
}

// ── Parcelas ─────────────────────────────────────────────────────────────────

export class UpdatePayableInstallmentDto {
  @ApiPropertyOptional({
    description: 'Novo vencimento — antecipação ou prorrogação.',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  financialAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  barcode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  digitableLine?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  justification?: string;
}

/** Reparcelamento: substitui as parcelas ainda em aberto. */
export class ReinstallDto {
  @ApiProperty({ type: [PayableInstallmentInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PayableInstallmentInputDto)
  installments: PayableInstallmentInputDto[];

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo do reparcelamento.' })
  @MaxLength(500)
  justification: string;
}

// ── Programação de pagamento ─────────────────────────────────────────────────

export class SchedulePaymentDto {
  @ApiProperty({ example: '2026-08-05' })
  @IsDateString()
  scheduledPaymentDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  financialAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @ApiPropertyOptional({
    description: 'Parcelas a programar. Vazio = todas as que ainda devem.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  installmentIds?: string[];
}

// ── Pagamentos parciais ──────────────────────────────────────────────────────

export class PartialPaymentDto {
  @ApiPropertyOptional({
    description:
      'Parcela liquidada. Sem ela, o valor é rateado entre as parcelas em aberto.',
  })
  @IsOptional()
  @IsUUID()
  installmentId?: string;

  @ApiProperty({ example: 3000, description: 'Valor abatido do saldo.' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'O valor do pagamento precisa ser maior que zero.' })
  amount: number;

  @ApiProperty({ example: '2026-08-05' })
  @IsDateString()
  paidAt: string;

  @ApiPropertyOptional({ description: 'Juros efetivamente pagos.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  interestAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  penaltyAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  financialAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  receiptNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

// ── Ajustes ──────────────────────────────────────────────────────────────────

export class AdjustmentDto {
  @ApiProperty({ enum: AccountsPayableAdjustmentType })
  @IsEnum(AccountsPayableAdjustmentType)
  type: AccountsPayableAdjustmentType;

  @ApiProperty({ example: 83.2 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  installmentId?: string;

  @ApiPropertyOptional({
    description: 'Base do cálculo, para a memória de cálculo.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  calculationBase?: number;

  @ApiPropertyOptional({ description: 'Percentual aplicado.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  rate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  overdueDays?: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo do ajuste.' })
  @MaxLength(500)
  reason: string;
}

// ── Renegociação ─────────────────────────────────────────────────────────────

export class RenegotiateDto {
  @ApiProperty({
    description: 'Novo cronograma. Substitui as parcelas ainda em aberto.',
  })
  @IsArray()
  @ArrayMinSize(1, {
    message: 'Informe ao menos uma parcela no novo cronograma.',
  })
  @ValidateNested({ each: true })
  @Type(() => PayableInstallmentInputDto)
  installments: PayableInstallmentInputDto[];

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo da renegociação.' })
  @MaxLength(500)
  reason: string;

  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional()
  @IsDateString()
  effectiveAt?: string;

  @ApiPropertyOptional({ description: 'Juros incluídos no acordo.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  interestAdded?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  penaltyAdded?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountGranted?: number;
}

// ── Bloqueios ────────────────────────────────────────────────────────────────

export class BlockDto {
  @ApiProperty({ enum: AccountsPayableBlockReason })
  @IsEnum(AccountsPayableBlockReason)
  reason: AccountsPayableBlockReason;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UnblockDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo da liberação.' })
  @MaxLength(500)
  releaseReason: string;
}

// ── Ciclo de vida ────────────────────────────────────────────────────────────

export class ReasonDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo.' })
  @MaxLength(500)
  reason: string;
}

// ── Retenções ────────────────────────────────────────────────────────────────

export class PayableWithholdingDto {
  @ApiProperty({ enum: TaxWithholdingType })
  @IsEnum(TaxWithholdingType)
  taxType: TaxWithholdingType;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  calculationBase: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  rate: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo da revisão.' })
  @MaxLength(500)
  reason: string;
}

export class WithholdingDecisionDto {
  @ApiProperty({ enum: FinancialEntryWithholdingStatus })
  @IsEnum(FinancialEntryWithholdingStatus)
  status: FinancialEntryWithholdingStatus;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo da decisão.' })
  @MaxLength(500)
  reason: string;
}

// ── Adiantamentos ────────────────────────────────────────────────────────────

export class CreateAdvanceDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty()
  @IsUUID()
  companyId: string;

  @ApiProperty()
  @IsUUID()
  supplierId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierContractId?: string;

  @ApiPropertyOptional({ enum: SupplierAdvanceType })
  @IsOptional()
  @IsEnum(SupplierAdvanceType)
  type?: SupplierAdvanceType;

  @ApiProperty({ example: 5000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiProperty({ example: '2026-07-20' })
  @IsDateString()
  grantedAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  financialAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ApplyAdvanceDto {
  @ApiProperty()
  @IsUUID()
  advanceId: string;

  @ApiProperty({ example: 2000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  installmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class AdvanceQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Somente adiantamentos com saldo.' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  withBalance?: boolean;
}

// ── Comentários ──────────────────────────────────────────────────────────────

export class PayableCommentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Escreva o comentário.' })
  @MaxLength(2000)
  body: string;

  @ApiPropertyOptional({ description: 'Anexos já enviados ao bucket privado.' })
  @IsOptional()
  @IsArray()
  attachments?: {
    path: string;
    fileName: string;
    mimeType?: string;
    size?: number;
  }[];
}

// ── Parâmetros ───────────────────────────────────────────────────────────────

export class UpdateAccountsPayableSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoGenerateOnApproval?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(6)
  codePrefix?: string;

  @ApiPropertyOptional({ description: 'Juros ao mês, em percentual.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  defaultMonthlyInterestRate?: number | null;

  @ApiPropertyOptional({ description: 'Multa por atraso, em percentual.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  defaultPenaltyRate?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(90)
  gracePeriodDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowPartialPayment?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requireJustificationOnDueDateChange?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requireJustificationOnAmountChange?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoBlockWhenDocumentPending?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3650)
  reopenWindowDays?: number | null;

  @ApiPropertyOptional({ enum: AccountsPayablePriority })
  @IsOptional()
  @IsEnum(AccountsPayablePriority)
  defaultPriority?: AccountsPayablePriority;
}
