import { ApiProperty } from '@nestjs/swagger';
import { PaymentPromiseStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

/** Atualização de uma promessa de pagamento (seção 52) — atualização manual nesta etapa. */
export class UpdatePaymentPromiseDto {
  @ApiProperty({ required: false, enum: PaymentPromiseStatus })
  @IsOptional()
  @IsEnum(PaymentPromiseStatus)
  status?: PaymentPromiseStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fulfilledAmount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  fulfilledAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
