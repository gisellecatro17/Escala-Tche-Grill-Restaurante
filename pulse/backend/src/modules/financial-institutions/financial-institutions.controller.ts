import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { FinancialInstitutionsService } from './financial-institutions.service';

/** Catálogo de instituições financeiras (seção 23 do prompt de fornecedores), reutilizável
 * por qualquer módulo que precise selecionar um banco (ex.: contas bancárias de fornecedor). */
@ApiTags('Instituições financeiras')
@ApiBearerAuth()
@Controller('financial-institutions')
export class FinancialInstitutionsController {
  constructor(
    private readonly financialInstitutionsService: FinancialInstitutionsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Busca instituições financeiras por código, ISPB ou nome.',
  })
  findAll(@Query('search') search?: string) {
    return this.financialInstitutionsService.findAll(search);
  }
}
