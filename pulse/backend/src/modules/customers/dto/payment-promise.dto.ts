import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

/** Promessa de pagamento (seção 51). */
export class PaymentPromiseDto {
  @ApiProperty()
  @IsNumber()
  @Min(0.01, { message: 'Informe o valor prometido.' })
  promisedAmount: number;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty({ message: 'Informe a data prometida.' })
  promisedDate: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  collectionHistoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  customerContactId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  responsibleUserId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
