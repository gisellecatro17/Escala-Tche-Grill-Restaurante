import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty()
  @IsUUID()
  companyId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome da categoria.' })
  @MaxLength(150)
  name: string;

  @ApiProperty({
    required: false,
    description:
      'Informe para criar uma subcategoria de outra categoria já existente.',
  })
  @IsOptional()
  @IsUUID()
  parentCategoryId?: string;
}
