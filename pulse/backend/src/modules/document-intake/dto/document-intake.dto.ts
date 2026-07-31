import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IntakeDocumentDirection,
  IntakeDocumentType,
  IntakeDuplicateStatus,
  IntakeIssueSeverity,
  IntakeIssueStatus,
  IntakeIssueType,
  IntakePriority,
  IntakeProcessingStatus,
  IntakeRejectionReason,
  IntakeRelationType,
  IntakeReviewStatus,
  IntakeSourceChannel,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
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

/** Converte `"true"`/`"false"` de query string em booleano de verdade. */
const toBoolean = () =>
  Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  });

// ── Envio ───────────────────────────────────────────────────────────────────

export class UploadIntakeDocumentDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty({ description: 'Empresa de destino do documento.' })
  @IsUUID()
  companyId: string;

  @ApiPropertyOptional({ enum: IntakeSourceChannel })
  @IsOptional()
  @IsEnum(IntakeSourceChannel)
  sourceChannel?: IntakeSourceChannel;

  @ApiPropertyOptional({
    enum: IntakeDocumentType,
    description:
      'Tipo informado pelo usuário. Vazio, o sistema classifica automaticamente.',
  })
  @IsOptional()
  @IsEnum(IntakeDocumentType)
  documentType?: IntakeDocumentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ enum: IntakePriority })
  @IsOptional()
  @IsEnum(IntakePriority)
  priority?: IntakePriority;

  @ApiPropertyOptional({ description: 'Lote ao qual este arquivo pertence.' })
  @IsOptional()
  @IsUUID()
  batchImportId?: string;
}

/**
 * Digitação manual (seção 14).
 *
 * Mesmo sem arquivo, o documento entra no fluxo com a mesma auditoria — não há atalho que
 * pule as validações.
 */
export class ManualEntryDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty()
  @IsUUID()
  companyId: string;

  @ApiProperty({ enum: IntakeDocumentType })
  @IsEnum(IntakeDocumentType)
  documentType: IntakeDocumentType;

  @ApiPropertyOptional({ enum: IntakeDocumentDirection })
  @IsOptional()
  @IsEnum(IntakeDocumentDirection)
  documentDirection?: IntakeDocumentDirection;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ example: '12345' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  documentNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ example: 2450 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  grossAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  netAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

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
  paymentMethodId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  receiptMethodId?: string;

  @ApiPropertyOptional({ description: 'Código de barras de 44 dígitos.' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  barcode?: string;

  @ApiPropertyOptional({ description: 'Linha digitável de 47 ou 48 dígitos.' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  digitableLine?: string;

  @ApiPropertyOptional({ enum: IntakePriority })
  @IsOptional()
  @IsEnum(IntakePriority)
  priority?: IntakePriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedUserId?: string;
}

// ── Consulta ────────────────────────────────────────────────────────────────

/** Filtros da caixa de entrada (seção 33). */
export class IntakeDocumentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({
    description: 'Somente documentos cuja empresa não foi identificada.',
  })
  @IsOptional()
  @toBoolean()
  @IsBoolean()
  unassignedCompany?: boolean;

  @ApiPropertyOptional({ enum: IntakeProcessingStatus })
  @IsOptional()
  @IsEnum(IntakeProcessingStatus)
  processingStatus?: IntakeProcessingStatus;

  @ApiPropertyOptional({ enum: IntakeReviewStatus })
  @IsOptional()
  @IsEnum(IntakeReviewStatus)
  reviewStatus?: IntakeReviewStatus;

  @ApiPropertyOptional({ enum: IntakeDocumentType })
  @IsOptional()
  @IsEnum(IntakeDocumentType)
  documentType?: IntakeDocumentType;

  @ApiPropertyOptional({ enum: IntakeDocumentDirection })
  @IsOptional()
  @IsEnum(IntakeDocumentDirection)
  documentDirection?: IntakeDocumentDirection;

  @ApiPropertyOptional({ enum: IntakeSourceChannel })
  @IsOptional()
  @IsEnum(IntakeSourceChannel)
  sourceChannel?: IntakeSourceChannel;

  @ApiPropertyOptional({ enum: IntakeDuplicateStatus })
  @IsOptional()
  @IsEnum(IntakeDuplicateStatus)
  duplicateStatus?: IntakeDuplicateStatus;

  @ApiPropertyOptional({ enum: IntakePriority })
  @IsOptional()
  @IsEnum(IntakePriority)
  priority?: IntakePriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  batchImportId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @toBoolean()
  @IsBoolean()
  hasIssues?: boolean;

  @ApiPropertyOptional({
    description: 'Somente documentos com pendência bloqueante aberta.',
  })
  @IsOptional()
  @toBoolean()
  @IsBoolean()
  hasBlockingIssues?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  minimumConfidence?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  maximumConfidence?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  receivedFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  receivedTo?: string;

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
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  minimumAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  maximumAmount?: number;
}

// ── Edição e revisão ────────────────────────────────────────────────────────

/** Campos editáveis na revisão (seção 37). */
export class UpdateIntakeDocumentDto {
  @ApiPropertyOptional({ enum: IntakeDocumentType })
  @IsOptional()
  @IsEnum(IntakeDocumentType)
  documentType?: IntakeDocumentType;

  @ApiPropertyOptional({ enum: IntakeDocumentDirection })
  @IsOptional()
  @IsEnum(IntakeDocumentDirection)
  documentDirection?: IntakeDocumentDirection;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  documentNumber?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  documentSeries?: string | null;

  @ApiPropertyOptional({
    description: 'Chave de acesso de 44 dígitos (NF-e/CT-e).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  accessKey?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  issueDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  competenceDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  grossAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional()
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
  withholdingAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  netAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @ApiPropertyOptional({ enum: IntakePriority })
  @IsOptional()
  @IsEnum(IntakePriority)
  priority?: IntakePriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  subcategoryId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  accountPlanId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  costCenterId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  resultCenterId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  businessUnitId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  financialNatureId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  financialAccountId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  paymentMethodId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  receiptMethodId?: string | null;
}

export class ReviewDocumentDto {
  @ApiPropertyOptional({ enum: IntakeReviewStatus })
  @IsOptional()
  @IsEnum(IntakeReviewStatus)
  reviewStatus?: IntakeReviewStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({
    description:
      'Confirma que o fornecedor identificado está correto, ensinando o reconhecimento para os próximos documentos.',
  })
  @IsOptional()
  @IsBoolean()
  confirmSupplierRecognition?: boolean;
}

export class ForwardDocumentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class RejectDocumentDto {
  @ApiProperty({ enum: IntakeRejectionReason })
  @IsEnum(IntakeRejectionReason)
  rejectionReason: IntakeRejectionReason;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class ReasonDto {
  @ApiProperty({ example: 'Documento pertence à outra empresa do grupo.' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo.' })
  @MaxLength(500)
  reason: string;
}

export class ChangeCompanyDto extends ReasonDto {
  @ApiProperty()
  @IsUUID()
  companyId: string;
}

export class AssignDocumentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedTeamId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

// ── Divisão e relações ──────────────────────────────────────────────────────

export class SplitInstallmentDto {
  @ApiProperty({ example: 816.67 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiProperty({ example: '2026-09-10' })
  @IsDateString()
  dueDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  documentNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class SplitDocumentDto {
  @ApiProperty({ type: [SplitInstallmentDto] })
  @IsArray()
  @ArrayMinSize(2, { message: 'Informe pelo menos duas parcelas.' })
  @ValidateNested({ each: true })
  @Type(() => SplitInstallmentDto)
  installments: SplitInstallmentDto[];
}

export class RelateDocumentDto {
  @ApiProperty()
  @IsUUID()
  targetDocumentId: string;

  @ApiProperty({ enum: IntakeRelationType })
  @IsEnum(IntakeRelationType)
  relationType: IntakeRelationType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

// ── Pendências ──────────────────────────────────────────────────────────────

export class CreateIssueDto {
  @ApiProperty({ enum: IntakeIssueType })
  @IsEnum(IntakeIssueType)
  issueType: IntakeIssueType;

  @ApiPropertyOptional({ enum: IntakeIssueSeverity })
  @IsOptional()
  @IsEnum(IntakeIssueSeverity)
  severity?: IntakeIssueSeverity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fieldName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedUserId?: string;
}

export class UpdateIssueDto {
  @ApiPropertyOptional({ enum: IntakeIssueSeverity })
  @IsOptional()
  @IsEnum(IntakeIssueSeverity)
  severity?: IntakeIssueSeverity;

  @ApiPropertyOptional({ enum: IntakeIssueStatus })
  @IsOptional()
  @IsEnum(IntakeIssueStatus)
  status?: IntakeIssueStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedUserId?: string | null;
}

export class ResolveIssueDto {
  @ApiProperty({ example: 'Fornecedor cadastrado e vinculado ao documento.' })
  @IsString()
  @IsNotEmpty({ message: 'Informe como a pendência foi resolvida.' })
  @MaxLength(1000)
  resolution: string;
}

// ── Duplicidade ─────────────────────────────────────────────────────────────

export class DuplicateDecisionDto {
  @ApiPropertyOptional({
    description:
      'Obrigatório para liberar suspeitas de alta semelhança (a partir de 75 pontos).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

// ── Boleto ──────────────────────────────────────────────────────────────────

export class ValidateBoletoDto {
  @ApiProperty({
    example: '00190500954014481606906809350314337370000000100',
    description:
      'Linha digitável (47/48 dígitos) ou código de barras (44 dígitos).',
  })
  @IsString()
  @IsNotEmpty({ message: 'Informe o código de barras ou a linha digitável.' })
  @MaxLength(80)
  code: string;
}

export class CompareBoletoDto extends ValidateBoletoDto {
  @ApiPropertyOptional({
    description: 'Valor informado pelo usuário, para comparação.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  amount?: number;

  @ApiPropertyOptional({ description: 'Vencimento informado pelo usuário.' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

// ── Campos extraídos ────────────────────────────────────────────────────────

export class UpdateExtractedFieldDto {
  @ApiProperty({ example: '2450.00' })
  @IsString()
  @MaxLength(2000)
  normalizedValue: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  originalValue?: string;
}

// ── Ações em lote (seção 76) ────────────────────────────────────────────────

export class BatchActionDto {
  @ApiProperty({ type: [String], description: 'Documentos alvo da ação.' })
  @IsArray()
  @ArrayMinSize(1, { message: 'Selecione ao menos um documento.' })
  @IsUUID('4', { each: true })
  documentIds: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class BatchAssignDto extends BatchActionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedTeamId?: string;
}

export class BatchClassifyDto extends BatchActionDto {
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

  @ApiPropertyOptional({ enum: IntakePriority })
  @IsOptional()
  @IsEnum(IntakePriority)
  priority?: IntakePriority;
}

export class BatchRejectDto extends BatchActionDto {
  @ApiProperty({ enum: IntakeRejectionReason })
  @IsEnum(IntakeRejectionReason)
  rejectionReason: IntakeRejectionReason;
}

// ── Parâmetros (seção 77) ───────────────────────────────────────────────────

export class UpdateDocumentIntakeSettingsDto {
  @ApiPropertyOptional({
    example: 20971520,
    description: 'Tamanho máximo em bytes.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1024)
  maximumFileSize?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  maximumFilesPerUpload?: number;

  @ApiPropertyOptional({ type: [String], example: ['pdf', 'xml', 'jpg'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedExtensions?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ocrEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  barcodeReadingEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  duplicateValidationEnabled?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  minimumConfidence?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  highConfidenceThreshold?: number;

  @ApiPropertyOptional({
    description:
      'A recomendação é manter ligado: revisão humana obrigatória antes do encaminhamento.',
  })
  @IsOptional()
  @IsBoolean()
  mandatoryReview?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoForwardHighConfidence?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  quickSupplierCreationEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  quickCustomerCreationEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requireCategory?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requireCostCenter?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requireProject?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  blockDuplicates?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  blockInvalidBarcode?: boolean;

  @ApiPropertyOptional({ example: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  reviewDeadlineHours?: number;

  @ApiPropertyOptional({ example: 1825 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  retentionDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowFileReplacement?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowDraftDeletion?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  defaultAssignedUserId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  defaultAssignedTeamId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;
}
