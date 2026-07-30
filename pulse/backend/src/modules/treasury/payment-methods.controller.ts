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
  CreatePaymentMethodDto,
  MethodQueryDto,
  UpdatePaymentMethodDto,
} from './dto/methods.dto';
import { PaymentMethodsService } from './payment-methods.service';

/** Formas de pagamento configuráveis (seções 41 e 42). */
@ApiTags('Tesouraria — formas de pagamento')
@ApiBearerAuth()
@Controller('payment-methods')
export class PaymentMethodsController {
  constructor(private readonly methods: PaymentMethodsService) {}

  private async assertCan(id: string, permission: string, actor: RequestUser) {
    const method = await this.methods.findPaymentMethod(id);
    assertOrganizationPermission(actor, method.organizationId, permission);
    return method;
  }

  @Get()
  @ApiOperation({ summary: 'Lista as formas de pagamento.' })
  findAll(
    @Query() query: MethodQueryDto,
    @Query('organizationId') organizationId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(actor, organizationId, 'payment_method.view');
    return this.methods.findPaymentMethods(organizationId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha uma forma de pagamento.' })
  findOne(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.assertCan(id, 'payment_method.view', actor);
  }

  @Get(':id/usage')
  @ApiOperation({
    summary: 'Uso da forma de pagamento e se pode ser excluída.',
  })
  async usage(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    await this.assertCan(id, 'payment_method.view', actor);
    return this.methods.paymentMethodUsage(id);
  }

  @Post()
  @ApiMessage('Forma de pagamento incluída com sucesso.')
  @ApiOperation({ summary: 'Inclui uma forma de pagamento.' })
  create(
    @Body() dto: CreatePaymentMethodDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(
      actor,
      dto.organizationId,
      'payment_method.create',
    );
    return this.methods.createPaymentMethod(dto, actor);
  }

  @Patch(':id')
  @ApiMessage('Forma de pagamento atualizada com sucesso.')
  @ApiOperation({ summary: 'Atualiza uma forma de pagamento.' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentMethodDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertCan(id, 'payment_method.update', actor);
    return this.methods.updatePaymentMethod(id, dto, actor);
  }

  @Post(':id/activate')
  @ApiMessage('Forma de pagamento ativada com sucesso.')
  @ApiOperation({ summary: 'Ativa uma forma de pagamento.' })
  async activate(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    await this.assertCan(id, 'payment_method.activate', actor);
    return this.methods.setPaymentMethodStatus(id, RecordStatus.ACTIVE, actor);
  }

  @Post(':id/deactivate')
  @ApiMessage('Forma de pagamento inativada com sucesso.')
  @ApiOperation({ summary: 'Inativa uma forma de pagamento.' })
  async deactivate(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    await this.assertCan(id, 'payment_method.deactivate', actor);
    return this.methods.setPaymentMethodStatus(
      id,
      RecordStatus.INACTIVE,
      actor,
    );
  }

  @Delete(':id')
  @ApiMessage('Forma de pagamento excluída com sucesso.')
  @ApiOperation({
    summary: 'Exclui uma forma de pagamento que não seja padrão do sistema.',
  })
  async remove(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    await this.assertCan(id, 'payment_method.delete', actor);
    return this.methods.removePaymentMethod(id, actor);
  }
}
