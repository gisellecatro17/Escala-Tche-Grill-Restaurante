import { ApiProperty } from '@nestjs/swagger';
import { CollectionChannel } from '@prisma/client';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Regra de cobrança do vínculo (seções 47-49 do prompt de clientes). */
export class BillingRuleDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ruleType?: string;

  @ApiProperty({
    example: 'due_date',
    description: 'Evento de referência (ex.: vencimento).',
  })
  @IsString()
  @IsNotEmpty({ message: 'Informe o evento de referência.' })
  referenceEvent: string;

  @ApiProperty({
    example: -5,
    description:
      'Deslocamento em dias em relação ao evento (negativo = antes).',
  })
  @IsInt()
  daysOffset: number;

  @ApiProperty({ enum: CollectionChannel })
  @IsEnum(CollectionChannel)
  channel: CollectionChannel;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  messageTemplateId?: string;

  @ApiProperty({ required: false, minimum: 0, maximum: 23 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  preferredHour?: number;

  @ApiProperty({
    required: false,
    type: [Number],
    description: '0 (domingo) a 6 (sábado)',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  allowedWeekdays?: number[];

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  automatic?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  responsibleUserId?: string;

  @ApiProperty({ required: false, default: 100 })
  @IsOptional()
  @IsInt()
  priority?: number;
}
