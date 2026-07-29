import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HierarchyEntity, RecordStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/** Move um nó da árvore para outro pai e/ou outra posição entre os irmãos. */
export class MoveNodeDto {
  @ApiPropertyOptional({
    description: 'Novo pai. `null` move o nó para a raiz da árvore.',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @ApiPropertyOptional({
    description: 'Posição entre os irmãos (0 = primeiro).',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

/** Duplica um cadastro da estrutura financeira (opcionalmente para outra empresa). */
export class DuplicateNodeDto {
  @ApiPropertyOptional({
    description:
      'Empresa de destino. Ausente = duplica dentro da mesma empresa.',
  })
  @IsOptional()
  @IsUUID()
  targetCompanyId?: string;

  @ApiPropertyOptional({ description: 'Nome do novo registro.' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Código do novo registro.' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Duplica também toda a subárvore de descendentes.',
  })
  @IsOptional()
  @IsBoolean()
  includeChildren?: boolean;
}

/** Filtros comuns aos cadastros da estrutura financeira. */
export class StructureQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional({ enum: RecordStatus })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;

  @ApiPropertyOptional({ description: 'Filtra pelos filhos diretos deste nó.' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({
    description: 'Inclui registros inativos na resposta.',
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeInactive?: boolean;
}

/** Cria uma versão (snapshot) da estrutura antes/depois de uma alteração relevante. */
export class CreateHierarchyVersionDto {
  @ApiProperty({ enum: HierarchyEntity })
  @IsEnum(HierarchyEntity)
  entity: HierarchyEntity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

/** Vincula ou desvincula uma tag de um cadastro da estrutura financeira. */
export class TagLinkDto {
  @ApiProperty()
  @IsUUID()
  tagId: string;

  @ApiProperty({
    example: 'Category',
    description:
      'Category | FinancialAccountPlan | CostCenter | ResultCenter | Project | BusinessUnit',
  })
  @IsString()
  @IsNotEmpty()
  entityType: string;

  @ApiProperty()
  @IsUUID()
  entityId: string;
}
