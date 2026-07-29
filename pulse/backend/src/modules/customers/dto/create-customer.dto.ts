import { ApiProperty } from '@nestjs/swagger';
import { CustomerPersonType } from '@prisma/client';
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
import { CustomerAddressDto } from './customer-address.dto';
import { CustomerCnaeDto } from './customer-cnae.dto';
import { CustomerContactDto } from './customer-contact.dto';

export class CreateCustomerDto {
  // ── Identificação (etapa 1) ────────────────────────────────────────────────
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty({
    enum: CustomerPersonType,
    default: CustomerPersonType.LEGAL_ENTITY,
  })
  @IsEnum(CustomerPersonType)
  personType: CustomerPersonType;

  @ApiProperty({ required: false, example: '12.345.678/0001-90' })
  @ValidateIf(
    (o: CreateCustomerDto) => o.personType === CustomerPersonType.LEGAL_ENTITY,
  )
  @IsCnpj()
  @ValidateIf(
    (o: CreateCustomerDto) => o.personType === CustomerPersonType.INDIVIDUAL,
  )
  @IsCpf()
  @ValidateIf(
    (o: CreateCustomerDto) => o.personType === CustomerPersonType.FOREIGN,
  )
  @IsOptional()
  @IsString()
  documentNumber?: string;

  @ApiProperty({
    required: false,
    description: 'Documento/identificação fiscal do cliente estrangeiro.',
  })
  @ValidateIf(
    (o: CreateCustomerDto) => o.personType === CustomerPersonType.FOREIGN,
  )
  @IsString()
  @IsNotEmpty({ message: 'Informe o documento do cliente estrangeiro.' })
  foreignDocument?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  billingCurrency?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  preferredLanguage?: string;

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
  @IsDateString()
  birthDate?: string;

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

  @ApiProperty({ required: false, type: [CustomerCnaeDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomerCnaeDto)
  cnaes?: CustomerCnaeDto[];

  // ── Endereços (etapa 3) ─────────────────────────────────────────────────────
  @ApiProperty({ required: false, type: [CustomerAddressDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomerAddressDto)
  addresses?: CustomerAddressDto[];

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
  emailBilling?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  emailFiscal?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;

  @ApiProperty({ required: false, type: [CustomerContactDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomerContactDto)
  contacts?: CustomerContactDto[];

  // ── Vínculo com a empresa selecionada (opcional — permite concluir o cadastro
  // completo, do cliente global ao vínculo/prospect, em uma única chamada) ───
  @ApiProperty({ required: false, type: CreateCompanyLinkDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateCompanyLinkDto)
  companyLink?: CreateCompanyLinkDto;
}
