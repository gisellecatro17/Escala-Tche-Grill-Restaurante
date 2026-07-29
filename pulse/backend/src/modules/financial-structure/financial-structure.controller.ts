import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { HierarchyEntity } from '@prisma/client';

import { ApiMessage } from '../../common/decorators/api-message.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import type { RequestUser } from '../../common/types/authenticated-request';
import { assertOrganizationPermission } from '../../common/utils/access-control.util';
import {
  ApplyImportDto,
  ExportStructureQueryDto,
  ImportStructureDto,
  RestoreVersionDto,
} from './dto/import-export.dto';
import { CreateHierarchyVersionDto } from './dto/common.dto';
import { HierarchyVersionsService } from './hierarchy-versions.service';
import { StructureImportService } from './structure-import.service';

/**
 * Operações transversais da estrutura financeira: importação, exportação e
 * versionamento das árvores.
 */
@ApiTags('Estrutura financeira')
@ApiBearerAuth()
@Controller('financial-structure')
export class FinancialStructureController {
  constructor(
    private readonly imports: StructureImportService,
    private readonly versions: HierarchyVersionsService,
  ) {}

  // ── Importação ─────────────────────────────────────────────────────────────

  @Post('imports')
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(FileInterceptor('file'))
  @ApiMessage('Arquivo validado. Confira a pré-visualização antes de aplicar.')
  @ApiOperation({
    summary:
      'Etapa 1 da importação: valida o conteúdo e grava a pré-visualização, sem criar nada.',
  })
  validateImport(
    @Body() dto: ImportStructureDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(
      actor,
      dto.organizationId,
      'financial-structure.import',
    );
    return this.imports.validate(dto, file?.buffer.toString('utf-8'), actor);
  }

  @Post('imports/:id/apply')
  @ApiMessage('Importação aplicada com sucesso.')
  @ApiOperation({
    summary:
      'Etapa 2 da importação: aplica as linhas válidas, versionando a árvore antes.',
  })
  applyImport(
    @Param('id') id: string,
    @Body() dto: ApplyImportDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.imports.apply(id, dto, actor);
  }

  @Get('imports')
  @ApiOperation({ summary: 'Lista os lotes de importação recentes.' })
  findImports(
    @Query('organizationId') organizationId: string,
    @Query('entity') entity: HierarchyEntity | undefined,
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(
      actor,
      organizationId,
      'financial-structure.import',
    );
    return this.imports.findBatches(organizationId, entity);
  }

  // ── Exportação ─────────────────────────────────────────────────────────────

  @Get('export')
  @ApiOperation({
    summary: 'Exporta um cadastro da estrutura financeira em CSV ou JSON.',
  })
  export(
    @Query() query: ExportStructureQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(
      actor,
      query.organizationId,
      'financial-structure.export',
    );
    return this.imports.export(query, actor);
  }

  // ── Versionamento ──────────────────────────────────────────────────────────

  @Get('versions')
  @ApiOperation({ summary: 'Lista as versões (snapshots) das árvores.' })
  findVersions(
    @Query() query: PaginationQueryDto,
    @Query('organizationId') organizationId: string,
    @Query('entity') entity: HierarchyEntity | undefined,
    @Query('companyId') companyId: string | undefined,
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(
      actor,
      organizationId,
      'financial-structure.manage_versions',
    );
    return this.versions.findAll(organizationId, entity, companyId, query);
  }

  @Get('versions/:id')
  @ApiOperation({
    summary: 'Detalha uma versão, incluindo o snapshot completo.',
  })
  async findVersion(
    @Param('id') id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    const version = await this.versions.findOne(id);
    assertOrganizationPermission(
      actor,
      version.organizationId,
      'financial-structure.manage_versions',
    );
    return version;
  }

  @Post('versions')
  @ApiMessage('Versão criada com sucesso.')
  @ApiOperation({ summary: 'Cria manualmente um snapshot da estrutura atual.' })
  createVersion(
    @Body() dto: CreateHierarchyVersionDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(
      actor,
      dto.organizationId,
      'financial-structure.manage_versions',
    );
    return this.versions.snapshot({
      organizationId: dto.organizationId,
      companyId: dto.companyId,
      entity: dto.entity,
      label: dto.label,
      reason: dto.reason,
      actorId: actor.id,
    });
  }

  @Post('versions/:id/restore')
  @ApiMessage('Estrutura restaurada com sucesso.')
  @ApiOperation({
    summary:
      'Restaura a hierarquia gravada em uma versão. Registros criados depois são preservados.',
  })
  async restoreVersion(
    @Param('id') id: string,
    @Body() dto: RestoreVersionDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const version = await this.versions.findOne(id);
    assertOrganizationPermission(
      actor,
      version.organizationId,
      'financial-structure.manage_versions',
    );
    return this.versions.restore(id, dto.reason, actor);
  }
}
