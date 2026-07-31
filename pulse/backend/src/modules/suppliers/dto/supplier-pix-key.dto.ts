import { ApiProperty } from '@nestjs/swagger';
import { PixKeyType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class SupplierPixKeyDto {
  @ApiProperty({ enum: PixKeyType })
  @IsEnum(PixKeyType)
  pixType: PixKeyType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe a chave PIX.' })
  @MaxLength(200)
  pixKey: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do titular.' })
  @MaxLength(200)
  holderName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe o CPF/CNPJ do titular.' })
  holderDocument: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  bankAccountId?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isThirdParty?: boolean;

  @ApiProperty({ required: false })
  @ValidateIf((o: SupplierPixKeyDto) => o.isThirdParty === true)
  @IsString()
  @IsNotEmpty({
    message: 'Informe o motivo da utilização de chave PIX de terceiro.',
  })
  @MaxLength(500)
  thirdPartyReason?: string;
}
