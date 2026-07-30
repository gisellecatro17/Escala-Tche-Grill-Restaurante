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
import { AccountPlanKind } from '@prisma/client';

import { ApiMessage } from '../../common/decorators/api-message.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/types/authenticated-request';
import { assertOrganizationPermission } from '../../common/utils/access-control.util';
import { AccountPlanVersionsService } from './account-plan-versions.service';
import {
  ActivateVersionDto,
  CreateAccountPlanVersionDto,
  UpdateAccountPlanVersionDto,
} from './dto/account-plan-version.dto';

/**
 * Versões do plano de contas (seções 14 e 68). Apenas uma versão fica ativa por tipo de
 * plano e empresa; as anteriores são preservadas como histórico.
 */
@ApiTags('Versões do plano de contas')
@ApiBearerAuth()
@Controller('financial-account-plan-versions')
export class AccountPlanVersionsController {
  constructor(private readonly versions: AccountPlanVersionsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista as versões do plano de contas.' })
  findAll(
    @Query('organizationId') organizationId: string,
    @Query('companyId') companyId: string | undefined,
    @Query('planType') planType: AccountPlanKind | undefined,
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(actor, organizationId, 'account_plan.view');
    return this.versions.findAll(organizationId, companyId, planType);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha uma versão e sua cadeia de versões.' })
  async findOne(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    const version = await this.versions.findOne(id);
    assertOrganizationPermission(
      actor,
      version.organizationId,
      'account_plan.view',
    );
    return version;
  }

  @Post()
  @ApiMessage('Versão criada com sucesso.')
  @ApiOperation({
    summary: 'Cria uma versão do plano de contas (nasce como rascunho).',
  })
  create(
    @Body() dto: CreateAccountPlanVersionDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(
      actor,
      dto.organizationId,
      'account_plan.version',
    );
    return this.versions.create(dto, actor);
  }

  @Patch(':id')
  @ApiMessage('Versão atualizada com sucesso.')
  @ApiOperation({
    summary:
      'Atualiza uma versão. Somente rascunhos e versões em revisão são editáveis.',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAccountPlanVersionDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const version = await this.versions.findOne(id);
    assertOrganizationPermission(
      actor,
      version.organizationId,
      'account_plan.version',
    );
    return this.versions.update(id, dto, actor);
  }

  @Post(':id/activate')
  @ApiMessage('Versão ativada com sucesso.')
  @ApiOperation({
    summary:
      'Ativa a versão e marca a anterior como substituída, garantindo uma única versão ativa por escopo.',
  })
  async activate(
    @Param('id') id: string,
    @Body() dto: ActivateVersionDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const version = await this.versions.findOne(id);
    assertOrganizationPermission(
      actor,
      version.organizationId,
      'account_plan.version',
    );
    return this.versions.activate(id, dto, actor);
  }

  @Post(':id/archive')
  @ApiMessage('Versão arquivada com sucesso.')
  @ApiOperation({
    summary: 'Arquiva a versão, mantendo-a disponível para consulta.',
  })
  async archive(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    const version = await this.versions.findOne(id);
    assertOrganizationPermission(
      actor,
      version.organizationId,
      'account_plan.version',
    );
    return this.versions.archive(id, actor);
  }

  @Post(':id/duplicate')
  @ApiMessage('Versão duplicada com sucesso.')
  @ApiOperation({
    summary: 'Duplica a versão com todas as contas, preservando a hierarquia.',
  })
  async duplicate(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    const version = await this.versions.findOne(id);
    assertOrganizationPermission(
      actor,
      version.organizationId,
      'account_plan.version',
    );
    return this.versions.duplicate(id, actor);
  }

  @Delete(':id')
  @ApiMessage('Versão excluída com sucesso.')
  @ApiOperation({
    summary: 'Exclui uma versão em rascunho sem contas vinculadas.',
  })
  async remove(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    const version = await this.versions.findOne(id);
    assertOrganizationPermission(
      actor,
      version.organizationId,
      'account_plan.version',
    );
    return this.versions.remove(id, actor);
  }
}
