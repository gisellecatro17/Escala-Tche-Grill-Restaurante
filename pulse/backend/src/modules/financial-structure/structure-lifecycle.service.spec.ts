/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return -- mocks usam `any` propositalmente nos testes */
import { ConflictException, NotFoundException } from '@nestjs/common';

import { StructureLifecycleService } from './structure-lifecycle.service';

const actor = { id: 'user-1', isPlatformAdmin: false } as any;

const COST_CENTER = {
  id: 'cc-1',
  organizationId: 'org-1',
  companyId: 'company-1',
  name: 'Administrativo',
  structureStatus: 'ACTIVE',
  isSystem: false,
  parentCostCenter: null,
  _count: {
    children: 0,
    links: 0,
    customerLinks: 0,
    contracts: 0,
    projects: 0,
    classificationRules: 0,
    allocationLines: 0,
  },
};

function buildService(
  record: Record<string, unknown> = COST_CENTER,
  count = 0,
) {
  const delegate = {
    findFirst: jest.fn().mockResolvedValue(record),
    update: jest.fn().mockImplementation(({ where, data }: any) => ({
      id: where.id,
      ...data,
    })),
    count: jest.fn().mockResolvedValue(count),
  };

  const prisma = { costCenter: delegate } as any;
  const audit = { log: jest.fn() } as any;

  return {
    service: new StructureLifecycleService(prisma, audit),
    prisma,
    audit,
    delegate,
  };
}

describe('StructureLifecycleService', () => {
  describe('usage', () => {
    it('soma os vínculos e libera a exclusão quando não há nenhum', async () => {
      const { service } = buildService();

      const result = await service.usage('costCenter', 'cc-1');

      expect(result.total).toBe(0);
      expect(result.inUse).toBe(false);
      expect(result.canDelete).toBe(true);
      expect(result.relations).toHaveLength(7);
    });

    it('bloqueia a exclusão de um registro em uso', async () => {
      const { service } = buildService({
        ...COST_CENTER,
        _count: { ...COST_CENTER._count, contracts: 3, projects: 1 },
      });

      const result = await service.usage('costCenter', 'cc-1');

      expect(result.total).toBe(4);
      expect(result.inUse).toBe(true);
      expect(result.canDelete).toBe(false);
    });

    it('bloqueia a exclusão de um registro padrão do sistema mesmo sem vínculos', async () => {
      const { service } = buildService({ ...COST_CENTER, isSystem: true });

      const result = await service.usage('costCenter', 'cc-1');

      expect(result.total).toBe(0);
      expect(result.canDelete).toBe(false);
    });

    it('devolve 404 quando o registro não existe', async () => {
      const { service } = buildService(null as any);

      await expect(service.usage('costCenter', 'inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deactivate', () => {
    it('apenas muda o status: nada é excluído', async () => {
      const { service, delegate } = buildService();

      await service.deactivate(
        'costCenter',
        'cc-1',
        { reason: 'encerrado' },
        actor,
      );

      expect(delegate.update).toHaveBeenCalledWith({
        where: { id: 'cc-1' },
        data: {
          structureStatus: 'INACTIVE',
          status: 'INACTIVE',
          updatedBy: 'user-1',
        },
      });
      // Nenhuma chamada de exclusão: `deletedAt` permanece intocado.
      expect(JSON.stringify(delegate.update.mock.calls)).not.toContain(
        'deletedAt',
      );
    });

    it('registra o motivo na auditoria', async () => {
      const { service, audit } = buildService();

      await service.deactivate(
        'costCenter',
        'cc-1',
        { reason: 'reestruturação' },
        actor,
      );

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DEACTIVATE',
          entity: 'CostCenter',
          field: 'structureStatus',
          reason: 'reestruturação',
        }),
      );
    });

    it('recusa inativar quando existem filhos ativos', async () => {
      const { service } = buildService(COST_CENTER, 2);

      await expect(
        service.deactivate('costCenter', 'cc-1', {}, actor),
      ).rejects.toThrow(/2 registro\(s\) ativo\(s\) abaixo/);
    });

    it('recusa inativar um registro já inativo', async () => {
      const { service } = buildService({
        ...COST_CENTER,
        structureStatus: 'INACTIVE',
      });

      await expect(
        service.deactivate('costCenter', 'cc-1', {}, actor),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('activate', () => {
    it('reativa um registro inativo', async () => {
      const { service, delegate } = buildService({
        ...COST_CENTER,
        structureStatus: 'INACTIVE',
      });

      await service.activate('costCenter', 'cc-1', actor);

      expect(delegate.update).toHaveBeenCalledWith({
        where: { id: 'cc-1' },
        data: {
          structureStatus: 'ACTIVE',
          status: 'ACTIVE',
          updatedBy: 'user-1',
        },
      });
    });

    it('recusa ativar sob um pai inativo', async () => {
      const { service } = buildService({
        ...COST_CENTER,
        structureStatus: 'INACTIVE',
        parentCostCenter: { name: 'Corporativo', structureStatus: 'INACTIVE' },
      });

      await expect(
        service.activate('costCenter', 'cc-1', actor),
      ).rejects.toThrow(/"Corporativo" está inativo/);
    });

    it('recusa ativar um registro já ativo', async () => {
      const { service } = buildService();

      await expect(
        service.activate('costCenter', 'cc-1', actor),
      ).rejects.toThrow(/já está ativa/);
    });
  });

  describe('archive', () => {
    it('arquiva sem excluir e registra a auditoria', async () => {
      const { service, delegate, audit } = buildService();

      await service.archive('costCenter', 'cc-1', {}, actor);

      expect(delegate.update).toHaveBeenCalledWith({
        where: { id: 'cc-1' },
        data: {
          structureStatus: 'ARCHIVED',
          status: 'INACTIVE',
          updatedBy: 'user-1',
        },
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ARCHIVE' }),
      );
    });

    it('recusa arquivar quando existem filhos ativos', async () => {
      const { service } = buildService(COST_CENTER, 1);

      await expect(
        service.archive('costCenter', 'cc-1', {}, actor),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('projeto', () => {
    /**
     * O projeto guarda o andamento em `status` (ProjectStatus) e a vigência em
     * `recordStatus`. Escrever 'INACTIVE' em `status` apagaria o andamento.
     */
    it('escreve em recordStatus, nunca no status operacional', async () => {
      const delegate = {
        findFirst: jest.fn().mockResolvedValue({
          id: 'proj-1',
          organizationId: 'org-1',
          companyId: 'company-1',
          structureStatus: 'ACTIVE',
          status: 'IN_PROGRESS',
          isSystem: false,
          parentProject: null,
          _count: {
            childProjects: 0,
            classificationRules: 0,
            allocationLines: 0,
            defaultForCategories: 0,
          },
        }),
        update: jest.fn().mockImplementation(({ where, data }: any) => ({
          id: where.id,
          ...data,
        })),
        count: jest.fn().mockResolvedValue(0),
      };

      const service = new StructureLifecycleService(
        { project: delegate } as any,
        { log: jest.fn() } as any,
      );

      await service.deactivate('project', 'proj-1', {}, actor);

      const data = delegate.update.mock.calls[0][0].data;
      expect(data.recordStatus).toBe('INACTIVE');
      expect(data.status).toBeUndefined();
    });
  });
});
