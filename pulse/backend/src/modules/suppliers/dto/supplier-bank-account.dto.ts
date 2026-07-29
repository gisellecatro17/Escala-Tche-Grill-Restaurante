import { ApiProperty } from '@nestjs/swagger';
import { SupplierBankAccountType } from '@prisma/client';
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

export class SupplierBankAccountDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  financialInstitutionId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe a agência.' })
  @MaxLength(20)
  branchNumber: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  branchDigit?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe a conta.' })
  @MaxLength(30)
  accountNumber: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  accountDigit?: string;

  @ApiProperty({ enum: SupplierBankAccountType })
  @IsEnum(SupplierBankAccountType)
  accountType: SupplierBankAccountType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do titular.' })
  @MaxLength(200)
  holderName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe o CPF/CNPJ do titular.' })
  holderDocument: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiProperty({
    required: false,
    default: false,
    description:
      'Indica que o titular da conta é diferente do fornecedor (seção 24) — exige justificativa.',
  })
  @IsOptional()
  @IsBoolean()
  isThirdParty?: boolean;

  @ApiProperty({ required: false })
  @ValidateIf((o: SupplierBankAccountDto) => o.isThirdParty === true)
  @IsString()
  @IsNotEmpty({
    message: 'Informe o motivo da utilização de conta de terceiro.',
  })
  @MaxLength(500)
  thirdPartyReason?: string;
}
