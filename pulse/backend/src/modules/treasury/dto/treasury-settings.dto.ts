import { ApiPropertyOptional } from '@nestjs/swagger';
import { ReconciliationMode } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

/**
 * Parâmetros de tesouraria da empresa (seção 47). Todos opcionais: a atualização é
 * parcial, e o registro é criado com os padrões na primeira consulta.
 */
export class UpdateTreasurySettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  primaryFinancialAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  defaultPaymentAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  defaultReceiptAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  defaultTaxAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  defaultPayrollAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  defaultCashAccountId?: string;

  @ApiPropertyOptional({ example: 'BRL' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currencyCode?: string;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minimumSafetyBalance?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowNegativeBalance?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowInactiveAccountOperations?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  requireAvailableBalance?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requireAttachment?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  requireRegisteredBeneficiary?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  requireHolderValidation?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requireDualApproval?: boolean;

  @ApiPropertyOptional({
    example: 10000,
    description:
      'Valor a partir do qual a dupla aprovação passa a ser exigida.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  dualApprovalAmount?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowThirdPartyAccounts?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  allowOpeningBalanceChange?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  allowManualEntries?: boolean;

  // ── Segregação de funções (seção 25) ────────────────────────────────────

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requireSegregationOfDuties?: boolean;

  @ApiPropertyOptional({
    default: false,
    description: 'Quem inclui a operação não pode autorizá-la.',
  })
  @IsOptional()
  @IsBoolean()
  segregateEntryFromApproval?: boolean;

  @ApiPropertyOptional({
    default: false,
    description: 'Quem autoriza a operação não pode conciliá-la.',
  })
  @IsOptional()
  @IsBoolean()
  segregateApprovalFromReconciliation?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  allowSelfApproval?: boolean;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  cardExpirationAlertDays?: number;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  accountClosingAlertDays?: number;

  @ApiPropertyOptional({ enum: ReconciliationMode })
  @IsOptional()
  @IsEnum(ReconciliationMode)
  defaultReconciliationMode?: ReconciliationMode;

  @ApiPropertyOptional({
    example: 0.05,
    description: 'Diferença de valor tolerada na conciliação.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amountTolerance?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  dateToleranceDays?: number;
}
