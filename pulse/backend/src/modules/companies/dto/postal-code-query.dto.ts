import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class PostalCodeQueryDto {
  @ApiProperty({ example: '44350-000' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o CEP a ser consultado.' })
  postalCode: string;
}
