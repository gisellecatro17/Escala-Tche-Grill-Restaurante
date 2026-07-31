import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CustomerCnaeDto {
  @ApiProperty({ example: '56.11-2-01' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o código do CNAE.' })
  @MaxLength(20)
  cnaeCode: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isMain?: boolean;
}
