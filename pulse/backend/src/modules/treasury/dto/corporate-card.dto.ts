import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import {
  CorporateCardStatus,
  CorporateCardType,
  RecordStatus,
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
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/**
 * Cartão corporativo.
 *
 * O DTO **não tem** campo para número completo, CVV ou senha: o que não é aceito na
 * entrada não pode ser gravado por engano depois (seções 38 e 39).
 */
export class CreateCorporateCardDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty()
  @IsUUID()
  companyId: string;

  @ApiPropertyOptional({ description: 'Conta financeira que paga a fatura.' })
  @IsOptional()
  @IsUUID()
  financialAccountId?: string;

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
  defaultCategoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  defaultProjectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  accountPlanId?: string;

  @ApiProperty({ example: 'Cartão Corporativo Operacional' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do cartão.' })
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  displayName?: string;

  @ApiProperty({ enum: CorporateCardType })
  @IsEnum(CorporateCardType)
  cardType: CorporateCardType;

  @ApiPropertyOptional({ example: 'Visa' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  brand?: string;

  @ApiProperty({
    example: '4587',
    description:
      'Apenas os quatro últimos dígitos. O número completo nunca é aceito nem armazenado.',
  })
  @IsString()
  @Matches(/^\d{4}$/, {
    message: 'Informe exatamente os quatro últimos dígitos do cartão.',
  })
  lastFourDigits: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  holderName?: string;

  @ApiPropertyOptional({ description: 'Responsável interno pelo cartão.' })
  @IsOptional()
  @IsUUID()
  responsibleUserId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isPhysical?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isVirtual?: boolean;

  @ApiPropertyOptional({ example: 20000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalLimit?: number;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  transactionLimit?: number;

  @ApiPropertyOptional({ example: 25, minimum: 1, maximum: 31 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'O dia de fechamento deve estar entre 1 e 31.' })
  @Max(31, { message: 'O dia de fechamento deve estar entre 1 e 31.' })
  closingDay?: number;

  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 31 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'O dia de vencimento deve estar entre 1 e 31.' })
  @Max(31, { message: 'O dia de vencimento deve estar entre 1 e 31.' })
  dueDay?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  allowsInstallments?: boolean;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maximumInstallments?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @ApiPropertyOptional({ example: '2029-12-31' })
  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateCorporateCardDto extends PartialType(
  OmitType(CreateCorporateCardDto, ['organizationId', 'companyId'] as const),
) {}

export class CorporateCardStatusChangeDto {
  @ApiProperty({ example: 'Cartão extraviado.' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo.' })
  @MaxLength(500)
  reason: string;
}

export class UpsertCardUserDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  individualLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  transactionLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  costCenterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  businessUnitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;

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

export class CorporateCardQueryDto extends PaginationQueryDto {
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
  financialInstitutionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ enum: CorporateCardType })
  @IsOptional()
  @IsEnum(CorporateCardType)
  cardType?: CorporateCardType;

  @ApiPropertyOptional({ enum: CorporateCardStatus })
  @IsOptional()
  @IsEnum(CorporateCardStatus)
  status?: CorporateCardStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  responsibleUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  costCenterId?: string;

  @ApiPropertyOptional({ example: '4587' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,4}$/)
  lastFourDigits?: string;

  @ApiPropertyOptional({ description: 'Somente cartões virtuais.' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isVirtual?: boolean;

  @ApiPropertyOptional({
    description:
      'Somente cartões que vencem dentro do prazo de alerta da empresa.',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  expiringSoon?: boolean;
}
