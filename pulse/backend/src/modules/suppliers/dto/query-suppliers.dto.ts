import { ApiProperty } from '@nestjs/swagger';
import { SupplierLinkStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class QuerySuppliersDto extends PaginationQueryDto {
  @ApiProperty({
    required: false,
    description:
      'Empresa selecionada. Se omitida, retorna os fornecedores de todas as empresas visíveis ao usuário.',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiProperty({ required: false, enum: SupplierLinkStatus })
  @IsOptional()
  @IsEnum(SupplierLinkStatus)
  status?: SupplierLinkStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  defaultCategoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  defaultCostCenterId?: string;

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
