import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateCostCenterDto {
  @ApiProperty()
  @IsUUID()
  companyId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do centro de custo.' })
  @MaxLength(150)
  name: string;
}
