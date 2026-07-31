import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  BalanceType,
  BankIntegrationType,
  BankLimitType,
  IntegrationEnvironment,
  PixKeyPurpose,
  PixKeyType,
  RecordStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
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
  MaxLength,
  Min,
} from 'class-validator';

// ── Saldo inicial (seções 18 e 19) ─────────────────────────────────────────

export class CreateOpeningBalanceDto {
  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  balanceDate: string;

  @ApiProperty({ example: 25000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  balanceAmount: number;

  @ApiPropertyOptional({ enum: BalanceType, default: BalanceType.CREDIT })
  @IsOptional()
  @IsEnum(BalanceType)
  balanceType?: BalanceType;

  @ApiPropertyOptional({ example: 'Extrato bancário de 31/12/2025' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  source?: string;

  @ApiPropertyOptional({ description: 'Anexo comprobatório do saldo.' })
  @IsOptional()
  @IsUUID()
  documentAttachmentId?: string;

  @ApiPropertyOptional({
    description:
      'Obrigatório quando a conta já possui saldo aprovado: explica a correção.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

// ── Limites bancários (seção 21) ───────────────────────────────────────────

export class CreateAccountLimitDto {
  @ApiProperty({ enum: BankLimitType })
  @IsEnum(BankLimitType)
  limitType: BankLimitType;

  @ApiProperty({ example: 50000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  contractedAmount: number;

  @ApiPropertyOptional({
    example: 2.49,
    description: 'Taxa mensal, em percentual.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  interestRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  documentAttachmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  responsibleUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: RecordStatus })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}

export class UpdateAccountLimitDto extends PartialType(CreateAccountLimitDto) {}

// ── Chaves PIX da empresa (seções 22 e 23) ─────────────────────────────────

export class CreateCompanyPixKeyDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty()
  @IsUUID()
  companyId: string;

  @ApiPropertyOptional({
    description: 'Conta financeira à qual a chave pertence.',
  })
  @IsOptional()
  @IsUUID()
  financialAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  financialInstitutionId?: string;

  @ApiProperty({ enum: PixKeyType })
  @IsEnum(PixKeyType)
  pixType: PixKeyType;

  @ApiProperty({ example: '11.222.333/0001-81' })
  @IsString()
  @IsNotEmpty({ message: 'Informe a chave PIX.' })
  @MaxLength(140)
  pixKey: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  holderName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  holderDocument?: string;

  @ApiPropertyOptional({ enum: PixKeyPurpose, default: PixKeyPurpose.GENERAL })
  @IsOptional()
  @IsEnum(PixKeyPurpose)
  purpose?: PixKeyPurpose;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isForBilling?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isForSuppliers?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isForCustomers?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  proofDocumentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateCompanyPixKeyDto extends PartialType(
  CreateCompanyPixKeyDto,
) {}

// ── Usuários da conta (seção 24) ───────────────────────────────────────────

export class UpsertAccountUserDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Valor máximo que o usuário pode visualizar.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  viewLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  transactionLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  approvalLimit?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  canViewBalance?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  canViewBankData?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  canCreateEntry?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  canImportStatement?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  canReconcile?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  canSchedulePayment?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  canAuthorizePayment?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  canUpdateOpeningBalance?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  canUpdateLimits?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  canManageIntegration?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  canExport?: boolean;

  @ApiPropertyOptional({ enum: RecordStatus })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}

// ── Integrações bancárias (seções 26 a 28) ─────────────────────────────────

export class CreateAccountIntegrationDto {
  @ApiProperty({ enum: BankIntegrationType })
  @IsEnum(BankIntegrationType)
  integrationType: BankIntegrationType;

  @ApiPropertyOptional({ example: 'Banco do Brasil' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  provider?: string;

  @ApiPropertyOptional({ description: 'Identificador da conta no provedor.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalAccountId?: string;

  @ApiPropertyOptional({
    enum: IntegrationEnvironment,
    default: IntegrationEnvironment.SANDBOX,
  })
  @IsOptional()
  @IsEnum(IntegrationEnvironment)
  environment?: IntegrationEnvironment;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  supportsBalance?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  supportsStatements?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  supportsPayments?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  supportsBilling?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  supportsReconciliation?: boolean;

  /**
   * Ponteiro para o segredo no cofre — algo como `vault://pulse/company/<id>/bb`.
   * A credencial em si nunca trafega por aqui.
   */
  @ApiPropertyOptional({
    example: 'vault://pulse/company/123/banco-do-brasil',
    description:
      'Referência ao segredo no cofre. Nunca envie a credencial em si: o valor é recusado se parecer um segredo.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  credentialsReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  nextSyncAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateAccountIntegrationDto extends PartialType(
  CreateAccountIntegrationDto,
) {}

export class CompanyPixKeyQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  financialAccountId?: string;

  @ApiPropertyOptional({ enum: PixKeyType })
  @IsOptional()
  @IsEnum(PixKeyType)
  pixType?: PixKeyType;

  @ApiPropertyOptional({ enum: RecordStatus })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}
