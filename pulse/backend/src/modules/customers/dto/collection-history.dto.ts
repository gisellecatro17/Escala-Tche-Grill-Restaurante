import { ApiProperty } from '@nestjs/swagger';
import { CollectionChannel } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

/** Registro de cobrança (seção 50) — nenhum envio real é disparado nesta etapa. */
export class CollectionHistoryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  contractId?: string;

  @ApiProperty({ enum: CollectionChannel })
  @IsEnum(CollectionChannel)
  channel: CollectionChannel;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  recipientName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  recipientAddress?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  deliveryStatus?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  response?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
