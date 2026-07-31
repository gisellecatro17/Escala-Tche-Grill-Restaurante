import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class InviteUserDto {
  @ApiProperty()
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do usuário.' })
  @MaxLength(150)
  name: string;

  @ApiProperty({ description: 'Empresa à qual o usuário será vinculado.' })
  @IsUUID()
  companyId: string;

  @ApiProperty({ description: 'Perfil atribuído ao usuário nesta empresa.' })
  @IsUUID()
  roleId: string;
}
