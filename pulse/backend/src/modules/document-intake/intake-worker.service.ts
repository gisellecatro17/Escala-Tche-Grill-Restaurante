import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DocumentIntakeService } from './document-intake.service';
import { IntakePipelineService } from './intake-pipeline.service';

/**
 * Worker que consome a fila de processamento.
 *
 * Roda no mesmo processo da API, acordando em intervalos curtos. Para a escala de um BPO
 * isso é suficiente e evita um segundo processo para operar; quando o volume justificar,
 * este serviço é o único lugar a mudar — basta apontar para um worker separado ou para o
 * consumidor de uma fila externa.
 *
 * Desligado por padrão em teste (`INTAKE_WORKER_ENABLED=false`), para que a suíte não
 * dispare processamento em paralelo com as asserções.
 */
@Injectable()
export class IntakeWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IntakeWorkerService.name);
  private timer: NodeJS.Timeout | null = null;
  /** Evita duas passadas concorrentes no mesmo processo. */
  private running = false;
  private readonly enabled: boolean;
  private readonly intervalMs: number;

  constructor(
    private readonly config: ConfigService,
    private readonly pipeline: IntakePipelineService,
    private readonly intake: DocumentIntakeService,
  ) {
    this.enabled = this.config.get<string>('INTAKE_WORKER_ENABLED') !== 'false';
    this.intervalMs = Number(
      this.config.get<string>('INTAKE_WORKER_INTERVAL_MS') ?? 2000,
    );
  }

  onModuleInit() {
    if (!this.enabled) {
      this.logger.log(
        'Worker da entrada de documentos desabilitado por configuração.',
      );
      return;
    }

    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    // Não segura o processo aberto só por causa do timer.
    this.timer.unref?.();
    this.logger.log(
      `Worker da entrada de documentos ativo (intervalo de ${this.intervalMs}ms).`,
    );
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Uma passada da fila: pega jobs disponíveis até esvaziar ou atingir o limite do ciclo.
   *
   * O limite existe para que uma fila grande não monopolize o processo — na próxima passada
   * ela continua de onde parou.
   */
  async tick(maximumJobsPerCycle = 10): Promise<number> {
    if (this.running) return 0;
    this.running = true;

    let processed = 0;

    try {
      while (processed < maximumJobsPerCycle) {
        const job = await this.pipeline.reserveNextJob();
        if (!job) break;

        await this.pipeline.runJob(job, (reserved) =>
          this.intake.runPipelineStep({
            id: reserved.id,
            documentId: reserved.documentId,
            jobType: reserved.jobType,
            attemptNumber: reserved.attemptNumber,
          }),
        );

        processed += 1;
      }
    } catch (caught) {
      // Uma falha na passada não pode derrubar o timer: a próxima tentativa vem sozinha.
      this.logger.error(
        `Falha ao consumir a fila: ${caught instanceof Error ? caught.message : 'erro desconhecido'}`,
      );
    } finally {
      this.running = false;
    }

    return processed;
  }
}
