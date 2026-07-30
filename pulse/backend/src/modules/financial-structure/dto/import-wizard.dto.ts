import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  HierarchyEntity,
  StructureImportFormat,
  StructureImportMode,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

/** Formatos de exportação suportados (seção 45). */
export const EXPORT_FORMATS_FULL = ['csv', 'json', 'xlsx', 'pdf'] as const;
export type ExportFormatFull = (typeof EXPORT_FORMATS_FULL)[number];

/**
 * Etapas 1 e 2 do assistente: enviar o arquivo e escolher o cadastro de destino. O
 * arquivo é apenas lido e as linhas são gravadas cruas — nenhum registro é criado aqui.
 */
export class AnalyzeImportDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiPropertyOptional({
    description:
      'Obrigatório para categorias, centros de custo, centros de resultado e projetos.',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiProperty({ enum: HierarchyEntity })
  @IsEnum(HierarchyEntity)
  entity: HierarchyEntity;

  @ApiPropertyOptional({
    enum: StructureImportFormat,
    description:
      'Omitido, o formato é deduzido pela extensão do arquivo. Modelos de ERP apenas mapeiam nomes de colunas.',
  })
  @IsOptional()
  @IsEnum(StructureImportFormat)
  format?: StructureImportFormat;

  @ApiPropertyOptional({
    description: 'Conteúdo colado diretamente, como alternativa ao upload.',
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileName?: string;
}

/**
 * Etapa 3: mapeamento de colunas — campo interno → cabeçalho do arquivo. Enviado
 * explicitamente para que a sugestão automática nunca decida sozinha.
 */
export class SetImportMappingDto {
  @ApiProperty({
    example: { code: 'Codigo', name: 'Descricao', parentCode: 'Conta Pai' },
    description: 'Campo interno → nome exato da coluna no arquivo.',
  })
  @IsObject()
  mapping: Record<string, string>;
}

/** Etapas 6 e 7: aplicar o lote (ou apenas simular). */
export class ApplyImportWizardDto {
  @ApiPropertyOptional({
    enum: StructureImportMode,
    default: StructureImportMode.INSERT_ONLY,
    description:
      'SIMULATE não grava nada: apenas informa o que seria criado e atualizado. Nenhum modo exclui registros existentes.',
  })
  @IsOptional()
  @IsEnum(StructureImportMode)
  mode?: StructureImportMode;

  @ApiPropertyOptional({
    default: false,
    description:
      'Aplica também as linhas com aviso (código já existente, pai ausente resolvido pelo nível).',
  })
  @IsOptional()
  @IsBoolean()
  includeWarnings?: boolean;
}

export class ImportRowsQueryDto {
  @ApiPropertyOptional({ enum: ['VALID', 'WARNING', 'ERROR'] })
  @IsOptional()
  @IsIn(['VALID', 'WARNING', 'ERROR'])
  status?: 'VALID' | 'WARNING' | 'ERROR';
}

export class ExportStructureFullQueryDto {
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

  @ApiPropertyOptional({ enum: EXPORT_FORMATS_FULL, default: 'csv' })
  @IsOptional()
  @IsIn(EXPORT_FORMATS_FULL)
  format?: ExportFormatFull;

  @ApiPropertyOptional({
    default: false,
    description: 'Inclui também os registros inativos e arquivados.',
  })
  @IsOptional()
  @Type(() => Boolean)
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeInactive?: boolean;
}
