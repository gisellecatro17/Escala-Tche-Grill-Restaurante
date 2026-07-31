import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RuleConditionField, RuleConditionOperator } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

/** Uma condição da regra (seção 36). Todas as condições precisam casar (E lógico). */
export class RuleConditionDto {
  @ApiProperty({ enum: RuleConditionField })
  @IsEnum(RuleConditionField)
  field: RuleConditionField;

  @ApiProperty({ enum: RuleConditionOperator })
  @IsEnum(RuleConditionOperator)
  operator: RuleConditionOperator;

  @ApiProperty({
    example: 'COELBA',
    description:
      'Valor comparado. Para IN/NOT_IN, aceita lista separada por ponto e vírgula.',
  })
  @IsString()
  value: string;

  @ApiPropertyOptional({
    description: 'Limite superior, usado pelo operador BETWEEN.',
  })
  @IsOptional()
  @IsString()
  secondaryValue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

/** Ação aplicada quando as condições casam (seção 37). */
export class RuleActionDto {
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

  @ApiPropertyOptional({
    description: 'FK lógica — módulo de formas de pagamento futuro.',
  })
  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @ApiPropertyOptional({
    description: 'FK lógica — módulo de contas bancárias futuro.',
  })
  @IsOptional()
  @IsUUID()
  bankAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tagId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultHistory?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  responsibleUserId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  suggestReconciliation?: boolean;

  @ApiPropertyOptional({
    default: false,
    description:
      'Criação de lançamento permanece desligada até o módulo financeiro existir.',
  })
  @IsOptional()
  @IsBoolean()
  createFinancialEntry?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  autoMatch?: boolean;
}

/** Lançamento hipotético usado no simulador (seção 40). */
export class TestRuleDto {
  @ApiProperty()
  @IsUUID()
  companyId: string;

  @ApiPropertyOptional({ example: 'COELBA FATURA 09/2026' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

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
  amount?: number;

  @ApiPropertyOptional({ example: '2026-07-30' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transactionType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAccount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pixKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  origin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;
}
