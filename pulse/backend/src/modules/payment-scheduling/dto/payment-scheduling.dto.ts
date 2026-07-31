import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BankPaymentType,
  PaymentBatchStatus,
  PaymentScheduleBlockReason,
  PaymentSchedulePriority,
  PaymentScheduleStatus,
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
 * As nove situações da seção 4.
 *
 * `RESCHEDULED` e `BLOCKED` chegam calculadas — ver a decisão em `PaymentScheduleStatus`,
 * no schema.
 */
export const SCHEDULE_SITUATIONS = [
  'PENDING_SCHEDULING',
  'SCHEDULED',
  'RESCHEDULED',
  'IN_BATCH',
  'READY_TO_SEND',
  'BLOCKED',
  'CANCELLED',
  'SENT',
  'EXECUTED',
] as const;

export type ScheduleSituation = (typeof SCHEDULE_SITUATIONS)[number];

// ── Consulta ─────────────────────────────────────────────────────────────────

export class PaymentScheduleQueryDto extends PaginationQueryDto {
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
  financialAccountId?: string;

  @ApiPropertyOptional({
    description: 'Instituição financeira da conta de origem.',
  })
  @IsOptional()
  @IsUUID()
  financialInstitutionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;

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
  responsibleUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  batchId?: string;

  @ApiPropertyOptional({ enum: PaymentScheduleStatus })
  @IsOptional()
  @IsEnum(PaymentScheduleStatus)
  status?: PaymentScheduleStatus;

  @ApiPropertyOptional({ enum: SCHEDULE_SITUATIONS })
  @IsOptional()
  @IsEnum(SCHEDULE_SITUATIONS)
  situation?: ScheduleSituation;

  @ApiPropertyOptional({ enum: PaymentSchedulePriority })
  @IsOptional()
  @IsEnum(PaymentSchedulePriority)
  priority?: PaymentSchedulePriority;

  @ApiPropertyOptional({ enum: BankPaymentType })
  @IsOptional()
  @IsEnum(BankPaymentType)
  bankPaymentType?: BankPaymentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledTo?: string;

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

  @ApiPropertyOptional({ description: 'Somente programações bloqueadas.' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  blocked?: boolean;

  @ApiPropertyOptional({
    description: 'Somente programações já reprogramadas.',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  rescheduled?: boolean;
}

/** Títulos ainda sem programação, para montar a fila. */
export class SchedulableQueryDto extends PaginationQueryDto {
  @ApiProperty()
  @IsUUID()
  companyId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Vencimento até (AAAA-MM-DD).' })
  @IsOptional()
  @IsDateString()
  dueTo?: string;
}

// ── Programação ──────────────────────────────────────────────────────────────

export class CreatePaymentScheduleDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty()
  @IsUUID()
  companyId: string;

  @ApiProperty({ description: 'Título a programar.' })
  @IsUUID()
  payableId: string;

  @ApiPropertyOptional({
    description:
      'Parcelas a incluir. Vazio: todas as parcelas do título que ainda têm saldo e não estão em outra programação.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  installmentIds?: string[];

  @ApiPropertyOptional({ example: '2026-08-05' })
  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  financialAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @ApiPropertyOptional({ enum: BankPaymentType })
  @IsOptional()
  @IsEnum(BankPaymentType)
  bankPaymentType?: BankPaymentType;

  @ApiPropertyOptional({ enum: PaymentSchedulePriority })
  @IsOptional()
  @IsEnum(PaymentSchedulePriority)
  priority?: PaymentSchedulePriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  responsibleUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

/** Programação individual (seção 6). */
export class UpdatePaymentScheduleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  financialAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @ApiPropertyOptional({ enum: BankPaymentType })
  @IsOptional()
  @IsEnum(BankPaymentType)
  bankPaymentType?: BankPaymentType;

  @ApiPropertyOptional({ enum: PaymentSchedulePriority })
  @IsOptional()
  @IsEnum(PaymentSchedulePriority)
  priority?: PaymentSchedulePriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  responsibleUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({ description: 'Posição na fila. Menor sai primeiro.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  queuePosition?: number;
}

/** Reprogramação (seção 13). */
export class RescheduleDto {
  @ApiProperty({ example: '2026-08-12' })
  @IsDateString()
  scheduledDate: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo da reprogramação.' })
  @MaxLength(500)
  reason: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  financialAccountId?: string;

  @ApiPropertyOptional({ enum: BankPaymentType })
  @IsOptional()
  @IsEnum(BankPaymentType)
  bankPaymentType?: BankPaymentType;

  @ApiPropertyOptional({ enum: PaymentSchedulePriority })
  @IsOptional()
  @IsEnum(PaymentSchedulePriority)
  priority?: PaymentSchedulePriority;

  @ApiPropertyOptional({ description: 'Novo lote. Nulo tira do lote atual.' })
  @IsOptional()
  @IsUUID()
  batchId?: string;
}

export class BlockScheduleDto {
  @ApiProperty({ enum: PaymentScheduleBlockReason })
  @IsEnum(PaymentScheduleBlockReason)
  reason: PaymentScheduleBlockReason;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UnblockScheduleDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo da liberação.' })
  @MaxLength(500)
  releaseReason: string;
}

export class ReasonDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo.' })
  @MaxLength(500)
  reason: string;
}

// ── Ações em lote (seção 7) ──────────────────────────────────────────────────

export class BulkScheduleDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Selecione ao menos uma programação.' })
  @IsUUID('4', { each: true })
  scheduleIds: string[];

  @ApiPropertyOptional({ description: 'Nova data para todas.' })
  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  financialAccountId?: string;

  @ApiPropertyOptional({ enum: BankPaymentType })
  @IsOptional()
  @IsEnum(BankPaymentType)
  bankPaymentType?: BankPaymentType;

  @ApiPropertyOptional({ enum: PaymentSchedulePriority })
  @IsOptional()
  @IsEnum(PaymentSchedulePriority)
  priority?: PaymentSchedulePriority;

  @ApiPropertyOptional({
    description:
      'Motivo. Obrigatório quando a alteração muda a data de uma já programada.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class BulkCancelDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  scheduleIds: string[];

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo do cancelamento.' })
  @MaxLength(500)
  reason: string;
}

/** Reordenação manual da fila (seção 9). */
export class ReorderQueueDto {
  @ApiProperty({
    description:
      'Ids na ordem desejada. A posição de cada um vira o índice na lista.',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  scheduleIds: string[];
}

// ── Lotes (seção 8) ──────────────────────────────────────────────────────────

export class CreatePaymentBatchDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty()
  @IsUUID()
  companyId: string;

  @ApiProperty({
    description: 'Conta de origem. Um lote é sempre de uma conta só.',
  })
  @IsUUID()
  financialAccountId: string;

  @ApiProperty({ example: '2026-08-05' })
  @IsDateString()
  scheduledDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: BankPaymentType })
  @IsOptional()
  @IsEnum(BankPaymentType)
  bankPaymentType?: BankPaymentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  responsibleUserId?: string;

  @ApiPropertyOptional({
    description: 'Programações já incluídas na criação.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  scheduleIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdatePaymentBatchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  responsibleUserId?: string;

  @ApiPropertyOptional({ enum: PaymentBatchStatus })
  @IsOptional()
  @IsEnum(PaymentBatchStatus)
  status?: PaymentBatchStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class BatchMembershipDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  scheduleIds: string[];
}

export class PaymentBatchQueryDto extends PaginationQueryDto {
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
  financialAccountId?: string;

  @ApiPropertyOptional({ enum: PaymentBatchStatus })
  @IsOptional()
  @IsEnum(PaymentBatchStatus)
  status?: PaymentBatchStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledTo?: string;
}

// ── Simulação (seção 10) ─────────────────────────────────────────────────────

export class SimulationChangeDto {
  @ApiProperty()
  @IsUUID()
  scheduleId: string;

  @ApiPropertyOptional({ description: 'Data hipotética.' })
  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @ApiPropertyOptional({ description: 'Conta hipotética.' })
  @IsOptional()
  @IsUUID()
  financialAccountId?: string;

  @ApiPropertyOptional({
    description: 'Tirar da simulação, como se fosse cancelada.',
  })
  @IsOptional()
  @IsBoolean()
  excluded?: boolean;
}

export class SimulationDto {
  @ApiProperty()
  @IsUUID()
  companyId: string;

  @ApiProperty({ example: '2026-08-01' })
  @IsDateString()
  from: string;

  @ApiProperty({ example: '2026-08-31' })
  @IsDateString()
  to: string;

  @ApiPropertyOptional({
    description: 'Alterações hipotéticas. Nada é gravado.',
    type: [SimulationChangeDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SimulationChangeDto)
  changes?: SimulationChangeDto[];

  @ApiPropertyOptional({
    description: 'Considerar limites contratados como caixa.',
  })
  @IsOptional()
  @IsBoolean()
  considerCreditLimits?: boolean;
}

// ── Comentários e parâmetros ─────────────────────────────────────────────────

export class ScheduleCommentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Escreva o comentário.' })
  @MaxLength(2000)
  body: string;
}

export class UpdatePaymentScheduleSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8)
  schedulePrefix?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8)
  batchPrefix?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  blockOnInsufficientBalance?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  considerCreditLimits?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  blockRetroactiveDates?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30)
  minimumLeadTimeDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requireReasonOnReschedule?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  defaultFinancialAccountId?: string | null;

  @ApiPropertyOptional({ enum: BankPaymentType })
  @IsOptional()
  @IsEnum(BankPaymentType)
  defaultBankPaymentType?: BankPaymentType | null;

  @ApiPropertyOptional({ enum: PaymentSchedulePriority })
  @IsOptional()
  @IsEnum(PaymentSchedulePriority)
  defaultPriority?: PaymentSchedulePriority;
}
