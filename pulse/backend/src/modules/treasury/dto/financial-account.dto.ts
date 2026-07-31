import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import {
  FinancialAccountPurpose,
  FinancialAccountStatus,
  FinancialAccountType,
  ReconciliationMode,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/** Tipos que representam uma conta em instituição financeira. */
export const BANK_ACCOUNT_TYPES: FinancialAccountType[] = [
  FinancialAccountType.CHECKING_ACCOUNT,
  FinancialAccountType.SAVINGS_ACCOUNT,
  FinancialAccountType.PAYMENT_ACCOUNT,
  FinancialAccountType.DIGITAL_ACCOUNT,
  FinancialAccountType.INVESTMENT_ACCOUNT,
  FinancialAccountType.GUARANTEED_ACCOUNT,
  FinancialAccountType.RECEIVING_ACCOUNT,
];

/**
 * Conta financeira: conta bancária, caixa, fundo fixo ou carteira digital.
 *
 * Os campos bancários são condicionais — um caixa não tem agência nem conta, e exigi-los
 * impediria o cadastro previsto na seção 15.
 */
export class CreateFinancialAccountDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty()
  @IsUUID()
  companyId: string;

  @ApiPropertyOptional({
    description: 'Código interno, único dentro da empresa.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  internalCode?: string;

  @ApiProperty({ example: 'Conta Operacional' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome da conta.' })
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    example: 'Banco do Brasil — Conta Operacional',
    description:
      'Nome mostrado em seletores e relatórios. Ausente, é montado a partir da instituição e do nome.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  displayName?: string;

  @ApiProperty({ enum: FinancialAccountType })
  @IsEnum(FinancialAccountType)
  accountType: FinancialAccountType;

  @ApiPropertyOptional({
    enum: FinancialAccountPurpose,
    default: FinancialAccountPurpose.MULTIPLE,
  })
  @IsOptional()
  @IsEnum(FinancialAccountPurpose)
  purpose?: FinancialAccountPurpose;

  // ── Vínculos com a estrutura financeira ──────────────────────────────────

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  financialInstitutionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  businessUnitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  costCenterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  accountPlanId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  financialNatureId?: string;

  // ── Dados bancários (seção 13) ───────────────────────────────────────────

  @ApiPropertyOptional({ example: '1234' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  branchNumber?: string;

  @ApiPropertyOptional({ example: '5' })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  branchDigit?: string;

  @ApiPropertyOptional({ example: '12345' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  accountNumber?: string;

  @ApiPropertyOptional({ example: '6' })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  accountDigit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  holderName?: string;

  @ApiPropertyOptional({ description: 'CPF ou CNPJ do titular.' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  holderDocument?: string;

  @ApiPropertyOptional({
    default: false,
    description:
      'Conta cujo titular não é a empresa. Exige justificativa e permissão específica.',
  })
  @IsOptional()
  @IsBoolean()
  isThirdParty?: boolean;

  @ApiPropertyOptional()
  @ValidateIf((dto: CreateFinancialAccountDto) => dto.isThirdParty === true)
  @IsString()
  @IsNotEmpty({
    message: 'Informe o motivo da utilização de uma conta de terceiro.',
  })
  @MaxLength(500)
  thirdPartyReason?: string;

  @ApiPropertyOptional({ example: 'BR' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  swiftCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  iban?: string;

  @ApiPropertyOptional({ description: 'Número do convênio de cobrança.' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  agreementNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  bankClientCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  walletNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  walletVariation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  assignorCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankNotes?: string;

  // ── Caixa, fundo fixo e carteira (seção 15) ──────────────────────────────

  @ApiPropertyOptional({ example: 'Frente de caixa do salão' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  physicalLocation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  responsibleUserId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresDailyClosing?: boolean;

  @ApiPropertyOptional({ description: 'Frequência de conferência, em dias.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  checkFrequencyDays?: number;

  // ── Configuração financeira (seção 16) ───────────────────────────────────

  @ApiPropertyOptional({ example: 'BRL', default: 'BRL' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currencyCode?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefaultForPayments?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefaultForReceipts?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefaultForTaxes?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefaultForPayroll?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefaultForTransfers?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowsNegativeBalance?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  allowsManualEntries?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  allowsImports?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowsIntegrations?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowsRetroactiveEntries?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresAttachment?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresHistory?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  requiresCategory?: boolean;

  @ApiPropertyOptional({
    enum: ReconciliationMode,
    default: ReconciliationMode.MANUAL,
  })
  @IsOptional()
  @IsEnum(ReconciliationMode)
  reconciliationMode?: ReconciliationMode;

  // ── Categorias padrão da conta (seção 17) ────────────────────────────────

  @ApiPropertyOptional({
    description: 'Categoria padrão de tarifas bancárias.',
  })
  @IsOptional()
  @IsUUID()
  feeCategoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  interestPaidCategoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  interestEarnedCategoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  iofCategoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  yieldCategoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  transferCategoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  investmentCategoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  redemptionCategoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  reversalCategoryId?: string;

  // ── Saldos de referência (seção 18) ──────────────────────────────────────

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  minimumRecommendedBalance?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  maximumRecommendedBalance?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  blockedBalance?: number;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

/** A empresa e a organização não mudam depois de criada: mudá-las trocaria o dono da conta. */
export class UpdateFinancialAccountDto extends PartialType(
  OmitType(CreateFinancialAccountDto, ['organizationId', 'companyId'] as const),
) {}

/** Corpo comum das mudanças de status que exigem motivo. */
export class FinancialAccountStatusChangeDto {
  @ApiProperty({ example: 'Conta encerrada junto ao banco.' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo.' })
  @MaxLength(500)
  reason: string;
}

/** Encerramento: exige data, saldo final e motivo (seção 34). */
export class CloseFinancialAccountDto extends FinancialAccountStatusChangeDto {
  @ApiProperty({ example: '2026-12-31' })
  @IsDateString()
  closingDate: string;

  @ApiProperty({ example: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  closingBalance: number;

  @ApiPropertyOptional({ description: 'Anexo comprobatório do encerramento.' })
  @IsOptional()
  @IsUUID()
  closingDocumentId?: string;
}

export class FinancialAccountQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ enum: FinancialAccountType })
  @IsOptional()
  @IsEnum(FinancialAccountType)
  accountType?: FinancialAccountType;

  @ApiPropertyOptional({ enum: FinancialAccountStatus })
  @IsOptional()
  @IsEnum(FinancialAccountStatus)
  status?: FinancialAccountStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  financialInstitutionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  businessUnitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  responsibleUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currencyCode?: string;

  @ApiPropertyOptional({
    description: 'Somente contas marcadas como principal.',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({
    description: 'Somente contas com chave PIX cadastrada.',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hasPix?: boolean;

  @ApiPropertyOptional({
    description: 'Somente contas com integração configurada.',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hasIntegration?: boolean;

  @ApiPropertyOptional({
    description: 'Somente contas com saldo inicial registrado.',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hasOpeningBalance?: boolean;
}
