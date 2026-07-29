import { ApiProperty } from '@nestjs/swagger';
import { SupplierPersonType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { IsCnpj } from '../../../common/validators/is-cnpj.validator';
import { IsCpf } from '../../../common/validators/is-cpf.validator';
import { CreateCompanyLinkDto } from './create-company-link.dto';
import { SupplierAddressDto } from './supplier-address.dto';
import { SupplierBankAccountDto } from './supplier-bank-account.dto';
import { SupplierCnaeDto } from './supplier-cnae.dto';
import { SupplierContactDto } from './supplier-contact.dto';
import { SupplierPixKeyDto } from './supplier-pix-key.dto';

export class CreateSupplierDto {
  // ── Identificação (etapa 1) ────────────────────────────────────────────────
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty({
    enum: SupplierPersonType,
    default: SupplierPersonType.LEGAL_ENTITY,
  })
  @IsEnum(SupplierPersonType)
  personType: SupplierPersonType;

  @ApiProperty({ required: false, example: '12.345.678/0001-90' })
  @ValidateIf(
    (o: CreateSupplierDto) => o.personType === SupplierPersonType.LEGAL_ENTITY,
  )
  @IsCnpj()
  @ValidateIf(
    (o: CreateSupplierDto) => o.personType === SupplierPersonType.INDIVIDUAL,
  )
  @IsCpf()
  @ValidateIf(
    (o: CreateSupplierDto) => o.personType === SupplierPersonType.FOREIGN,
  )
  @IsOptional()
  @IsString()
  documentNumber?: string;

  @ApiProperty({
    required: false,
    description: 'Número de identificação fiscal do fornecedor estrangeiro.',
  })
  @ValidateIf(
    (o: CreateSupplierDto) => o.personType === SupplierPersonType.FOREIGN,
  )
  @IsString()
  @IsNotEmpty({
    message:
      'Informe o número de identificação fiscal do fornecedor estrangeiro.',
  })
  foreignTaxId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  foreignCountry?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  foreignCurrency?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe a razão social ou o nome completo.' })
  @MaxLength(200)
  legalName: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  tradeName?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome de exibição.' })
  @MaxLength(150)
  displayName: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  generalNotes?: string;

  // ── Dados cadastrais (etapa 2) ─────────────────────────────────────────────
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
  @MaxLength(100)
  segment?: string;

  @ApiProperty({ required: false, type: [SupplierCnaeDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupplierCnaeDto)
  cnaes?: SupplierCnaeDto[];

  // ── Endereços (etapa 3) ─────────────────────────────────────────────────────
  @ApiProperty({ required: false, type: [SupplierAddressDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupplierAddressDto)
  addresses?: SupplierAddressDto[];

  // ── Contatos (etapa 3) ───────────────────────────────────────────────────────
  @ApiProperty({ required: false })
  @IsOptional()
  @IsPhoneNumber('BR', { message: 'Informe um telefone válido.' })
  phone?: string;

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
  emailPaymentReceipts?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;

  @ApiProperty({ required: false, type: [SupplierContactDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupplierContactDto)
  contacts?: SupplierContactDto[];

  // ── Dados bancários e PIX (etapa 4) ────────────────────────────────────────
  @ApiProperty({ required: false, type: [SupplierBankAccountDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupplierBankAccountDto)
  bankAccounts?: SupplierBankAccountDto[];

  @ApiProperty({ required: false, type: [SupplierPixKeyDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupplierPixKeyDto)
  pixKeys?: SupplierPixKeyDto[];

  // ── Vínculo com a empresa selecionada (opcional — permite concluir o cadastro
  // completo, do fornecedor global ao vínculo, em uma única chamada) ─────────
  @ApiProperty({ required: false, type: CreateCompanyLinkDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateCompanyLinkDto)
  companyLink?: CreateCompanyLinkDto;
}
