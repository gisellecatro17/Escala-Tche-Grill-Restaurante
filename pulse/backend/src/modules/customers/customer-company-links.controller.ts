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
import { BillingRuleDto } from './dto/billing-rule.dto';
import { ChangeLinkStatusDto } from './dto/change-link-status.dto';
import { CollectionHistoryDto } from './dto/collection-history.dto';
import { ContractAmendmentDto } from './dto/contract-amendment.dto';
import { ContractDto } from './dto/contract.dto';
import { DuplicateLinkDto } from './dto/duplicate-link.dto';
import { PaymentPromiseDto } from './dto/payment-promise.dto';
import { RecurringReceivableDto } from './dto/recurring-receivable.dto';
import { UpdateCompanyLinkDto } from './dto/update-company-link.dto';
import { UpdateCreditDto } from './dto/update-credit.dto';
import { UpdatePaymentPromiseDto } from './dto/update-payment-promise.dto';
import { CustomerCompanyLinksService } from './customer-company-links.service';

@ApiTags('Clientes — vínculo com a empresa')
@ApiBearerAuth()
@Controller('customer-company-links')
export class CustomerCompanyLinksController {
  constructor(private readonly linksService: CustomerCompanyLinksService) {}

  @Get(':id')
  @ApiOperation({
    summary: 'Consulta o vínculo de um cliente com uma empresa.',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    const link = await this.linksService.getLink(id);
    assertCompanyPermission(actor, link.companyId, 'customer.view');
    return this.linksService.getLink(id, actor);
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
    assertCompanyPermission(actor, link.companyId, 'customer.view_audit');
    return this.linksService.getAuditLog(id, query.page, query.perPage);
  }

  @Patch(':id')
  @ApiMessage('Classificação comercial atualizada com sucesso.')
  @ApiOperation({
    summary:
      'Atualiza a classificação comercial, condições de recebimento e automações do vínculo.',
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
      'customer.manage_classification',
    );
    return this.linksService.updateLink(id, dto, actor);
  }

  @Patch(':id/credit')
  @ApiMessage('Limite de crédito atualizado com sucesso.')
  @ApiOperation({
    summary:
      'Configura crédito e nível de risco do vínculo (permissão dedicada).',
  })
  async updateCredit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCreditDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const link = await this.linksService.getLink(id);
    assertCompanyPermission(
      actor,
      link.companyId,
      'customer.update_credit_limit',
    );
    return this.linksService.updateCredit(id, dto, actor);
  }

  @Post(':id/convert-prospect')
  @ApiMessage('Prospect convertido em cliente com sucesso.')
  @ApiOperation({
    summary:
      'Converte um prospect em cliente ativo (valida pendências mínimas).',
  })
  async convertProspect(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    const link = await this.linksService.getLink(id);
    assertCompanyPermission(actor, link.companyId, 'customer.convert_prospect');
    return this.linksService.convertProspect(id, actor);
  }

  @Post(':id/activate')
  @ApiMessage('Cliente ativado com sucesso.')
  @ApiOperation({ summary: 'Ativa o vínculo do cliente com a empresa.' })
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    const link = await this.linksService.getLink(id);
    assertCompanyPermission(actor, link.companyId, 'customer.activate');
    return this.linksService.activate(id, actor);
  }

  @Post(':id/deactivate')
  @ApiMessage('Cliente inativado com sucesso.')
  @ApiOperation({ summary: 'Inativa o vínculo do cliente com a empresa.' })
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeLinkStatusDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const link = await this.linksService.getLink(id);
    assertCompanyPermission(actor, link.companyId, 'customer.deactivate');
    return this.linksService.deactivate(id, dto, actor);
  }

  @Post(':id/suspend')
  @ApiMessage('Cliente suspenso com sucesso.')
  @ApiOperation({ summary: 'Suspende o vínculo do cliente com a empresa.' })
  async suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeLinkStatusDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const link = await this.linksService.getLink(id);
    assertCompanyPermission(actor, link.companyId, 'customer.suspend');
    return this.linksService.suspend(id, dto, actor);
  }

  @Post(':id/block')
  @ApiMessage('Cliente bloqueado com sucesso.')
  @ApiOperation({
    summary:
      'Bloqueia o cliente para a empresa selecionada (motivo obrigatório).',
  })
  async block(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeLinkStatusDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const link = await this.linksService.getLink(id);
    assertCompanyPermission(actor, link.companyId, 'customer.block');
    return this.linksService.block(id, dto, actor);
  }

  @Post(':id/unblock')
  @ApiMessage('Cliente desbloqueado com sucesso.')
  @ApiOperation({
    summary: 'Desbloqueia o cliente para a empresa selecionada.',
  })
  async unblock(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    const link = await this.linksService.getLink(id);
    assertCompanyPermission(actor, link.companyId, 'customer.unblock');
    return this.linksService.unblock(id, actor);
  }

  @Delete(':id')
  @ApiMessage('Vínculo excluído com sucesso.')
  @ApiOperation({
    summary:
      'Exclui o vínculo do cliente com a empresa (somente rascunho/prospect sem uso).',
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    const link = await this.linksService.getLink(id);
    assertCompanyPermission(actor, link.companyId, 'customer.delete');
    return this.linksService.remove(id, actor);
  }

  @Post(':id/duplicate')
  @ApiMessage('Vínculo duplicado com sucesso.')
  @ApiOperation({
    summary:
      'Duplica o vínculo do cliente para outra empresa (não duplica o cadastro geral).',
  })
  async duplicate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DuplicateLinkDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const link = await this.linksService.getLink(id);
    assertCompanyPermission(actor, link.companyId, 'customer.duplicate_link');
    assertCompanyPermission(
      actor,
      dto.targetCompanyId,
      'customer.manage_company_link',
    );
    return this.linksService.duplicate(id, dto, actor);
  }

  @Post(':id/billing-rules')
  @ApiMessage('Regra de cobrança incluída com sucesso.')
  @ApiOperation({ summary: 'Inclui uma regra de cobrança do vínculo.' })
  async addBillingRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BillingRuleDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const link = await this.linksService.getLink(id);
    assertCompanyPermission(
      actor,
      link.companyId,
      'customer.manage_billing_rules',
    );
    return this.linksService.addBillingRule(id, dto, actor);
  }

  @Post(':id/collection-history')
  @ApiMessage('Cobrança registrada com sucesso.')
  @ApiOperation({
    summary:
      'Registra uma cobrança realizada (nenhum envio real é disparado nesta etapa).',
  })
  async addCollectionHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CollectionHistoryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const link = await this.linksService.getLink(id);
    assertCompanyPermission(
      actor,
      link.companyId,
      'customer.manage_billing_rules',
    );
    return this.linksService.addCollectionHistory(id, dto, actor);
  }

  @Post(':id/payment-promises')
  @ApiMessage('Promessa de pagamento registrada com sucesso.')
  @ApiOperation({ summary: 'Registra uma promessa de pagamento do cliente.' })
  async addPaymentPromise(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PaymentPromiseDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const link = await this.linksService.getLink(id);
    assertCompanyPermission(
      actor,
      link.companyId,
      'customer.manage_payment_promises',
    );
    return this.linksService.addPaymentPromise(id, dto, actor);
  }

  @Patch(':id/payment-promises/:promiseId')
  @ApiMessage('Promessa de pagamento atualizada com sucesso.')
  @ApiOperation({
    summary: 'Atualiza o status/cumprimento de uma promessa de pagamento.',
  })
  async updatePaymentPromise(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('promiseId', ParseUUIDPipe) promiseId: string,
    @Body() dto: UpdatePaymentPromiseDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const link = await this.linksService.getLink(id);
    assertCompanyPermission(
      actor,
      link.companyId,
      'customer.manage_payment_promises',
    );
    return this.linksService.updatePaymentPromise(id, promiseId, dto, actor);
  }

  @Post(':id/contracts')
  @ApiMessage('Contrato incluído com sucesso.')
  @ApiOperation({ summary: 'Inclui um contrato do cliente com a empresa.' })
  async addContract(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ContractDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const link = await this.linksService.getLink(id);
    assertCompanyPermission(actor, link.companyId, 'customer.manage_contracts');
    return this.linksService.addContract(id, dto, actor);
  }

  @Patch(':id/contracts/:contractId')
  @ApiMessage('Contrato atualizado com sucesso.')
  @ApiOperation({ summary: 'Edita um contrato do cliente.' })
  async updateContract(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Body() dto: Partial<ContractDto>,
    @CurrentUser() actor: RequestUser,
  ) {
    const link = await this.linksService.getLink(id);
    assertCompanyPermission(actor, link.companyId, 'customer.manage_contracts');
    return this.linksService.updateContract(id, contractId, dto, actor);
  }

  @Post(':id/contracts/:contractId/amendments')
  @ApiMessage('Aditivo incluído com sucesso.')
  @ApiOperation({ summary: 'Inclui um aditivo contratual.' })
  async addContractAmendment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Body() dto: ContractAmendmentDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const link = await this.linksService.getLink(id);
    assertCompanyPermission(actor, link.companyId, 'customer.manage_contracts');
    return this.linksService.addContractAmendment(id, contractId, dto, actor);
  }

  @Post(':id/recurring-receivables')
  @ApiMessage('Recorrência incluída com sucesso.')
  @ApiOperation({
    summary: 'Configura uma recorrência financeira vinculada ao contrato.',
  })
  async addRecurringReceivable(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecurringReceivableDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const link = await this.linksService.getLink(id);
    assertCompanyPermission(
      actor,
      link.companyId,
      'customer.manage_recurring_rules',
    );
    return this.linksService.addRecurringReceivable(id, dto, actor);
  }
}
