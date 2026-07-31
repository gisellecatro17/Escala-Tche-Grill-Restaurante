import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

const IDENTIFIER_TYPES = [
  'CPF',
  'CNPJ',
  'PIX_KEY',
  'BANK_ACCOUNT',
  'LEGAL_NAME',
  'TRADE_NAME',
  'ALTERNATIVE_NAME',
  'BANK_DESCRIPTION',
  'KEYWORD',
  'LEARNED_IDENTIFIER',
] as const;

/** Identificador para reconhecimento futuro do cliente em recebimentos (seção 36). */
export class BankIdentifierDto {
  @ApiProperty({ enum: IDENTIFIER_TYPES })
  @IsIn(IDENTIFIER_TYPES)
  identifierType: (typeof IDENTIFIER_TYPES)[number];

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe o valor do identificador.' })
  identifierValue: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiProperty({ required: false, default: 100 })
  @IsOptional()
  @IsNumber()
  priority?: number;

  @ApiProperty({ required: false, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  confidence?: number;
}
