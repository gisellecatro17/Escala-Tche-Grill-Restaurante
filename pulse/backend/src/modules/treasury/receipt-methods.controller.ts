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
import { RecordStatus } from '@prisma/client';

import { ApiMessage } from '../../common/decorators/api-message.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/types/authenticated-request';
import { assertOrganizationPermission } from '../../common/utils/access-control.util';
import {
  CreateReceiptMethodDto,
  MethodQueryDto,
  UpdateReceiptMethodDto,
} from './dto/methods.dto';
import { PaymentMethodsService } from './payment-methods.service';

/**
 * Formas de recebimento, com taxas e prazos (seções 43 e 44). As taxas são apenas
 * cadastradas nesta etapa: o cálculo entra com o Contas a Receber e a conciliação.
 */
@ApiTags('Tesouraria — formas de recebimento')
@ApiBearerAuth()
@Controller('receipt-methods')
export class ReceiptMethodsController {
  constructor(private readonly methods: PaymentMethodsService) {}

  private async assertCan(id: string, permission: string, actor: RequestUser) {
    const method = await this.methods.findReceiptMethod(id);
    assertOrganizationPermission(actor, method.organizationId, permission);
    return method;
  }

  @Get()
  @ApiOperation({ summary: 'Lista as formas de recebimento.' })
  findAll(
    @Query() query: MethodQueryDto,
    @Query('organizationId') organizationId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(actor, organizationId, 'receipt_method.view');
    return this.methods.findReceiptMethods(organizationId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha uma forma de recebimento.' })
  findOne(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.assertCan(id, 'receipt_method.view', actor);
  }

  @Get(':id/usage')
  @ApiOperation({
    summary: 'Uso da forma de recebimento e se pode ser excluída.',
  })
  async usage(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    await this.assertCan(id, 'receipt_method.view', actor);
    return this.methods.receiptMethodUsage(id);
  }

  @Post()
  @ApiMessage('Forma de recebimento incluída com sucesso.')
  @ApiOperation({ summary: 'Inclui uma forma de recebimento.' })
  create(
    @Body() dto: CreateReceiptMethodDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(
      actor,
      dto.organizationId,
      'receipt_method.create',
    );
    return this.methods.createReceiptMethod(dto, actor);
  }

  @Patch(':id')
  @ApiMessage('Forma de recebimento atualizada com sucesso.')
  @ApiOperation({ summary: 'Atualiza uma forma de recebimento.' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateReceiptMethodDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertCan(id, 'receipt_method.update', actor);
    return this.methods.updateReceiptMethod(id, dto, actor);
  }

  @Post(':id/activate')
  @ApiMessage('Forma de recebimento ativada com sucesso.')
  @ApiOperation({ summary: 'Ativa uma forma de recebimento.' })
  async activate(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    await this.assertCan(id, 'receipt_method.activate', actor);
    return this.methods.setReceiptMethodStatus(id, RecordStatus.ACTIVE, actor);
  }

  @Post(':id/deactivate')
  @ApiMessage('Forma de recebimento inativada com sucesso.')
  @ApiOperation({ summary: 'Inativa uma forma de recebimento.' })
  async deactivate(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    await this.assertCan(id, 'receipt_method.deactivate', actor);
    return this.methods.setReceiptMethodStatus(
      id,
      RecordStatus.INACTIVE,
      actor,
    );
  }

  @Delete(':id')
  @ApiMessage('Forma de recebimento excluída com sucesso.')
  @ApiOperation({
    summary: 'Exclui uma forma de recebimento que não seja padrão do sistema.',
  })
  async remove(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    await this.assertCan(id, 'receipt_method.delete', actor);
    return this.methods.removeReceiptMethod(id, actor);
  }
}
