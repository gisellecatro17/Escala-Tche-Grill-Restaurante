import { ApiProperty } from '@nestjs/swagger';
import { CustomerFinancialStatus, CustomerLinkStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class QueryCustomersDto extends PaginationQueryDto {
  @ApiProperty({
    required: false,
    description:
      'Empresa selecionada. Se omitida, retorna os clientes de todas as empresas visíveis ao usuário.',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiProperty({ required: false, enum: CustomerLinkStatus })
  @IsOptional()
  @IsEnum(CustomerLinkStatus)
  status?: CustomerLinkStatus;

  @ApiProperty({ required: false, enum: CustomerFinancialStatus })
  @IsOptional()
  @IsEnum(CustomerFinancialStatus)
  financialStatus?: CustomerFinancialStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  defaultRevenueCategoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  defaultResultCenterId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  documentNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  state?: string;
}
