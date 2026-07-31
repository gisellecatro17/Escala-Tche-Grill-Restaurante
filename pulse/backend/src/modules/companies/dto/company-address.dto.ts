import { ApiProperty } from '@nestjs/swagger';
import { CompanyAddressType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CompanyAddressDto {
  @ApiProperty({
    required: false,
    description: 'Informe ao editar um endereço existente.',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ enum: CompanyAddressType })
  @IsEnum(CompanyAddressType)
  addressType: CompanyAddressType;

  @ApiProperty({ example: '44350-000' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o CEP.' })
  postalCode: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe o logradouro.' })
  @MaxLength(200)
  street: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  number?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  complement?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe o município.' })
  @MaxLength(100)
  city: string;

  @ApiProperty({ example: 'BA' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o estado.' })
  @MaxLength(2)
  state: string;

  @ApiProperty({ required: false, default: 'BR' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  cityCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiProperty({
    required: false,
    description:
      'Id de outro endereço para reutilizar os mesmos dados (ex.: operacional igual ao fiscal).',
  })
  @IsOptional()
  @IsUUID()
  sameAsAddressId?: string;
}
