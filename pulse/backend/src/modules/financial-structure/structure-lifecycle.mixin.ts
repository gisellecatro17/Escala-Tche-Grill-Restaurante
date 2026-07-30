import { Body, Get, Param, Post, Type } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import { ApiMessage } from '../../common/decorators/api-message.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/types/authenticated-request';
import { assertOrganizationPermission } from '../../common/utils/access-control.util';
import { DeactivateStructureDto } from './dto/lifecycle.dto';
import {
  StructureLifecycleService,
  StructureModelKey,
} from './structure-lifecycle.service';

export interface LifecycleControllerContract {
  activateRecord(id: string, actor: RequestUser): Promise<unknown>;
  deactivateRecord(
    id: string,
    dto: DeactivateStructureDto,
    actor: RequestUser,
  ): Promise<unknown>;
  archiveRecord(
    id: string,
    dto: DeactivateStructureDto,
    actor: RequestUser,
  ): Promise<unknown>;
  recordUsage(id: string, actor: RequestUser): Promise<unknown>;
}

/**
 * Gera a base de controller com as rotas de ciclo de vida da seção 70
 * (`activate`, `deactivate`, `archive` e `usage`), idênticas em todos os cadastros da
 * estrutura financeira.
 *
 * Cada cadastro herda daqui em vez de repetir as quatro rotas, de modo que uma correção
 * no controle de permissão ou nas mensagens valha para todos ao mesmo tempo.
 *
 * @param model chave do modelo no Prisma
 * @param permissionPrefix prefixo das permissões (ex.: `cost_center`)
 */
export function LifecycleController(
  model: StructureModelKey,
  permissionPrefix: string,
): Type<LifecycleControllerContract> {
  abstract class LifecycleControllerBase implements LifecycleControllerContract {
    constructor(protected readonly lifecycle: StructureLifecycleService) {}

    /** Valida a permissão contra a organização do próprio registro, nunca contra o payload. */
    private async assertCan(id: string, action: string, actor: RequestUser) {
      const scope = await this.lifecycle.scopeOf(model, id);
      assertOrganizationPermission(
        actor,
        scope.organizationId,
        `${permissionPrefix}.${action}`,
      );
    }

    @Get(':id/usage')
    @ApiOperation({
      summary:
        'Lista os vínculos do registro e informa se ele pode ser excluído ou apenas inativado.',
    })
    async recordUsage(
      @Param('id') id: string,
      @CurrentUser() actor: RequestUser,
    ) {
      await this.assertCan(id, 'view', actor);
      return this.lifecycle.usage(model, id);
    }

    @Post(':id/activate')
    @ApiMessage('Registro ativado com sucesso.')
    @ApiOperation({
      summary:
        'Ativa o registro. Recusado quando o registro superior está inativo.',
    })
    async activateRecord(
      @Param('id') id: string,
      @CurrentUser() actor: RequestUser,
    ) {
      await this.assertCan(id, 'activate', actor);
      return this.lifecycle.activate(model, id, actor);
    }

    @Post(':id/deactivate')
    @ApiMessage('Registro inativado com sucesso.')
    @ApiOperation({
      summary:
        'Inativa o registro sem excluir nada: os lançamentos e o histórico que o referenciam continuam íntegros.',
    })
    async deactivateRecord(
      @Param('id') id: string,
      @Body() dto: DeactivateStructureDto,
      @CurrentUser() actor: RequestUser,
    ) {
      await this.assertCan(id, 'deactivate', actor);
      return this.lifecycle.deactivate(model, id, dto, actor);
    }

    @Post(':id/archive')
    @ApiMessage('Registro arquivado com sucesso.')
    @ApiOperation({
      summary:
        'Arquiva o registro: sai das listagens e dos seletores, mas permanece consultável.',
    })
    async archiveRecord(
      @Param('id') id: string,
      @Body() dto: DeactivateStructureDto,
      @CurrentUser() actor: RequestUser,
    ) {
      await this.assertCan(id, 'deactivate', actor);
      return this.lifecycle.archive(model, id, dto, actor);
    }
  }

  return LifecycleControllerBase as unknown as Type<LifecycleControllerContract>;
}
