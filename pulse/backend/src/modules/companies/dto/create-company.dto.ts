import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { IsCnpj } from '../../../common/validators/is-cnpj.validator';

export class CreateCompanyDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty({ example: 'Tchê Grill Restaurante Ltda.' })
  @IsString()
  @IsNotEmpty({ message: 'Informe a razão social da empresa.' })
  @MaxLength(150)
  name: string;

  @ApiProperty({ required: false, example: 'Tchê Grill Restaurante' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  tradeName?: string;

  @ApiProperty({ example: '12.345.678/0001-90' })
  @IsCnpj()
  document: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsPhoneNumber('BR', { message: 'Informe um telefone válido.' })
  phone?: string;
}
