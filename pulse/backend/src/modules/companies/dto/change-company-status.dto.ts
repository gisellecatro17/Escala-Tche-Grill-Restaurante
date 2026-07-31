import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Usado para inativar/suspender uma empresa — o motivo é obrigatório nesses dois casos. */
export class ChangeCompanyStatusDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo.' })
  @MaxLength(500)
  reason?: string;
}
