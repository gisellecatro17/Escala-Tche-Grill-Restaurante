import { ApiProperty } from '@nestjs/swagger';
import { AllocationType } from '@prisma/client';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

/** Item de rateio padrão do vínculo (seção 35 do prompt de fornecedores). */
export class AllocationDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  costCenterId?: string;

  @ApiProperty({ enum: AllocationType })
  @IsEnum(AllocationType)
  allocationType: AllocationType;

  @ApiProperty({ required: false, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'O percentual não pode ser negativo.' })
  @Max(100, { message: 'O percentual não pode ultrapassar 100%.' })
  percentage?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'O valor não pode ser negativo.' })
  fixedAmount?: number;

  @ApiProperty({ required: false, default: 100 })
  @IsOptional()
  @IsNumber()
  priority?: number;
}
