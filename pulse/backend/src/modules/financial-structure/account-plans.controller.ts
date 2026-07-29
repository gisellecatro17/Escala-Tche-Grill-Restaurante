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
import {
  assertCompanyPermission,
  assertOrganizationPermission,
} from '../../common/utils/access-control.util';
import { AccountPlansService } from './account-plans.service';
import {
  CreateAccountPlanDto,
  UpdateAccountPlanDto,
} from './dto/account-plan.dto';
import {
  DuplicateNodeDto,
  MoveNodeDto,
  StructureQueryDto,
} from './dto/common.dto';

/**
 * Plano de contas em árvore de profundidade ilimitada. As contas podem pertencer à
 * organização inteira (`companyId` nulo) ou a uma empresa específica.
 */
@ApiTags('Plano de contas')
@ApiBearerAuth()
@Controller('account-plans')
export class AccountPlansController {
  constructor(private readonly accountPlans: AccountPlansService) {}

  @Get()
  @ApiOperation({ summary: 'Lista as contas do plano de contas.' })
  findAll(
    @Query() query: StructureQueryDto,
    @Query('organizationId') organizationId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(actor, organizationId, 'account-plan.view');
    return this.accountPlans.findAll({ ...query, organizationId });
  }

  @Get('tree')
  @ApiOperation({ summary: 'Retorna a árvore completa do plano de contas.' })
  findTree(
    @Query('organizationId') organizationId: string,
    @Query('companyId') companyId: string | undefined,
    @Query('includeInactive') includeInactive: string | undefined,
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(actor, organizationId, 'account-plan.view');
    return this.accountPlans.findTree(
      organizationId,
      companyId,
      includeInactive === 'true',
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha uma conta do plano de contas.' })
  async findOne(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    const account = await this.accountPlans.findOne(id);
    assertOrganizationPermission(
      actor,
      account.organizationId,
      'account-plan.view',
    );
    return account;
  }

  @Post()
  @ApiMessage('Conta incluída com sucesso.')
  @ApiOperation({ summary: 'Inclui uma conta no plano de contas.' })
  create(@Body() dto: CreateAccountPlanDto, @CurrentUser() actor: RequestUser) {
    assertOrganizationPermission(
      actor,
      dto.organizationId,
      'account-plan.manage',
    );
    return this.accountPlans.create(dto, actor);
  }

  @Patch(':id')
  @ApiMessage('Conta atualizada com sucesso.')
  @ApiOperation({ summary: 'Atualiza uma conta do plano de contas.' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAccountPlanDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const account = await this.accountPlans.findOne(id);
    assertOrganizationPermission(
      actor,
      account.organizationId,
      'account-plan.manage',
    );
    return this.accountPlans.update(id, dto, actor);
  }

  @Post(':id/move')
  @ApiMessage('Conta movida com sucesso.')
  @ApiOperation({
    summary:
      'Move a conta na árvore. Versiona a estrutura antes da alteração e exige permissão específica.',
  })
  async move(
    @Param('id') id: string,
    @Body() dto: MoveNodeDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const account = await this.accountPlans.findOne(id);
    assertOrganizationPermission(
      actor,
      account.organizationId,
      'account-plan.manage_tree',
    );
    return this.accountPlans.move(id, dto, actor);
  }

  @Post(':id/duplicate')
  @ApiMessage('Conta duplicada com sucesso.')
  @ApiOperation({
    summary: 'Duplica a conta, opcionalmente com toda a subárvore.',
  })
  async duplicate(
    @Param('id') id: string,
    @Body() dto: DuplicateNodeDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const account = await this.accountPlans.findOne(id);
    assertOrganizationPermission(
      actor,
      account.organizationId,
      'financial-structure.duplicate',
    );
    if (dto.targetCompanyId) {
      assertCompanyPermission(
        actor,
        dto.targetCompanyId,
        'account-plan.manage',
      );
    }
    return this.accountPlans.duplicate(id, dto, actor);
  }

  @Delete(':id')
  @ApiMessage('Conta excluída com sucesso.')
  @ApiOperation({
    summary: 'Exclui (logicamente) uma conta sem filhos nem uso.',
  })
  async remove(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    const account = await this.accountPlans.findOne(id);
    assertOrganizationPermission(
      actor,
      account.organizationId,
      'account-plan.delete',
    );
    return this.accountPlans.remove(id, actor);
  }
}
