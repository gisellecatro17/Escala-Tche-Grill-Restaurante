import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class UpdateMembershipDto {
  @ApiProperty({
    description: 'Novo perfil atribuído ao usuário nesta empresa.',
  })
  @IsUUID()
  roleId: string;
}
