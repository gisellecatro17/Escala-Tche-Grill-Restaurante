import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BankStatementImportStatus,
  BankStatementSourceType,
  BankTransactionDirection,
  BankTransactionReconciliationStatus,
  BankTransactionType,
  DuplicateStatus,
  ReconcilableEntityType,
  ReconciliationCommentVisibility,
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
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

// ── Importação ───────────────────────────────────────────────────────────────

/** Opções de leitura de um arquivo tabular, quando não vêm de um modelo salvo. */
export class TabularOptionsDto {
  @ApiPropertyOptional({ example: ';' })
  @IsOptional()
  @IsString()
  @MaxLength(4)
  delimiter?: string;

  @ApiPropertyOptional({ example: 'utf8' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  encoding?: string;

  @ApiPropertyOptional({ example: 'DD/MM/YYYY' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  dateFormat?: string;

  @ApiPropertyOptional({ example: ',' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  decimalSeparator?: string;

  @ApiPropertyOptional({ example: '.' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  thousandSeparator?: string;

  @ApiPropertyOptional({
    description: 'Linha do cabeçalho (base 1). Nulo = sem cabeçalho.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  headerRow?: number | null;

  @ApiPropertyOptional({ description: 'Primeira linha de dados (base 1).' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dataStartRow?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  footerRowsToIgnore?: number;

  @ApiPropertyOptional({
    description: 'Mapa `campoDoPulse -> nome ou índice da coluna`.',
    example: {
      transactionDate: 'Data',
      description: 'Histórico',
      credit: 'Crédito',
    },
  })
  @IsOptional()
  @IsObject()
  columnMapping?: Record<string, string | number>;

  @ApiPropertyOptional({
    description:
      'Como o sentido é determinado. `CREDIT_DEBIT_COLUMNS`, `SIGNED_AMOUNT` ou `TYPE_COLUMN`.',
  })
  @IsOptional()
  @IsObject()
  signRule?: Record<string, unknown>;
}

/** Corpo do upload (multipart). O arquivo vem em `file`. */
export class CreateImportDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty()
  @IsUUID()
  companyId: string;

  @ApiProperty()
  @IsUUID()
  financialAccountId: string;

  @ApiPropertyOptional({ enum: BankStatementSourceType })
  @IsOptional()
  @IsEnum(BankStatementSourceType)
  sourceType?: BankStatementSourceType;

  @ApiPropertyOptional({ description: 'Modelo de importação salvo.' })
  @IsOptional()
  @IsUUID()
  importTemplateId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  statementStartDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  statementEndDate?: string;

  @ApiPropertyOptional({
    description: 'Saldo inicial informado por quem importa.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  openingBalance?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  closingBalance?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({ type: TabularOptionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TabularOptionsDto)
  options?: TabularOptionsDto;
}

/** Confirmação da importação depois da prévia. */
export class ConfirmImportDto {
  @ApiPropertyOptional({
    description: 'Linhas a descartar, pelo número da linha do arquivo.',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  skipLines?: number[];

  @ApiPropertyOptional({
    description:
      'Justificativa para importar apesar da duplicidade. Exige `reconciliation.override_duplicate`.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  duplicateOverrideReason?: string;

  @ApiPropertyOptional({
    description: 'Importar mesmo com transações duplicadas.',
  })
  @IsOptional()
  @IsBoolean()
  importDuplicates?: boolean;
}

export class ImportQueryDto extends PaginationQueryDto {
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

  @ApiPropertyOptional({ enum: BankStatementImportStatus })
  @IsOptional()
  @IsEnum(BankStatementImportStatus)
  status?: BankStatementImportStatus;

  @ApiPropertyOptional({ enum: BankStatementSourceType })
  @IsOptional()
  @IsEnum(BankStatementSourceType)
  sourceType?: BankStatementSourceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  periodFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  periodTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  importedBy?: string;

  @ApiPropertyOptional({ description: 'Somente importações com erro.' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasError?: boolean;

  @ApiPropertyOptional({
    description: 'Somente importações com duplicidade detectada.',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasDuplicate?: boolean;
}

export class ReasonDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo.' })
  @MaxLength(500)
  reason: string;
}

// ── Transações ───────────────────────────────────────────────────────────────

export class TransactionQueryDto extends PaginationQueryDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  statementImportId?: string;

  @ApiPropertyOptional({ enum: BankTransactionDirection })
  @IsOptional()
  @IsEnum(BankTransactionDirection)
  direction?: BankTransactionDirection;

  @ApiPropertyOptional({ enum: BankTransactionType })
  @IsOptional()
  @IsEnum(BankTransactionType)
  transactionType?: BankTransactionType;

  @ApiPropertyOptional({ enum: BankTransactionReconciliationStatus })
  @IsOptional()
  @IsEnum(BankTransactionReconciliationStatus)
  reconciliationStatus?: BankTransactionReconciliationStatus;

  @ApiPropertyOptional({ enum: DuplicateStatus })
  @IsOptional()
  @IsEnum(DuplicateStatus)
  duplicateStatus?: DuplicateStatus;

  @ApiPropertyOptional({ enum: BankStatementSourceType })
  @IsOptional()
  @IsEnum(BankStatementSourceType)
  sourceType?: BankStatementSourceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedUserId?: string;

  @ApiPropertyOptional({
    description: 'Somente movimentações digitadas à mão.',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isManual?: boolean;

  @ApiPropertyOptional({
    description: 'Somente as que ainda precisam de conciliação.',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  pendingOnly?: boolean;
}

/** Digitação manual de movimentação (seção 16). */
export class ManualTransactionDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty()
  @IsUUID()
  companyId: string;

  @ApiProperty()
  @IsUUID()
  financialAccountId: string;

  @ApiProperty({ example: '2026-07-15' })
  @IsDateString()
  transactionDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  postingDate?: string;

  @ApiProperty({ enum: BankTransactionDirection })
  @IsEnum(BankTransactionDirection)
  direction: BankTransactionDirection;

  @ApiProperty({
    example: 1500.5,
    description: 'Sempre positivo. O sentido é `direction`.',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ enum: BankTransactionType })
  @IsOptional()
  @IsEnum(BankTransactionType)
  transactionType?: BankTransactionType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe o histórico da movimentação.' })
  @MaxLength(500)
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  documentNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalTransactionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  payerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  payeeName?: string;

  @ApiProperty({
    description:
      'Por que a movimentação está sendo digitada em vez de importada. Obrigatório.',
  })
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo da inclusão manual.' })
  @MaxLength(500)
  manualReason: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateTransactionDto {
  @ApiPropertyOptional({ enum: BankTransactionType })
  @IsOptional()
  @IsEnum(BankTransactionType)
  transactionType?: BankTransactionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  documentNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  payerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  payeeName?: string;

  @ApiPropertyOptional({ description: 'Justificativa da alteração manual.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AssignTransactionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedUserId?: string;

  @ApiPropertyOptional({ description: 'Equipe, setor ou fila.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  assignedTeam?: string;

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

// ── Sugestões ────────────────────────────────────────────────────────────────

export class GenerateSuggestionsDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiPropertyOptional({
    description:
      'Transações a processar. Vazio: todas as pendentes da empresa.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  transactionIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  financialAccountId?: string;

  @ApiPropertyOptional({
    description: 'Limite de transações processadas por chamada.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class DismissSuggestionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo do descarte.' })
  @MaxLength(500)
  reason: string;
}

/**
 * Aceite de sugestão.
 *
 * Nenhum campo é obrigatório: aceitar já é a decisão. A justificativa só passa a ser
 * exigida — pelo serviço, não por aqui — quando existe diferença fora da tolerância.
 */
export class AcceptSuggestionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({
    description: 'Justificativa da diferença, quando houver.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  differenceReason?: string;
}

// ── Conciliação ──────────────────────────────────────────────────────────────

export class ReconciliationEntryDto {
  @ApiProperty({ enum: ReconcilableEntityType })
  @IsEnum(ReconcilableEntityType)
  entityType: ReconcilableEntityType;

  @ApiProperty()
  @IsUUID()
  entityId: string;

  @ApiProperty({
    example: 8500,
    description: 'Valor alocado a este lançamento.',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  allocatedAmount: number;

  @ApiPropertyOptional({
    description: 'Papel do item: principal, juros, tarifa.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  relationType?: string;
}

/** Conciliação manual (seções 32 a 36). */
export class CreateReconciliationDto {
  @ApiProperty({
    description:
      'Transações bancárias envolvidas. Mais de uma = muitos-para-um.',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Selecione ao menos uma transação bancária.' })
  @IsUUID('4', { each: true })
  bankTransactionIds: string[];

  @ApiProperty({
    description: 'Lançamentos internos. Mais de um = um-para-muitos.',
    type: [ReconciliationEntryDto],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Selecione ao menos um lançamento.' })
  @ValidateNested({ each: true })
  @Type(() => ReconciliationEntryDto)
  entries: ReconciliationEntryDto[];

  @ApiPropertyOptional({
    description:
      'Justificativa da diferença. Exigida quando ela existe e passa da tolerância.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  differenceReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({
    description: 'Sugestão aceita que originou esta conciliação.',
  })
  @IsOptional()
  @IsUUID()
  suggestionId?: string;
}

export class UnmatchDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo para desfazer a conciliação.' })
  @MaxLength(500)
  reason: string;
}

/** Vínculo de transferência interna (seção 40). */
export class LinkTransferDto {
  @ApiProperty({ description: 'Transação de saída.' })
  @IsUUID()
  outgoingTransactionId: string;

  @ApiProperty({
    description: 'Transação de entrada, em outra conta da mesma empresa.',
  })
  @IsUUID()
  incomingTransactionId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ReconciliationQueryDto extends PaginationQueryDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;
}

// ── Modelos de importação ────────────────────────────────────────────────────

export class ImportTemplateDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  financialAccountId?: string;

  @ApiProperty({ example: 'Extrato Banco do Brasil — Conta Corrente' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do modelo.' })
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  bankCode?: string;

  @ApiProperty({ enum: BankStatementSourceType })
  @IsEnum(BankStatementSourceType)
  fileType: BankStatementSourceType;

  @ApiProperty({ description: 'Mapa `campoDoPulse -> coluna`.' })
  @IsObject()
  columnMapping: Record<string, string | number>;

  @ApiProperty({ description: 'Regra de sinal. Nunca é assumida.' })
  @IsObject()
  signRule: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4)
  delimiter?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  encoding?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  dateFormat?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2)
  decimalSeparator?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2)
  thousandSeparator?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  headerRow?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dataStartRow?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  footerRowsToIgnore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class TemplateQueryDto extends PaginationQueryDto {
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
  @IsString()
  bankCode?: string;

  @ApiPropertyOptional({ enum: BankStatementSourceType })
  @IsOptional()
  @IsEnum(BankStatementSourceType)
  fileType?: BankStatementSourceType;
}

// ── Comentários e configurações ──────────────────────────────────────────────

export class ReconciliationCommentDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty()
  @IsUUID()
  companyId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Escreva o comentário.' })
  @MaxLength(2000)
  comment: string;

  @ApiPropertyOptional({ enum: ReconciliationCommentVisibility })
  @IsOptional()
  @IsEnum(ReconciliationCommentVisibility)
  visibility?: ReconciliationCommentVisibility;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  bankTransactionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  reconciliationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  statementImportId?: string;

  @ApiPropertyOptional({
    description:
      'Anexos já enviados ao bucket privado: [{ path, fileName, mimeType, size }].',
  })
  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  attachments?: Record<string, unknown>[];
}

export class UpdateReconciliationSettingsDto {
  @ApiPropertyOptional({
    description: 'Conta específica. Sem ela, vale para a empresa.',
  })
  @IsOptional()
  @IsUUID()
  financialAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({ enum: BankStatementSourceType, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(BankStatementSourceType, { each: true })
  allowedImportTypes?: BankStatementSourceType[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1024)
  maximumFileSize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  duplicateCheckEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  blockDuplicates?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amountTolerance?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  percentageTolerance?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  dateToleranceDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  minimumSuggestionScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  mandatoryReview?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  partialMatchEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  multipleMatchEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  manualAdjustmentEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  manualTransactionEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  unmatchEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  reconciliationDeadlineDays?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  defaultAssignedUserId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  defaultAssignedTeam?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  automaticReprocessingEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  closingRequired?: boolean;
}

export class DashboardQueryDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  financialAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;
}
