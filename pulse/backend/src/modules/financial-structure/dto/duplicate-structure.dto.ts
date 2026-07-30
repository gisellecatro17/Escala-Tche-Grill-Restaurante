import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/**
 * Duplicação da estrutura financeira entre empresas (seção 46).
 *
 * Só a **estrutura** é copiada. Nunca são copiados lançamentos, saldos, movimentações,
 * conciliações, orçamentos realizados, histórico de uso nem a auditoria da empresa de
 * origem — esses pertencem à empresa que os gerou.
 */
export class DuplicateStructureDto {
  @ApiProperty({ description: 'Empresa de origem da estrutura.' })
  @IsUUID()
  sourceCompanyId: string;

  @ApiProperty({ description: 'Empresa que receberá a cópia.' })
  @IsUUID()
  targetCompanyId: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  accountPlan?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  categories?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  costCenters?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  resultCenters?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  businessUnits?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  financialTags?: boolean;

  @ApiPropertyOptional({
    default: false,
    description:
      'Copia as regras de rateio com suas linhas, remapeadas para os registros copiados.',
  })
  @IsOptional()
  @IsBoolean()
  allocationRules?: boolean;

  @ApiPropertyOptional({
    default: false,
    description:
      'Copia as regras de classificação com condições e ações. As regras copiadas nascem inativas para revisão.',
  })
  @IsOptional()
  @IsBoolean()
  classificationRules?: boolean;

  @ApiPropertyOptional({
    default: false,
    description: 'Copia também os registros inativos e arquivados.',
  })
  @IsOptional()
  @IsBoolean()
  includeInactive?: boolean;

  @ApiProperty({ example: 'Abertura da nova filial' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo da duplicação.' })
  @MaxLength(500)
  reason: string;
}
