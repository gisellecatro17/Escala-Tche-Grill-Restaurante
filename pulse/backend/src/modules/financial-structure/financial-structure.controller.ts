import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import {
  assertCompanyPermission,
  assertOrganizationPermission,
} from '../../common/utils/access-control.util';
import { RestoreVersionDto } from './dto/import-export.dto';
import {
  AnalyzeImportDto,
  ApplyImportWizardDto,
  ExportStructureFullQueryDto,
  ImportRowsQueryDto,
  SetImportMappingDto,
} from './dto/import-wizard.dto';
import { CreateHierarchyVersionDto } from './dto/common.dto';
import { DuplicateStructureDto } from './dto/duplicate-structure.dto';
import { HierarchyVersionsService } from './hierarchy-versions.service';
import { StructureDiagnosticsService } from './structure-diagnostics.service';
import { StructureDuplicationService } from './structure-duplication.service';
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
    private readonly diagnostics: StructureDiagnosticsService,
    private readonly duplication: StructureDuplicationService,
  ) {}

  @Get('diagnostics')
  @ApiOperation({
    summary:
      'Executa o diagnóstico de inconsistências da estrutura financeira. Apenas relata — nada é corrigido automaticamente.',
  })
  runDiagnostics(
    @Query('organizationId') organizationId: string,
    @Query('companyId') companyId: string | undefined,
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(
      actor,
      organizationId,
      'financial_structure.view',
    );
    return this.diagnostics.run(organizationId, companyId);
  }

  // ── Importação em etapas (seções 43 e 44) ──────────────────────────────────

  @Post('imports')
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(FileInterceptor('file'))
  @ApiMessage('Arquivo lido. Confirme o mapeamento das colunas.')
  @ApiOperation({
    summary:
      'Etapas 1 e 2: lê o arquivo (XLSX, CSV ou JSON), grava as linhas cruas e sugere o mapeamento de colunas. Nada é criado.',
  })
  analyzeImport(
    @Body() dto: AnalyzeImportDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(
      actor,
      dto.organizationId,
      'financial_structure.import',
    );
    return this.imports.analyze(
      { ...dto, fileName: dto.fileName ?? file?.originalname },
      file?.buffer,
      actor,
    );
  }

  @Patch('imports/:id/mapping')
  @ApiMessage('Mapeamento de colunas confirmado.')
  @ApiOperation({
    summary:
      'Etapa 3: confirma o mapeamento campo interno → coluna do arquivo. A sugestão automática nunca decide sozinha.',
  })
  async setImportMapping(
    @Param('id') id: string,
    @Body() dto: SetImportMappingDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const batch = await this.imports.findBatch(id);
    assertOrganizationPermission(
      actor,
      batch.organizationId,
      'financial_structure.import',
    );
    return this.imports.setMapping(id, dto, actor);
  }

  @Post('imports/:id/validate')
  @ApiMessage(
    'Validação concluída. Revise as inconsistências antes de aplicar.',
  )
  @ApiOperation({
    summary:
      'Etapas 4 e 5: valida linha por linha e grava o resultado em cada linha do lote.',
  })
  async validateImport(
    @Param('id') id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    const batch = await this.imports.findBatch(id);
    assertOrganizationPermission(
      actor,
      batch.organizationId,
      'financial_structure.import',
    );
    return this.imports.validateBatch(id, actor);
  }

  @Post('imports/:id/apply')
  @ApiMessage('Importação concluída.')
  @ApiOperation({
    summary:
      'Etapas 6 e 7: aplica as linhas aprovadas (ou apenas simula). Nenhum modo exclui registros existentes.',
  })
  async applyImport(
    @Param('id') id: string,
    @Body() dto: ApplyImportWizardDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const batch = await this.imports.findBatch(id);
    assertOrganizationPermission(
      actor,
      batch.organizationId,
      'financial_structure.import',
    );
    return this.imports.applyBatch(id, dto, actor);
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
      'financial_structure.import',
    );
    return this.imports.findBatches(organizationId, entity);
  }

  @Get('imports/:id')
  @ApiOperation({ summary: 'Detalha um lote de importação.' })
  async findImport(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    const batch = await this.imports.findBatch(id);
    assertOrganizationPermission(
      actor,
      batch.organizationId,
      'financial_structure.import',
    );
    return batch;
  }

  @Get('imports/:id/rows')
  @ApiOperation({
    summary:
      'Linhas do lote, com o status de validação de cada uma e o registro criado.',
  })
  async findImportRows(
    @Param('id') id: string,
    @Query() query: ImportRowsQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const batch = await this.imports.findBatch(id);
    assertOrganizationPermission(
      actor,
      batch.organizationId,
      'financial_structure.import',
    );
    return this.imports.findRows(id, query);
  }

  // ── Duplicação entre empresas (seção 46) ───────────────────────────────────

  @Post('duplicate')
  @ApiMessage('Estrutura duplicada com sucesso.')
  @ApiOperation({
    summary:
      'Copia a estrutura de uma empresa para outra da mesma organização. Copia apenas a estrutura — nunca lançamentos, saldos, conciliações, histórico de uso ou auditoria da origem.',
  })
  duplicateStructure(
    @Body() dto: DuplicateStructureDto,
    @CurrentUser() actor: RequestUser,
  ) {
    // Ambas as empresas são verificadas: sem isso, alguém com acesso apenas ao
    // destino copiaria a estrutura de uma empresa que não pode ver.
    assertCompanyPermission(
      actor,
      dto.sourceCompanyId,
      'financial_structure.view',
    );
    assertCompanyPermission(
      actor,
      dto.targetCompanyId,
      'financial_structure.duplicate',
    );
    return this.duplication.duplicate(dto, actor);
  }

  // ── Exportação (seção 45) ──────────────────────────────────────────────────

  @Get('export')
  @ApiOperation({
    summary:
      'Exporta um cadastro da estrutura financeira em CSV, JSON, XLSX ou PDF.',
  })
  export(
    @Query() query: ExportStructureFullQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(
      actor,
      query.organizationId,
      'financial_structure.export',
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
      'financial_structure.manage_versions',
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
      'financial_structure.manage_versions',
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
      'financial_structure.manage_versions',
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
      'financial_structure.manage_versions',
    );
    return this.versions.restore(id, dto.reason, actor);
  }
}
