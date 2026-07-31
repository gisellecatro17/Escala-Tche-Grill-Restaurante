import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsIn, IsUUID } from 'class-validator';

/**
 * Aspectos que poderão ser duplicados entre empresas. As estruturas ainda não
 * desenvolvidas (categorias, centros de custo, formas de pagamento, regras de aprovação
 * e de conciliação) ficam identificadas como indisponíveis nesta etapa — a interface e o
 * serviço já estão prontos para recebê-las nas próximas entregas.
 */
export const DUPLICATE_SETTINGS_ASPECTS = [
  'CATEGORIES',
  'COST_CENTERS',
  'PAYMENT_METHODS',
  'FINANCIAL_PARAMETERS',
  'ACCESS_PROFILES',
  'APPROVAL_RULES',
  'RECONCILIATION_RULES',
] as const;

export type DuplicateSettingsAspect =
  (typeof DUPLICATE_SETTINGS_ASPECTS)[number];

export class DuplicateSettingsDto {
  @ApiProperty()
  @IsUUID()
  targetCompanyId: string;

  @ApiProperty({ enum: DUPLICATE_SETTINGS_ASPECTS, isArray: true })
  @IsArray()
  @ArrayMinSize(1, { message: 'Selecione ao menos um item para duplicar.' })
  @IsIn(DUPLICATE_SETTINGS_ASPECTS, { each: true })
  aspects: DuplicateSettingsAspect[];
}
