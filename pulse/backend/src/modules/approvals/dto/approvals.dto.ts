import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ApprovalApproverType,
  ApprovalDelegationReason,
  ApprovalNotificationChannel,
  ApprovalPriority,
  ApprovalRequestStatus,
  FinancialEntryDirection,
  IntakeDocumentType,
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

// ── Fluxos ───────────────────────────────────────────────────────────────────

export class ApprovalFlowStepDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  stepOrder: number;

  @ApiProperty({ example: 'Supervisor' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome da etapa.' })
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ enum: ApprovalApproverType })
  @IsOptional()
  @IsEnum(ApprovalApproverType)
  approverType?: ApprovalApproverType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  approverUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  approverRoleId?: string;

  @ApiPropertyOptional({
    description:
      'Quantas aprovações distintas a etapa exige. 2 = dupla aprovação.',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  requiredApprovals?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @ApiPropertyOptional({
    description: 'Alçada: valor a partir do qual esta etapa entra no fluxo.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minimumAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maximumAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  deadlineHours?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  blockSelfApproval?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreateApprovalFlowDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty()
  @IsUUID()
  companyId: string;

  @ApiProperty({ example: 'Compra de alimentos' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do fluxo.' })
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

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
  businessUnitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  financialNatureId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  contractId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @ApiPropertyOptional({ enum: IntakeDocumentType })
  @IsOptional()
  @IsEnum(IntakeDocumentType)
  documentType?: IntakeDocumentType;

  @ApiPropertyOptional({ enum: FinancialEntryDirection })
  @IsOptional()
  @IsEnum(FinancialEntryDirection)
  direction?: FinancialEntryDirection;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minimumAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maximumAmount?: number;

  @ApiPropertyOptional({ enum: ApprovalPriority })
  @IsOptional()
  @IsEnum(ApprovalPriority)
  minimumPriority?: ApprovalPriority;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  priority?: number;

  @ApiPropertyOptional({ default: 48 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  defaultDeadlineHours?: number;

  @ApiPropertyOptional({ enum: ApprovalNotificationChannel, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(ApprovalNotificationChannel, { each: true })
  notificationChannels?: ApprovalNotificationChannel[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiProperty({ type: [ApprovalFlowStepDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'O fluxo precisa de pelo menos uma etapa.' })
  @ValidateNested({ each: true })
  @Type(() => ApprovalFlowStepDto)
  steps: ApprovalFlowStepDto[];
}

export class UpdateApprovalFlowDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  priority?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  defaultDeadlineHours?: number;

  @ApiPropertyOptional({ enum: ApprovalNotificationChannel, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(ApprovalNotificationChannel, { each: true })
  notificationChannels?: ApprovalNotificationChannel[];

  @ApiPropertyOptional({ description: 'ACTIVE ou INACTIVE.' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    type: [ApprovalFlowStepDto],
    description:
      'Quando informado, substitui todas as etapas. Solicitações em andamento não são afetadas.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApprovalFlowStepDto)
  steps?: ApprovalFlowStepDto[];
}

// ── Solicitações ─────────────────────────────────────────────────────────────

export class ApprovalQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ enum: ApprovalRequestStatus })
  @IsOptional()
  @IsEnum(ApprovalRequestStatus)
  status?: ApprovalRequestStatus;

  @ApiPropertyOptional({ enum: ApprovalPriority })
  @IsOptional()
  @IsEnum(ApprovalPriority)
  priority?: ApprovalPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  flowId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  entryId?: string;

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

  @ApiPropertyOptional({ description: 'Apenas as designadas a este usuário.' })
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;

  @ApiPropertyOptional({
    description: 'Apenas as que passaram da data limite.',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  overdue?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minimumAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maximumAmount?: number;
}

export class DecisionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class ReasonDto {
  @ApiProperty({ example: 'Valor acima do orçado para a categoria.' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo.' })
  @MaxLength(2000)
  reason: string;
}

export class CommentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  text?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  stepOrder?: number;

  @ApiPropertyOptional({ description: 'IDs de anexos já enviados.' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  attachmentIds?: string[];
}

export class DelegateRequestDto {
  @ApiProperty()
  @IsUUID()
  delegateId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ForwardRequestDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class PriorityDto {
  @ApiProperty({ enum: ApprovalPriority })
  @IsEnum(ApprovalPriority)
  priority: ApprovalPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class OpenApprovalDto {
  @ApiPropertyOptional({ enum: ApprovalPriority })
  @IsOptional()
  @IsEnum(ApprovalPriority)
  priority?: ApprovalPriority;
}

export class BatchApprovalDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Selecione pelo menos uma solicitação.' })
  @IsUUID('4', { each: true })
  requestIds: string[];

  @ApiProperty({ enum: ['APPROVE', 'REJECT', 'DELEGATE', 'PRIORITY'] })
  @IsEnum(['APPROVE', 'REJECT', 'DELEGATE', 'PRIORITY'] as never)
  action: 'APPROVE' | 'REJECT' | 'DELEGATE' | 'PRIORITY';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  delegateId?: string;

  @ApiPropertyOptional({ enum: ApprovalPriority })
  @IsOptional()
  @IsEnum(ApprovalPriority)
  priority?: ApprovalPriority;
}

// ── Delegações ───────────────────────────────────────────────────────────────

export class CreateDelegationDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty()
  @IsUUID()
  companyId: string;

  @ApiProperty({ description: 'Quem está delegando.' })
  @IsUUID()
  delegatorId: string;

  @ApiProperty({ description: 'Quem passa a poder aprovar no lugar.' })
  @IsUUID()
  delegateId: string;

  @ApiPropertyOptional({ enum: ApprovalDelegationReason })
  @IsOptional()
  @IsEnum(ApprovalDelegationReason)
  reason?: ApprovalDelegationReason;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: '2026-08-01' })
  @IsDateString()
  startsAt: string;

  @ApiProperty({ example: '2026-08-15' })
  @IsDateString()
  endsAt: string;

  @ApiPropertyOptional({ description: 'Teto próprio da delegação.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maximumAmount?: number;
}

export class DelegationQueryDto extends PaginationQueryDto {
  @ApiProperty()
  @IsUUID()
  companyId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  delegatorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  delegateId?: string;

  @ApiPropertyOptional({ description: 'Apenas as vigentes hoje.' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  activeOnly?: boolean;
}

// ── Parâmetros ───────────────────────────────────────────────────────────────

export class UpdateApprovalSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requireApprovalForAll?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  mandatoryAboveAmount?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  blockSelfApprovalGlobally?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enforceIndividualLimit?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  expireOverdueRequests?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  defaultDeadlineHours?: number;

  @ApiPropertyOptional({ enum: ApprovalNotificationChannel, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(ApprovalNotificationChannel, { each: true })
  notificationChannels?: ApprovalNotificationChannel[];
}
