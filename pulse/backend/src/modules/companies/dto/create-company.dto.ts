import { ApiProperty } from '@nestjs/swagger';
import {
  AccountingCriterion,
  EstablishmentType,
  PersonType,
  TaxRegime,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { IsCnpj } from '../../../common/validators/is-cnpj.validator';
import { IsCpf } from '../../../common/validators/is-cpf.validator';
import { CompanyAddressDto } from './company-address.dto';
import { CompanyCnaeDto } from './company-cnae.dto';
import { CompanyContactDto } from './company-contact.dto';

export class CreateCompanyDto {
  // ── Identificação ────────────────────────────────────────────────────────
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty({
    required: false,
    description:
      'Empresa matriz, quando o tipo de estabelecimento for filial ou unidade operacional.',
  })
  @IsOptional()
  @IsUUID()
  parentCompanyId?: string;

  @ApiProperty({
    required: false,
    description:
      'Código interno. Se omitido e a numeração automática estiver ativa, será gerado pelo back-end.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  internalCode?: string;

  @ApiProperty({ enum: PersonType, default: PersonType.LEGAL_ENTITY })
  @IsEnum(PersonType)
  personType: PersonType;

  @ApiProperty({ example: '12.345.678/0001-90' })
  @ValidateIf((o: CreateCompanyDto) => o.personType === PersonType.LEGAL_ENTITY)
  @IsCnpj()
  @ValidateIf((o: CreateCompanyDto) => o.personType === PersonType.INDIVIDUAL)
  @IsCpf()
  documentNumber: string;

  @ApiProperty({ example: 'Tchê Grill Restaurante Ltda.' })
  @IsString()
  @IsNotEmpty({ message: 'Informe a razão social ou o nome completo.' })
  @MaxLength(200)
  legalName: string;

  @ApiProperty({ required: false, example: 'Tchê Grill' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  tradeName?: string;

  @ApiProperty({ example: 'Tchê Grill — Governador Mangabeira' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome de exibição.' })
  @MaxLength(150)
  displayName: string;

  @ApiProperty({
    enum: EstablishmentType,
    default: EstablishmentType.HEADQUARTERS,
  })
  @IsOptional()
  @IsEnum(EstablishmentType)
  establishmentType?: EstablishmentType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  implementationStartDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  registrationNotes?: string;

  // ── Dados cadastrais ─────────────────────────────────────────────────────
  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  openingDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  legalNature?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  companySize?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  shareCapital?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  stateRegistration?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  municipalRegistration?: string;

  @ApiProperty({ required: false, type: [CompanyCnaeDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompanyCnaeDto)
  cnaes?: CompanyCnaeDto[];

  // ── Endereços ────────────────────────────────────────────────────────────
  @ApiProperty({ required: false, type: [CompanyAddressDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompanyAddressDto)
  addresses?: CompanyAddressDto[];

  // ── Contatos ─────────────────────────────────────────────────────────────
  @ApiProperty({ required: false })
  @IsOptional()
  @IsPhoneNumber('BR', { message: 'Informe um telefone válido.' })
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsPhoneNumber('BR', { message: 'Informe um telefone válido.' })
  phoneSecondary?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsPhoneNumber('BR', { message: 'Informe um WhatsApp válido.' })
  whatsapp?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  emailFinancial?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  emailFiscal?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;

  @ApiProperty({ required: false, type: [CompanyContactDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompanyContactDto)
  contacts?: CompanyContactDto[];

  // ── Informações fiscais ──────────────────────────────────────────────────
  @ApiProperty({ required: false, enum: TaxRegime })
  @IsOptional()
  @IsEnum(TaxRegime)
  taxRegime?: TaxRegime;

  @ApiProperty({ required: false, enum: AccountingCriterion })
  @IsOptional()
  @IsEnum(AccountingCriterion)
  taxAssessmentMethod?: AccountingCriterion;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  icmsTaxpayer?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  simplesNacionalOptant?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  simplesNacionalOptionDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  simplesNacionalExclusionDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  specialTaxRegime?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  accountingFirmName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  accountingResponsibleName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  taxNotes?: string;

  // ── Configurações financeiras ────────────────────────────────────────────
  @ApiProperty({ required: false, default: 'BRL' })
  @IsOptional()
  @IsString()
  currencyCode?: string;

  @ApiProperty({ required: false, default: 'DD/MM/YYYY' })
  @IsOptional()
  @IsString()
  dateFormat?: string;

  @ApiProperty({ required: false, default: 'America/Bahia' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiProperty({
    required: false,
    enum: AccountingCriterion,
    default: AccountingCriterion.ACCRUAL,
  })
  @IsOptional()
  @IsEnum(AccountingCriterion)
  financialMethod?: AccountingCriterion;

  @ApiProperty({ required: false, minimum: 1, maximum: 31, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  financialMonthStartDay?: number;

  @ApiProperty({ required: false, minimum: 1, maximum: 31, default: 31 })
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'O dia de fechamento deve estar entre 1 e 31.' })
  @Max(31, { message: 'O dia de fechamento deve estar entre 1 e 31.' })
  monthClosingDay?: number;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  allowRetroactiveEntries?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  allowFutureEntries?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  requiresCategory?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  requiresCostCenter?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  requiresSupplier?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  requiresCustomer?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  requiresAttachment?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @ApiProperty({ required: false, minimum: 1, maximum: 5, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Informe ao menos 1 nível de aprovação.' })
  @Max(5, { message: 'São permitidos no máximo 5 níveis de aprovação.' })
  approvalLevels?: number;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  automaticCodeEnabled?: boolean;
}
