import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

/** Aditivo contratual (seção 58). */
export class ContractAmendmentDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  amendmentNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  previousValue?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  newValue?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  previousEndDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  newEndDate?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  scopeChanged?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  documentAttachmentId?: string;
}
