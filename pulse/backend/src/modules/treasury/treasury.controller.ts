import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BeneficiaryEntityType } from '@prisma/client';

import { ApiMessage } from '../../common/decorators/api-message.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/types/authenticated-request';
import {
  assertCompanyPermission,
  assertOrganizationPermission,
} from '../../common/utils/access-control.util';
import {
  TreasuryStatusHistoryQueryDto,
  UpdateTreasurySettingsDto,
} from './dto/treasury-settings.dto';
import { TreasuryService } from './treasury.service';

/** Visão geral, parâmetros e favorecidos da tesouraria. */
@ApiTags('Tesouraria')
@ApiBearerAuth()
@Controller('treasury')
export class TreasuryController {
  constructor(private readonly treasury: TreasuryService) {}

  @Get('overview')
  @ApiOperation({
    summary:
      'Consolidado da tesouraria: contas, cartões, chaves PIX, formas, pendências e últimas alterações.',
  })
  overview(
    @Query('organizationId') organizationId: string,
    @Query('companyId') companyId: string | undefined,
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(
      actor,
      organizationId,
      'treasury.view_dashboard',
    );
    return this.treasury.findOverview(organizationId, companyId);
  }

  @Get('settings')
  @ApiOperation({
    summary:
      'Parâmetros de tesouraria da empresa. Criados com os padrões na primeira consulta.',
  })
  findSettings(
    @Query('organizationId') organizationId: string,
    @Query('companyId') companyId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, companyId, 'treasury.view');
    return this.treasury.findSettings(organizationId, companyId);
  }

  @Patch('settings')
  @ApiMessage('Parâmetros de tesouraria atualizados com sucesso.')
  @ApiOperation({ summary: 'Atualiza os parâmetros de tesouraria da empresa.' })
  updateSettings(
    @Query('organizationId') organizationId: string,
    @Query('companyId') companyId: string,
    @Body() dto: UpdateTreasurySettingsDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, companyId, 'treasury.manage_settings');
    return this.treasury.updateSettings(organizationId, companyId, dto, actor);
  }

  @Get('status-history')
  @ApiOperation({
    summary:
      'Histórico paginado das mudanças de situação das contas financeiras da organização.',
  })
  findStatusHistory(
    @Query('organizationId') organizationId: string,
    @Query() query: TreasuryStatusHistoryQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(actor, organizationId, 'treasury.view');
    return this.treasury.findStatusHistory(organizationId, {
      companyId: query.companyId,
      financialAccountId: query.financialAccountId,
      page: query.page,
      perPage: query.perPage,
    });
  }

  @Get('beneficiaries')
  @ApiOperation({
    summary:
      'Visão consolidada dos favorecidos bancários. Lê os cadastros existentes — não duplica contas de fornecedor.',
  })
  findBeneficiaries(
    @Query('organizationId') organizationId: string,
    @Query('companyId') companyId: string | undefined,
    @Query('search') search: string | undefined,
    @Query('entityType') entityType: BeneficiaryEntityType | undefined,
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(actor, organizationId, 'treasury.view');
    return this.treasury.findBeneficiaries(
      organizationId,
      { companyId, search, entityType },
      actor,
    );
  }
}
