/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return -- mocks usam `any` propositalmente nos testes */
import { ConflictException } from '@nestjs/common';
import { ProjectStatus } from '@prisma/client';

import { ProjectsService } from './projects.service';

const actor = { id: 'user-1', isPlatformAdmin: false } as any;

function buildService(status: ProjectStatus) {
  const delegate = {
    findFirst: jest.fn().mockResolvedValue({
      id: 'proj-1',
      companyId: 'company-1',
      code: 'PRJ-01',
      name: 'Reforma do salão',
      status,
    }),
    update: jest.fn().mockImplementation(({ where, data }: any) => ({
      id: where.id,
      ...data,
    })),
  };

  const prisma = { project: delegate } as any;
  const audit = { log: jest.fn() } as any;

  return { service: new ProjectsService(prisma, audit), delegate, audit };
}

describe('ProjectsService.changeStatus', () => {
  it('pausa um projeto em andamento', async () => {
    const { service, delegate } = buildService(ProjectStatus.IN_PROGRESS);

    await service.changeStatus(
      'proj-1',
      ProjectStatus.PAUSED,
      actor,
      'sem verba',
    );

    expect(delegate.update.mock.calls[0][0].data.status).toBe('PAUSED');
  });

  it('retoma um projeto pausado', async () => {
    const { service, delegate } = buildService(ProjectStatus.PAUSED);

    await service.changeStatus('proj-1', ProjectStatus.IN_PROGRESS, actor);

    expect(delegate.update.mock.calls[0][0].data.status).toBe('IN_PROGRESS');
  });

  it('grava a data real de término ao concluir, sem tocar na prevista', async () => {
    const { service, delegate } = buildService(ProjectStatus.IN_PROGRESS);

    await service.changeStatus('proj-1', ProjectStatus.COMPLETED, actor);

    const data = delegate.update.mock.calls[0][0].data;
    expect(data.actualEndDate).toBeInstanceOf(Date);
    expect(data.completionPercentage).toBe(100);
    expect(data.endDate).toBeUndefined();
  });

  it('recusa concluir um projeto que ainda está em planejamento', async () => {
    const { service } = buildService(ProjectStatus.PLANNING);

    await expect(
      service.changeStatus('proj-1', ProjectStatus.COMPLETED, actor),
    ).rejects.toThrow(ConflictException);
  });

  it('recusa reabrir um projeto arquivado', async () => {
    const { service } = buildService(ProjectStatus.ARCHIVED);

    await expect(
      service.changeStatus('proj-1', ProjectStatus.IN_PROGRESS, actor),
    ).rejects.toThrow(/arquivado não pode passar para "em andamento"/);
  });

  it('permite reabrir um projeto concluído, com registro em auditoria', async () => {
    const { service, audit } = buildService(ProjectStatus.COMPLETED);

    await service.changeStatus(
      'proj-1',
      ProjectStatus.IN_PROGRESS,
      actor,
      'pendência identificada na entrega',
    );

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CHANGE_STATUS',
        entity: 'Project',
        oldValue: { status: 'COMPLETED' },
        newValue: { status: 'IN_PROGRESS' },
        reason: 'pendência identificada na entrega',
      }),
    );
  });

  it('permite cancelar em qualquer etapa aberta', async () => {
    for (const status of [
      ProjectStatus.DRAFT,
      ProjectStatus.PLANNING,
      ProjectStatus.IN_APPROVAL,
      ProjectStatus.IN_PROGRESS,
      ProjectStatus.PAUSED,
      ProjectStatus.DELAYED,
    ]) {
      const { service, delegate } = buildService(status);
      await service.changeStatus('proj-1', ProjectStatus.CANCELLED, actor);
      expect(delegate.update.mock.calls[0][0].data.status).toBe('CANCELLED');
    }
  });
});
