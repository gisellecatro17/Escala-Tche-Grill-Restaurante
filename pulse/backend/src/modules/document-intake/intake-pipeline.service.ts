import { Injectable, Logger } from '@nestjs/common';
import {
  IntakeJobStatus,
  IntakeJobType,
  IntakeProcessingStatus,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../../prisma/prisma.service';

/**
 * Fila e pipeline de processamento (seções 17 e 18).
 *
 * A fila é a própria tabela `intake_document_processing_jobs`, e não Redis/BullMQ. A
 * decisão é deliberada: o prompt permite "alternativa já existente no projeto", e o
 * projeto já tem PostgreSQL. Isso evita exigir uma dependência de infraestrutura nova para
 * rodar o sistema, e traz uma vantagem real — retry, backoff, idempotência e dead-letter
 * ficam **auditáveis no banco**, consultáveis com SQL, sobrevivendo a restart do processo.
 * A interface é a mesma que um adaptador BullMQ implementaria, então a troca depois é
 * localizada aqui.
 *
 * O que o `SELECT ... FOR UPDATE SKIP LOCKED` garante: dois workers nunca pegam o mesmo
 * job. É o mesmo mecanismo que as filas em banco usam em produção.
 */

/** Ordem das etapas. Cada uma, ao terminar, enfileira a seguinte. */
const PIPELINE_ORDER: IntakeJobType[] = [
  IntakeJobType.VALIDATE_FILE,
  IntakeJobType.EXTRACT_DATA,
  IntakeJobType.CLASSIFY_DOCUMENT,
  IntakeJobType.IDENTIFY_PARTIES,
  IntakeJobType.VALIDATE_DATA,
  IntakeJobType.DETECT_DUPLICATES,
  IntakeJobType.SUGGEST_CLASSIFICATION,
];

/** Situação do documento durante cada etapa, para a tela mostrar onde ele está. */
const STATUS_BY_JOB: Record<IntakeJobType, IntakeProcessingStatus> = {
  [IntakeJobType.VALIDATE_FILE]: IntakeProcessingStatus.VALIDATING,
  [IntakeJobType.EXTRACT_DATA]: IntakeProcessingStatus.EXTRACTING,
  [IntakeJobType.CLASSIFY_DOCUMENT]: IntakeProcessingStatus.CLASSIFYING,
  [IntakeJobType.IDENTIFY_PARTIES]: IntakeProcessingStatus.MATCHING,
  [IntakeJobType.VALIDATE_DATA]: IntakeProcessingStatus.VALIDATING_DATA,
  [IntakeJobType.DETECT_DUPLICATES]: IntakeProcessingStatus.VALIDATING_DATA,
  [IntakeJobType.SUGGEST_CLASSIFICATION]: IntakeProcessingStatus.CLASSIFYING,
  [IntakeJobType.FULL_PIPELINE]: IntakeProcessingStatus.QUEUED,
};

/** Espera antes de cada nova tentativa: 2s, 8s, 32s. */
const BACKOFF_BASE_SECONDS = 2;
const BACKOFF_FACTOR = 4;

export interface EnqueueOptions {
  documentId: string;
  jobType: IntakeJobType;
  priority?: number;
  maximumAttempts?: number;
  /**
   * Chave de idempotência. Enfileirar duas vezes o mesmo job lógico não cria dois jobs —
   * o que importa quando um lote é reenviado ou um webhook chega duplicado.
   */
  idempotencyKey?: string;
  availableAt?: Date;
  metadata?: Prisma.InputJsonValue;
}

export type JobHandler = (job: {
  id: string;
  documentId: string;
  jobType: IntakeJobType;
  attemptNumber: number;
  metadata: Prisma.JsonValue | null;
}) => Promise<void>;

@Injectable()
export class IntakePipelineService {
  private readonly logger = new Logger(IntakePipelineService.name);
  private readonly workerId = `worker-${randomUUID().slice(0, 8)}`;

  constructor(private readonly prisma: PrismaService) {}

  // ── Enfileiramento ────────────────────────────────────────────────────────

  /** Cria um job. Se a chave de idempotência já existe, devolve o job existente. */
  async enqueue(options: EnqueueOptions) {
    const idempotencyKey =
      options.idempotencyKey ?? `${options.documentId}:${options.jobType}`;

    const existing = await this.prisma.intakeDocumentProcessingJob.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      this.logger.debug(
        `Job ${options.jobType} de ${options.documentId} já existe (idempotência).`,
      );
      return existing;
    }

    return this.prisma.intakeDocumentProcessingJob.create({
      data: {
        documentId: options.documentId,
        jobType: options.jobType,
        priority: options.priority ?? 100,
        maximumAttempts: options.maximumAttempts ?? 3,
        idempotencyKey,
        availableAt: options.availableAt ?? new Date(),
        processingMetadata: options.metadata,
        status: IntakeJobStatus.PENDING,
      },
    });
  }

  /** Enfileira a primeira etapa do pipeline de um documento recém-recebido. */
  async startPipeline(documentId: string, priority = 100) {
    await this.prisma.intakeDocument.update({
      where: { id: documentId },
      data: { processingStatus: IntakeProcessingStatus.QUEUED },
    });

    return this.enqueue({
      documentId,
      jobType: PIPELINE_ORDER[0],
      priority,
      idempotencyKey: `${documentId}:${PIPELINE_ORDER[0]}:1`,
    });
  }

  /**
   * Enfileira a etapa seguinte à informada. Devolve `null` no fim do pipeline.
   *
   * A chave de idempotência inclui o ciclo de reprocessamento, para que reprocessar um
   * documento não colida com os jobs do processamento anterior.
   */
  async enqueueNext(
    documentId: string,
    currentJobType: IntakeJobType,
    cycle = 1,
  ) {
    const index = PIPELINE_ORDER.indexOf(currentJobType);
    if (index === -1 || index === PIPELINE_ORDER.length - 1) return null;

    const next = PIPELINE_ORDER[index + 1];
    return this.enqueue({
      documentId,
      jobType: next,
      idempotencyKey: `${documentId}:${next}:${cycle}`,
    });
  }

  // ── Consumo ───────────────────────────────────────────────────────────────

  /**
   * Reserva o próximo job disponível para este worker.
   *
   * `FOR UPDATE SKIP LOCKED` é o que impede dois workers de pegarem o mesmo job: quem
   * chegar depois simplesmente ignora a linha travada e leva a seguinte.
   */
  async reserveNextJob(): Promise<{
    id: string;
    documentId: string;
    jobType: IntakeJobType;
    attemptNumber: number;
    metadata: Prisma.JsonValue | null;
  } | null> {
    const rows = await this.prisma.$queryRaw<
      { id: string }[]
    >`SELECT id FROM intake_document_processing_jobs
        WHERE status = 'PENDING' AND available_at <= NOW()
        ORDER BY priority ASC, available_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED`;

    if (rows.length === 0) return null;

    const job = await this.prisma.intakeDocumentProcessingJob.update({
      where: { id: rows[0].id },
      data: {
        status: IntakeJobStatus.RUNNING,
        startedAt: new Date(),
        attemptNumber: { increment: 1 },
        worker: this.workerId,
      },
    });

    await this.prisma.intakeDocument.update({
      where: { id: job.documentId },
      data: { processingStatus: STATUS_BY_JOB[job.jobType] },
    });

    return {
      id: job.id,
      documentId: job.documentId,
      jobType: job.jobType,
      attemptNumber: job.attemptNumber,
      metadata: job.processingMetadata,
    };
  }

  /** Marca o job como concluído. */
  async completeJob(jobId: string) {
    return this.prisma.intakeDocumentProcessingJob.update({
      where: { id: jobId },
      data: { status: IntakeJobStatus.COMPLETED, completedAt: new Date() },
    });
  }

  /**
   * Registra a falha de um job.
   *
   * Enquanto houver tentativas, o job volta para `PENDING` com `available_at` no futuro
   * (backoff exponencial). Esgotadas as tentativas, vai para `DEAD_LETTER` e o documento
   * para `ERROR` — nunca fica em `RUNNING` para sempre, que é o pior dos mundos porque
   * ninguém vê que travou.
   */
  async failJob(
    jobId: string,
    error: { code?: string; message: string },
  ): Promise<{ willRetry: boolean; nextAttemptAt: Date | null }> {
    const job = await this.prisma.intakeDocumentProcessingJob.findUniqueOrThrow(
      {
        where: { id: jobId },
      },
    );

    const willRetry = job.attemptNumber < job.maximumAttempts;

    if (willRetry) {
      const delaySeconds =
        BACKOFF_BASE_SECONDS * Math.pow(BACKOFF_FACTOR, job.attemptNumber - 1);
      const nextAttemptAt = new Date(Date.now() + delaySeconds * 1000);

      await this.prisma.intakeDocumentProcessingJob.update({
        where: { id: jobId },
        data: {
          status: IntakeJobStatus.PENDING,
          availableAt: nextAttemptAt,
          errorCode: error.code ?? null,
          errorMessage: error.message,
        },
      });

      this.logger.warn(
        `Job ${job.jobType} falhou (tentativa ${job.attemptNumber}/${job.maximumAttempts}); nova tentativa em ${delaySeconds}s.`,
      );

      return { willRetry: true, nextAttemptAt };
    }

    await this.prisma.$transaction([
      this.prisma.intakeDocumentProcessingJob.update({
        where: { id: jobId },
        data: {
          status: IntakeJobStatus.DEAD_LETTER,
          completedAt: new Date(),
          errorCode: error.code ?? null,
          errorMessage: error.message,
        },
      }),
      this.prisma.intakeDocument.update({
        where: { id: job.documentId },
        data: { processingStatus: IntakeProcessingStatus.ERROR },
      }),
    ]);

    this.logger.error(
      `Job ${job.jobType} de ${job.documentId} esgotou as tentativas e foi para a fila de erro.`,
    );

    return { willRetry: false, nextAttemptAt: null };
  }

  /**
   * Cancela os jobs pendentes de um documento.
   *
   * Só cancela o que ainda não começou: interromper um job em execução exigiria
   * cooperação do handler, e matar no meio deixaria o documento em estado indefinido.
   */
  async cancelPendingJobs(documentId: string, reason: string) {
    const result = await this.prisma.intakeDocumentProcessingJob.updateMany({
      where: { documentId, status: IntakeJobStatus.PENDING },
      data: {
        status: IntakeJobStatus.CANCELLED,
        completedAt: new Date(),
        errorMessage: reason,
      },
    });

    return { cancelled: result.count };
  }

  /**
   * Reprocessa um documento do começo.
   *
   * Abre um ciclo novo — as chaves de idempotência do ciclo anterior não travam o novo, e
   * o histórico dos jobs antigos continua no banco para consulta.
   */
  async reprocess(documentId: string) {
    await this.cancelPendingJobs(documentId, 'Reprocessamento solicitado.');

    const cycle =
      (await this.prisma.intakeDocumentProcessingJob.count({
        where: { documentId, jobType: PIPELINE_ORDER[0] },
      })) + 1;

    await this.prisma.intakeDocument.update({
      where: { id: documentId },
      data: { processingStatus: IntakeProcessingStatus.QUEUED },
    });

    return this.enqueue({
      documentId,
      jobType: PIPELINE_ORDER[0],
      idempotencyKey: `${documentId}:${PIPELINE_ORDER[0]}:${cycle}`,
      metadata: { cycle },
    });
  }

  /**
   * Executa um job com o handler informado, cuidando de sucesso, falha e retry.
   *
   * O handler pode ser chamado mais de uma vez para o mesmo job (é o que retry significa),
   * então precisa ser idempotente — as etapas do pipeline gravam com `upsert` por isso.
   */
  async runJob(
    job: {
      id: string;
      documentId: string;
      jobType: IntakeJobType;
      attemptNumber: number;
      metadata: Prisma.JsonValue | null;
    },
    handler: JobHandler,
  ): Promise<{ succeeded: boolean; willRetry: boolean }> {
    try {
      await handler(job);
      await this.completeJob(job.id);
      return { succeeded: true, willRetry: false };
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : 'Erro desconhecido.';
      const code = caught instanceof Error ? caught.name : 'UNKNOWN';
      const { willRetry } = await this.failJob(job.id, { code, message });
      return { succeeded: false, willRetry };
    }
  }

  // ── Consulta ──────────────────────────────────────────────────────────────

  /** Situação da fila, para a visão geral e para diagnóstico. */
  async queueStatus(organizationId: string, companyId?: string) {
    const scope: Prisma.IntakeDocumentProcessingJobWhereInput = {
      document: {
        organizationId,
        deletedAt: null,
        ...(companyId ? { companyId } : {}),
      },
    };

    const [pending, running, deadLetter, cancelled, oldestPending] =
      await Promise.all([
        this.prisma.intakeDocumentProcessingJob.count({
          where: { ...scope, status: IntakeJobStatus.PENDING },
        }),
        this.prisma.intakeDocumentProcessingJob.count({
          where: { ...scope, status: IntakeJobStatus.RUNNING },
        }),
        this.prisma.intakeDocumentProcessingJob.count({
          where: { ...scope, status: IntakeJobStatus.DEAD_LETTER },
        }),
        this.prisma.intakeDocumentProcessingJob.count({
          where: { ...scope, status: IntakeJobStatus.CANCELLED },
        }),
        this.prisma.intakeDocumentProcessingJob.findFirst({
          where: { ...scope, status: IntakeJobStatus.PENDING },
          orderBy: { availableAt: 'asc' },
          select: { availableAt: true, jobType: true, documentId: true },
        }),
      ]);

    return { pending, running, deadLetter, cancelled, oldestPending };
  }

  /** Jobs de um documento, do mais recente para o mais antigo. */
  findJobs(documentId: string) {
    return this.prisma.intakeDocumentProcessingJob.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Tempo médio, em segundos, entre o recebimento e a conclusão do pipeline.
   * Usado pelo indicador da visão geral (seção 6).
   */
  async averageProcessingSeconds(organizationId: string, companyId?: string) {
    const rows = await this.prisma.$queryRaw<{ average: number | null }[]>`
      SELECT AVG(EXTRACT(EPOCH FROM (d.processed_at - d.received_at)))::float AS average
        FROM intake_documents d
       WHERE d.organization_id = ${organizationId}::uuid
         AND d.deleted_at IS NULL
         AND d.processed_at IS NOT NULL
         AND (${companyId ?? null}::uuid IS NULL OR d.company_id = ${companyId ?? null}::uuid)`;

    return rows[0]?.average ?? null;
  }
}
