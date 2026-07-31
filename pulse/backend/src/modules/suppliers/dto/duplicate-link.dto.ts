import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsIn, IsUUID } from 'class-validator';

/** Itens copiáveis ao duplicar um vínculo de fornecedor para outra empresa (seção 52). */
export const DUPLICATE_LINK_ASPECTS = [
  'DEFAULT_CATEGORY',
  'DEFAULT_SUBCATEGORY',
  'DEFAULT_COST_CENTER',
  'ACCOUNTING_ACCOUNT',
  'PAYMENT_TERMS',
  'PAYMENT_METHOD',
  'BANK_DATA',
  'PIX_KEYS',
  'TAX_WITHHOLDINGS',
  'ALLOCATIONS',
  'AUTOMATION_RULES',
  'CONTRACTS',
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
