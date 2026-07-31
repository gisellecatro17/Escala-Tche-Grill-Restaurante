import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ApiMessage } from '../../common/decorators/api-message.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/types/authenticated-request';
import { assertCompanyPermission } from '../../common/utils/access-control.util';
import {
  DuplicateNodeDto,
  MoveNodeDto,
} from '../financial-structure/dto/common.dto';
import { CategoriesService } from './categories.service';
import { LifecycleController } from '../financial-structure/structure-lifecycle.mixin';
import { StructureLifecycleService } from '../financial-structure/structure-lifecycle.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/create-category.dto';

/**
 * Categorias financeiras e subcategorias (hierarquia de profundidade ilimitada no mesmo
 * cadastro). Continua atendendo o cadastro rápido a partir dos vínculos de fornecedor e
 * de cliente, agora com CRUD completo, árvore, movimentação e duplicação.
 */
@ApiTags('Categorias financeiras')
@ApiBearerAuth()
@Controller('financial-categories')
export class CategoriesController extends LifecycleController(
  'financialCategory',
  'financial_category',
) {
  constructor(
    private readonly categoriesService: CategoriesService,
    lifecycle: StructureLifecycleService,
  ) {
    super(lifecycle);
  }

  @Get()
  @ApiOperation({ summary: 'Lista as categorias financeiras de uma empresa.' })
  findAll(
    @Query('companyId') companyId: string,
    @Query('search') search: string | undefined,
    @Query('includeInactive') includeInactive: string | undefined,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, companyId, 'financial_category.view');
    return this.categoriesService.findAll(
      companyId,
      search,
      includeInactive === 'true',
    );
  }

  @Get('tree')
  @ApiOperation({
    summary: 'Retorna a árvore completa de categorias e subcategorias.',
  })
  findTree(
    @Query('companyId') companyId: string,
    @Query('includeInactive') includeInactive: string | undefined,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, companyId, 'financial_category.view');
    return this.categoriesService.findTree(
      companyId,
      includeInactive === 'true',
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detalha uma categoria, com dimensões e regras padrão.',
  })
  async findOne(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    const category = await this.categoriesService.findOne(id);
    assertCompanyPermission(
      actor,
      category.companyId,
      'financial_category.view',
    );
    return category;
  }

  @Post()
  @ApiMessage('Categoria incluída com sucesso.')
  @ApiOperation({
    summary: 'Inclui uma categoria (ou subcategoria) financeira.',
  })
  create(@Body() dto: CreateCategoryDto, @CurrentUser() actor: RequestUser) {
    assertCompanyPermission(actor, dto.companyId, 'financial_category.manage');
    return this.categoriesService.create(dto, actor);
  }

  @Patch(':id')
  @ApiMessage('Categoria atualizada com sucesso.')
  @ApiOperation({ summary: 'Atualiza uma categoria financeira.' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const category = await this.categoriesService.findOne(id);
    assertCompanyPermission(
      actor,
      category.companyId,
      'financial_category.manage',
    );
    return this.categoriesService.update(id, dto, actor);
  }

  @Post(':id/move')
  @ApiMessage('Categoria movida com sucesso.')
  @ApiOperation({
    summary:
      'Move a categoria na árvore (exige permissão específica de estrutura).',
  })
  async move(
    @Param('id') id: string,
    @Body() dto: MoveNodeDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const category = await this.categoriesService.findOne(id);
    assertCompanyPermission(
      actor,
      category.companyId,
      'financial_category.move',
    );
    return this.categoriesService.move(id, dto, actor);
  }

  @Post(':id/duplicate')
  @ApiMessage('Categoria duplicada com sucesso.')
  @ApiOperation({
    summary: 'Duplica a categoria, opcionalmente para outra empresa.',
  })
  async duplicate(
    @Param('id') id: string,
    @Body() dto: DuplicateNodeDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const category = await this.categoriesService.findOne(id);
    assertCompanyPermission(
      actor,
      category.companyId,
      'financial_structure.duplicate',
    );
    if (dto.targetCompanyId) {
      assertCompanyPermission(
        actor,
        dto.targetCompanyId,
        'financial_category.manage',
      );
    }
    return this.categoriesService.duplicate(id, dto, actor);
  }

  @Delete(':id')
  @ApiMessage('Categoria excluída com sucesso.')
  @ApiOperation({
    summary: 'Exclui (logicamente) uma categoria sem subcategorias nem uso.',
  })
  async remove(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    const category = await this.categoriesService.findOne(id);
    assertCompanyPermission(
      actor,
      category.companyId,
      'financial_category.delete',
    );
    return this.categoriesService.remove(id, actor);
  }
}
