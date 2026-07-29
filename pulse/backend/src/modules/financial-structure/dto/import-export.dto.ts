import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HierarchyEntity, StructureImportFormat } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export const EXPORT_FORMATS = ['csv', 'json'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/**
 * Envia um arquivo (ou conteúdo textual) para validação. A importação é sempre feita em
 * duas etapas: primeiro valida e gera a pré-visualização, depois aplica.
 */
export class ImportStructureDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiProperty({ enum: HierarchyEntity })
  @IsEnum(HierarchyEntity)
  entity: HierarchyEntity;

  @ApiPropertyOptional({
    enum: StructureImportFormat,
    default: StructureImportFormat.CSV,
    description:
      'Modelos de ERP (CONTA_AZUL, OMIE, SAP, TOTVS) apenas mapeiam nomes de colunas diferentes para o mesmo formato tabular.',
  })
  @IsOptional()
  @IsEnum(StructureImportFormat)
  format?: StructureImportFormat;

  @ApiPropertyOptional({
    description:
      'Conteúdo CSV/TSV colado diretamente. Alternativa ao upload de arquivo.',
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Atualiza registros existentes quando o código já existir.',
  })
  @IsOptional()
  @IsBoolean()
  updateExisting?: boolean;
}

/** Aplica um lote previamente validado. */
export class ApplyImportDto {
  @ApiPropertyOptional({
    default: false,
    description: 'Atualiza registros existentes quando o código já existir.',
  })
  @IsOptional()
  @IsBoolean()
  updateExisting?: boolean;
}

export class ExportStructureQueryDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiProperty({ enum: HierarchyEntity })
  @IsEnum(HierarchyEntity)
  entity: HierarchyEntity;

  @ApiPropertyOptional({ enum: EXPORT_FORMATS, default: 'csv' })
  @IsOptional()
  @IsIn(EXPORT_FORMATS)
  format?: ExportFormat;
}

/** Restaura uma versão anterior de uma árvore. */
export class RestoreVersionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo da restauração.' })
  reason: string;
}
