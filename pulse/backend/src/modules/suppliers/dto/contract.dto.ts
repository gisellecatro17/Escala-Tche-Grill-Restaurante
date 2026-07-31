import { ApiProperty } from '@nestjs/swagger';
import { SupplierContractStatus } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

/** Contrato do fornecedor com a empresa (seção 43 do prompt de fornecedores). */
export class ContractDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  contractNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  object?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  contractValue?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  automaticRenewal?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  billingFrequency?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  adjustmentIndex?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  adjustmentDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  internalResponsibleId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  supplierContactId?: string;

  @ApiProperty({ required: false, enum: SupplierContractStatus })
  @IsOptional()
  @IsEnum(SupplierContractStatus)
  status?: SupplierContractStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
