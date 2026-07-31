import { ApiProperty } from '@nestjs/swagger';
import { CompanySystemStatus, EstablishmentType } from '@prisma/client';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class QueryCompaniesDto extends PaginationQueryDto {
  @ApiProperty({
    required: false,
    description:
      'Filtra por organização (quando o usuário tiver acesso a mais de uma).',
  })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiProperty({ required: false, enum: CompanySystemStatus })
  @IsOptional()
  @IsEnum(CompanySystemStatus)
  systemStatus?: CompanySystemStatus;

  @ApiProperty({
    required: false,
    description: 'Situação cadastral externa (ex.: ATIVA, BAIXADA).',
  })
  @IsOptional()
  @IsString()
  externalRegistrationStatus?: string;

  @ApiProperty({ required: false, enum: EstablishmentType })
  @IsOptional()
  @IsEnum(EstablishmentType)
  establishmentType?: EstablishmentType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({
    required: false,
    description: 'Filtra empresas criadas a partir desta data (ISO 8601).',
  })
  @IsOptional()
  @IsISO8601()
  createdFrom?: string;

  @ApiProperty({
    required: false,
    description: 'Filtra empresas criadas até esta data (ISO 8601).',
  })
  @IsOptional()
  @IsISO8601()
  createdTo?: string;
}
