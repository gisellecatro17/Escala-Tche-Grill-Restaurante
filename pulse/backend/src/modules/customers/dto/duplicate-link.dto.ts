import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsIn, IsUUID } from 'class-validator';

/** Itens copiáveis ao duplicar um vínculo de cliente para outra empresa (seção 69). */
export const DUPLICATE_LINK_ASPECTS = [
  'REVENUE_CATEGORY',
  'SUBCATEGORY',
  'RESULT_CENTER',
  'PRODUCT_SERVICE',
  'PAYMENT_TERMS',
  'PAYMENT_METHOD',
  'INTEREST_AND_FEE_RULES',
  'CREDIT_LIMIT',
  'BILLING_RULES',
  'BANK_IDENTIFIERS',
  'CONTRACTS',
  'RECURRING_RECEIVABLES',
] as const;

export type DuplicateLinkAspect = (typeof DUPLICATE_LINK_ASPECTS)[number];

export class DuplicateLinkDto {
  @ApiProperty({ description: 'Empresa de destino do novo vínculo.' })
  @IsUUID()
  targetCompanyId: string;

  @ApiProperty({ enum: DUPLICATE_LINK_ASPECTS, isArray: true })
  @IsArray()
  @ArrayMinSize(1, { message: 'Selecione ao menos um item para duplicar.' })
  @IsIn(DUPLICATE_LINK_ASPECTS, { each: true })
  aspects: DuplicateLinkAspect[];
}
