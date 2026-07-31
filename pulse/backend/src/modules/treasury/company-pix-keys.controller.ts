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
import {
  assertCompanyPermission,
  assertOrganizationPermission,
} from '../../common/utils/access-control.util';
import { AccountDetailsService } from './account-details.service';
import {
  CompanyPixKeyQueryDto,
  CreateCompanyPixKeyDto,
  UpdateCompanyPixKeyDto,
} from './dto/account-details.dto';

/**
 * Chaves PIX da própria empresa. Distintas das chaves de fornecedor
 * (`supplier_pix_keys`), que continuam no módulo de fornecedores.
 */
@ApiTags('Tesouraria — chaves PIX')
@ApiBearerAuth()
@Controller('company-pix-keys')
export class CompanyPixKeysController {
  constructor(private readonly details: AccountDetailsService) {}

  /** Resolve a empresa da chave no banco, para validar a permissão contra ela. */
  private async assertCan(id: string, permission: string, actor: RequestUser) {
    const key = await this.details.pixKeyScopeOf(id);
    assertCompanyPermission(actor, key.companyId, permission);
    return key;
  }

  @Get()
  @ApiOperation({ summary: 'Lista as chaves PIX da organização.' })
  findAll(
    @Query() query: CompanyPixKeyQueryDto,
    @Query('organizationId') organizationId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(
      actor,
      organizationId,
      'financial_account.view',
    );
    return this.details.findPixKeys(
      organizationId,
      {
        companyId: query.companyId,
        financialAccountId: query.financialAccountId,
        status: query.status,
      },
      actor,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha uma chave PIX.' })
  async findOne(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    await this.assertCan(id, 'financial_account.view', actor);
    return this.details.findPixKey(id, actor);
  }

  @Post()
  @ApiMessage('Chave PIX incluída com sucesso.')
  @ApiOperation({
    summary:
      'Inclui uma chave PIX da empresa. A chave é validada conforme o tipo e não pode se repetir na mesma empresa.',
  })
  create(
    @Body() dto: CreateCompanyPixKeyDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(
      actor,
      dto.companyId,
      'financial_account.manage_pix',
    );
    return this.details.createPixKey(dto, actor);
  }

  @Patch(':id')
  @ApiMessage('Chave PIX atualizada com sucesso.')
  @ApiOperation({ summary: 'Atualiza uma chave PIX.' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCompanyPixKeyDto,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.assertCan(id, 'financial_account.manage_pix', actor);
    return this.details.updatePixKey(id, dto, actor);
  }

  @Post(':id/activate')
  @ApiMessage('Chave PIX ativada com sucesso.')
  @ApiOperation({ summary: 'Ativa uma chave PIX.' })
  async activate(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    await this.assertCan(id, 'financial_account.manage_pix', actor);
    return this.details.setPixKeyStatus(id, RecordStatus.ACTIVE, actor);
  }

  @Post(':id/deactivate')
  @ApiMessage('Chave PIX inativada com sucesso.')
  @ApiOperation({ summary: 'Inativa uma chave PIX, mantendo-a no histórico.' })
  async deactivate(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    await this.assertCan(id, 'financial_account.manage_pix', actor);
    return this.details.setPixKeyStatus(id, RecordStatus.INACTIVE, actor);
  }

  @Delete(':id')
  @ApiMessage('Chave PIX excluída com sucesso.')
  @ApiOperation({ summary: 'Exclui (logicamente) uma chave PIX.' })
  async remove(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    await this.assertCan(id, 'financial_account.manage_pix', actor);
    return this.details.removePixKey(id, actor);
  }
}
