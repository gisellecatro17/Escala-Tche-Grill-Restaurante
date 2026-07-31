import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ApiMessage } from '../../common/decorators/api-message.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import type { RequestUser } from '../../common/types/authenticated-request';
import { assertCompanyPermission } from '../../common/utils/access-control.util';
import { AllocationDto } from './dto/allocation.dto';
import { ChangeLinkStatusDto } from './dto/change-link-status.dto';
import { ClassificationRuleDto } from './dto/classification-rule.dto';
import { ContractDto } from './dto/contract.dto';
import { DuplicateLinkDto } from './dto/duplicate-link.dto';
import { TaxWithholdingDto } from './dto/tax-withholding.dto';
import { UpdateCompanyLinkDto } from './dto/update-company-link.dto';
import { SupplierCompanyLinksService } from './supplier-company-links.service';

@ApiTags('Fornecedores — vínculo com a empresa')
@ApiBearerAuth()
@Controller('supplier-company-links')
export class SupplierCompanyLinksController {
  constructor(private readonly linksService: SupplierCompanyLinksService) {}

  @Get(':id')
  @ApiOperation({
    summary: 'Consulta o vínculo de um fornecedor com uma empresa.',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    const link = await this.linksService.getLink(id);
    assertCompanyPermission(actor, link.companyId, 'supplier.view');
    return link;
  }

  @Get(':id/audit')
  @ApiOperation({
    summary: 'Histórico de auditoria do vínculo (somente leitura).',
  })
  async auditLog(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const link = await this.linksService.getLink(id);
    assertCompanyPermission(actor, link.companyId, 'supplier.view_audit');
    return this.linksService.getAuditLog(id, query.page, query.perPage);
  }

  @Patch(':id')
  @ApiMessage('Classificação financeira atualizada com sucesso.')
  @ApiOperation({
    summary:
      'Atualiza a classificação, condições comerciais e automações do vínculo.',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyLinkDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const link = await this.linksService.getLink(id);
    assertCompanyPermission(
      actor,
      link.companyId,
      'supplier.manage_classification',
    );
    return this.linksService.updateLink(id, dto, actor);
  }

  @Post(':id/activate')
  @ApiMessage('Fornecedor ativado com sucesso.')
  @ApiOperation({ summary: 'Ativa o vínculo do fornecedor com a empresa.' })
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    const link = await this.linksService.getLink(id);
    assertCompanyPermission(actor, link.companyId, 'supplier.activate');
    return this.linksService.activate(id, actor);
  }

  @Post(':id/deactivate')
  @ApiMessage('Fornecedor inativado com sucesso.')
  @ApiOperation({ summary: 'Inativa o vínculo do fornecedor com a empresa.' })
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeLinkStatusDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const link = await this.linksService.getLink(id);
    assertCompanyPermission(actor, link.companyId, 'supplier.deactivate');
    return this.linksService.deactivate(id, dto, actor);
  }

  @Post(':id/suspend')
  @ApiMessage('Fornecedor suspenso com sucesso.')
  @ApiOperation({ summary: 'Suspende o vínculo do fornecedor com a empresa.' })
  async suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeLinkStatusDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const link = await this.linksService.getLink(id);
    assertCompanyPermission(actor, link.companyId, 'supplier.suspend');
    return this.linksService.suspend(id, dto, actor);
  }

  @Post(':id/block')
  @ApiMessage('Fornecedor bloqueado com sucesso.')
  @ApiOperation({
    summary:
      'Bloqueia o fornecedor para a empresa selecionada (motivo obrigatório).',
  })
  async block(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeLinkStatusDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const link = await this.linksService.getLink(id);
    assertCompanyPermission(actor, link.companyId, 'supplier.block');
    return this.linksService.block(id, dto, actor);
  }

  @Post(':id/unblock')
  @ApiMessage('Fornecedor desbloqueado com sucesso.')
  @ApiOperation({
    summary: 'Desbloqueia o fornecedor para a empresa selecionada.',
  })
  async unblock(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    const link = await this.linksService.getLink(id);
    assertCompanyPermission(actor, link.companyId, 'supplier.unblock');
    return this.linksService.unblock(id, actor);
  }

  @Delete(':id')
  @ApiMessage('Vínculo excluído com sucesso.')
  @ApiOperation({
    summary:
      'Exclui o vínculo do fornecedor com a empresa (somente rascunho sem uso).',
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    const link = await this.linksService.getLink(id);
    assertCompanyPermission(actor, link.companyId, 'supplier.delete');
    return this.linksService.remove(id, actor);
  }

  @Post(':id/duplicate')
  @ApiMessage('Vínculo duplicado com sucesso.')
  @ApiOperation({
    summary:
      'Duplica o vínculo do fornecedor para outra empresa (não duplica o cadastro global).',
  })
  async duplicate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DuplicateLinkDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const link = await this.linksService.getLink(id);
    assertCompanyPermission(actor, link.companyId, 'supplier.duplicate_link');
    assertCompanyPermission(
      actor,
      dto.targetCompanyId,
      'supplier.manage_company_link',
    );
    return this.linksService.duplicate(id, dto, actor);
  }

  @Post(':id/classification-rules')
  @ApiMessage('Regra de classificação incluída com sucesso.')
  @ApiOperation({
    summary: 'Inclui uma regra de classificação automática alternativa.',
  })
  async addClassificationRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ClassificationRuleDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const link = await this.linksService.getLink(id);
    assertCompanyPermission(actor, link.companyId, 'supplier.manage_rules');
    return this.linksService.addClassificationRule(id, dto, actor);
  }

  @Patch(':id/classification-rules/:ruleId')
  @ApiMessage('Regra de classificação atualizada com sucesso.')
  @ApiOperation({ summary: 'Edita uma regra de classificação automática.' })
  async updateClassificationRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() dto: Partial<ClassificationRuleDto>,
    @CurrentUser() actor: RequestUser,
  ) {
    const link = await this.linksService.getLink(id);
    assertCompanyPermission(actor, link.companyId, 'supplier.manage_rules');
    return this.linksService.updateClassificationRule(id, ruleId, dto, actor);
  }

  @Post(':id/allocations')
  @ApiMessage('Rateio incluído com sucesso.')
  @ApiOperation({ summary: 'Inclui um item de rateio padrão do vínculo.' })
  async addAllocation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AllocationDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const link = await this.linksService.getLink(id);
    assertCompanyPermission(
      actor,
      link.companyId,
      'supplier.manage_allocations',
    );
    return this.linksService.addAllocation(id, dto, actor);
  }

  @Post(':id/tax-withholdings')
  @ApiMessage('Retenção incluída com sucesso.')
  @ApiOperation({
    summary: 'Inclui uma retenção tributária padrão do vínculo.',
  })
  async addTaxWithholding(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TaxWithholdingDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const link = await this.linksService.getLink(id);
    assertCompanyPermission(
      actor,
      link.companyId,
      'supplier.manage_withholdings',
    );
    return this.linksService.addTaxWithholding(id, dto, actor);
  }

  @Post(':id/contracts')
  @ApiMessage('Contrato incluído com sucesso.')
  @ApiOperation({ summary: 'Inclui um contrato do fornecedor com a empresa.' })
  async addContract(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ContractDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const link = await this.linksService.getLink(id);
    assertCompanyPermission(actor, link.companyId, 'supplier.manage_contracts');
    return this.linksService.addContract(id, dto, actor);
  }
}
