import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/** Corpo de POST /companies/:id/users — a empresa vem da rota. */
export class AddCompanyUserDto {
  @ApiProperty()
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do usuário.' })
  @MaxLength(150)
  name: string;

  @ApiProperty({ description: 'Perfil atribuído ao usuário nesta empresa.' })
  @IsUUID()
  roleId: string;
}
