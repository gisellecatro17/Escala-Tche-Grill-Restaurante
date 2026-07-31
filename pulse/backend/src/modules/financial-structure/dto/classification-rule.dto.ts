import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import {
  ClassificationMatchField,
  ClassificationMatchType,
  RecordStatus,
  TransactionOrigin,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
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

import { RuleActionDto, RuleConditionDto } from './rule-condition-action.dto';

/**
 * Regra de classificação automática. Nesta etapa a regra é apenas **armazenada e
 * simulável** — nenhum lançamento real é classificado, pois os módulos de importação
 * bancária e de contas a pagar/receber ainda não existem.
 */
export class CreateClassificationRuleDto {
  @ApiProperty()
  @IsUUID()
  companyId: string;

  @ApiProperty({ example: 'Fatura COELBA' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome da regra.' })
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    enum: ClassificationMatchField,
    default: ClassificationMatchField.DESCRIPTION,
  })
  @IsOptional()
  @IsEnum(ClassificationMatchField)
  matchField?: ClassificationMatchField;

  @ApiPropertyOptional({
    enum: ClassificationMatchType,
    default: ClassificationMatchType.CONTAINS,
  })
  @IsOptional()
  @IsEnum(ClassificationMatchType)
  matchType?: ClassificationMatchType;

  @ApiProperty({ example: 'COELBA' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o texto ou padrão a ser reconhecido.' })
  @MaxLength(255)
  matchValue: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  caseSensitive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  minAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxAmount?: number;

  @ApiPropertyOptional({
    enum: TransactionOrigin,
    default: TransactionOrigin.ANY,
  })
  @IsOptional()
  @IsEnum(TransactionOrigin)
  origin?: TransactionOrigin;

  // ── Dimensões aplicadas quando a regra casa ──
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
  financialNatureId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  allocationRuleId?: string;

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
  @IsString()
  @MaxLength(255)
  appliedDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  appliedHistory?: string;

  @ApiPropertyOptional({
    default: 100,
    description: 'Menor valor = maior prioridade na resolução de conflitos.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  priority?: number;

  @ApiPropertyOptional({ default: 95, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  confidenceThreshold?: number;

  @ApiPropertyOptional({
    default: false,
    description:
      'Se `false`, a regra apenas sugere e exige confirmação humana.',
  })
  @IsOptional()
  @IsBoolean()
  autoApply?: boolean;

  @ApiProperty({
    type: [RuleConditionDto],
    description:
      'Condições da regra. Todas precisam casar. Uma regra sem condição é recusada — ela se aplicaria a todo lançamento.',
  })
  @IsArray()
  @ArrayNotEmpty({ message: 'Informe ao menos uma condição para a regra.' })
  @ValidateNested({ each: true })
  @Type(() => RuleConditionDto)
  conditions: RuleConditionDto[];

  @ApiProperty({
    type: [RuleActionDto],
    description: 'Ações aplicadas quando as condições casam.',
  })
  @IsArray()
  @ArrayNotEmpty({ message: 'Esta regra não possui nenhuma ação configurada.' })
  @ValidateNested({ each: true })
  @Type(() => RuleActionDto)
  actions: RuleActionDto[];

  @ApiPropertyOptional({
    default: false,
    description:
      'Aplica sem confirmação humana. Só terá efeito com o módulo financeiro.',
  })
  @IsOptional()
  @IsBoolean()
  automatic?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  requiresConfirmation?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: RecordStatus })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}

export class UpdateClassificationRuleDto extends PartialType(
  OmitType(CreateClassificationRuleDto, ['companyId'] as const),
) {}

/**
 * Simula a aplicação das regras sobre um lançamento hipotético, sem persistir nada.
 * Serve para o usuário conferir o resultado antes de o motor automático existir.
 */
export class SimulateClassificationDto {
  @ApiProperty()
  @IsUUID()
  companyId: string;

  @ApiProperty({ example: 'COELBA FATURA 09/2026' })
  @IsString()
  @IsNotEmpty({ message: 'Informe a descrição do lançamento a simular.' })
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  counterpartyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  counterpartyDocument?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankHistory?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  documentNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiPropertyOptional({ enum: TransactionOrigin })
  @IsOptional()
  @IsEnum(TransactionOrigin)
  origin?: TransactionOrigin;
}
