import { ApiProperty } from '@nestjs/swagger';
import { CompanyContactType } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CompanyContactDto {
  @ApiProperty({
    required: false,
    description: 'Informe ao editar um contato existente.',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ enum: CompanyContactType })
  @IsEnum(CompanyContactType)
  contactType: CompanyContactType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do contato.' })
  @MaxLength(150)
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  position?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsPhoneNumber('BR', { message: 'Informe um telefone válido.' })
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsPhoneNumber('BR', { message: 'Informe um WhatsApp válido.' })
  whatsapp?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
