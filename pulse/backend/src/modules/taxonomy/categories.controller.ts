import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ApiMessage } from '../../common/decorators/api-message.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/types/authenticated-request';
import { assertCompanyPermission } from '../../common/utils/access-control.util';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';

/**
 * Estrutura mínima e reutilizável de categorias financeiras (seção 29 do prompt de
 * fornecedores) — suporta o cadastro rápido a partir do vínculo de fornecedor com a
 * empresa. O módulo completo de categorias fica para uma etapa futura.
 */
@ApiTags('Categorias financeiras')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista as categorias financeiras de uma empresa.' })
  findAll(
    @Query('companyId') companyId: string,
    @Query('search') search: string | undefined,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, companyId, 'categories.view');
    return this.categoriesService.findAll(companyId, search);
  }

  @Post()
  @ApiMessage('Categoria incluída com sucesso.')
  @ApiOperation({
    summary: 'Inclui uma categoria (ou subcategoria) financeira.',
  })
  create(@Body() dto: CreateCategoryDto, @CurrentUser() actor: RequestUser) {
    assertCompanyPermission(actor, dto.companyId, 'categories.manage');
    return this.categoriesService.create(dto);
  }
}
