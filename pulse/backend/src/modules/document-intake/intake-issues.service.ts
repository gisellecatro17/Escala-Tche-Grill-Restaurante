import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  IntakeIssueSeverity,
  IntakeIssueStatus,
  IntakeIssueType,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from '../../common/types/authenticated-request';
import { AuditService } from '../audit/audit.service';

/**
 * Pendências do documento (seções 44 e 45).
 *
 * Severidade não é rótulo decorativo: `BLOCKING` **impede** o encaminhamento. É o que
 * garante que um documento sem empresa identificada, ou com boleto inválido, não escorregue
 * para o módulo financeiro e se transforme em pagamento errado.
 *
 * A severidade de cada tipo é fixa em um só lugar, para que a mesma situação nunca seja
 * bloqueante em um caminho do código e apenas informativa em outro.
 */
const DEFAULT_SEVERITY: Record<IntakeIssueType, IntakeIssueSeverity> = {
  // Sem empresa não há como saber de quem é a despesa: bloqueia.
  COMPANY_NOT_IDENTIFIED: IntakeIssueSeverity.BLOCKING,
  // Fornecedor e cliente bloqueiam conforme o tipo do documento; ver `severityFor`.
  SUPPLIER_NOT_IDENTIFIED: IntakeIssueSeverity.BLOCKING,
  CUSTOMER_NOT_IDENTIFIED: IntakeIssueSeverity.BLOCKING,
  UNREADABLE_DOCUMENT: IntakeIssueSeverity.WARNING,
  AMOUNT_NOT_IDENTIFIED: IntakeIssueSeverity.BLOCKING,
  DUE_DATE_NOT_IDENTIFIED: IntakeIssueSeverity.WARNING,
  DUPLICATE_DOCUMENT: IntakeIssueSeverity.BLOCKING,
  INVALID_CODE: IntakeIssueSeverity.BLOCKING,
  AMOUNT_DIVERGENCE: IntakeIssueSeverity.BLOCKING,
  DUE_DATE_DIVERGENCE: IntakeIssueSeverity.WARNING,
  HOLDER_DIVERGENCE: IntakeIssueSeverity.WARNING,
  CATEGORY_MISSING: IntakeIssueSeverity.WARNING,
  COST_CENTER_REQUIRED: IntakeIssueSeverity.BLOCKING,
  PROJECT_REQUIRED: IntakeIssueSeverity.BLOCKING,
  WITHHOLDING_PENDING: IntakeIssueSeverity.WARNING,
  PROTECTED_DOCUMENT: IntakeIssueSeverity.BLOCKING,
  CORRUPTED_FILE: IntakeIssueSeverity.BLOCKING,
  APPROVAL_REQUIRED: IntakeIssueSeverity.BLOCKING,
  OTHER: IntakeIssueSeverity.INFORMATIONAL,
};

/** Descrição padrão de cada pendência, em português e já pronta para exibição. */
const DEFAULT_DESCRIPTION: Record<IntakeIssueType, string> = {
  COMPANY_NOT_IDENTIFIED:
    'A empresa não foi identificada. Selecione a empresa de destino.',
  SUPPLIER_NOT_IDENTIFIED: 'O fornecedor não foi localizado no cadastro.',
  CUSTOMER_NOT_IDENTIFIED: 'O cliente não foi localizado no cadastro.',
  UNREADABLE_DOCUMENT: 'Não foi possível extrair informações deste documento.',
  AMOUNT_NOT_IDENTIFIED: 'O valor do documento não foi identificado.',
  DUE_DATE_NOT_IDENTIFIED: 'O vencimento não foi identificado.',
  DUPLICATE_DOCUMENT: 'Foi identificada uma possível duplicidade.',
  INVALID_CODE:
    'O código de barras ou a linha digitável apresenta divergência.',
  AMOUNT_DIVERGENCE: 'Os valores informados não fecham.',
  DUE_DATE_DIVERGENCE: 'O vencimento lido difere do informado.',
  HOLDER_DIVERGENCE: 'O titular do documento difere do favorecido cadastrado.',
  CATEGORY_MISSING: 'A categoria financeira não foi definida.',
  COST_CENTER_REQUIRED: 'O centro de custo é obrigatório para esta empresa.',
  PROJECT_REQUIRED: 'O projeto é obrigatório para esta empresa.',
  WITHHOLDING_PENDING: 'Há retenções sugeridas que precisam de confirmação.',
  PROTECTED_DOCUMENT: 'O documento está protegido por senha.',
  CORRUPTED_FILE: 'O arquivo parece estar corrompido.',
  APPROVAL_REQUIRED: 'Este documento exige aprovação antes do encaminhamento.',
  OTHER: 'Pendência registrada manualmente.',
};

export interface RaiseIssueInput {
  documentId: string;
  issueType: IntakeIssueType;
  fieldName?: string | null;
  description?: string;
  severity?: IntakeIssueSeverity;
  assignedUserId?: string | null;
}

@Injectable()
export class IntakeIssuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Severidade efetiva de uma pendência, considerando o contexto do documento.
   *
   * Fornecedor faltando bloqueia um documento de despesa, mas não um de receita — e cobrar
   * fornecedor em nota de venda travaria documentos legítimos sem motivo.
   */
  severityFor(
    issueType: IntakeIssueType,
    context: { documentDirection?: string | null } = {},
  ): IntakeIssueSeverity {
    if (
      issueType === IntakeIssueType.SUPPLIER_NOT_IDENTIFIED &&
      context.documentDirection !== 'PAYABLE'
    ) {
      return IntakeIssueSeverity.WARNING;
    }

    if (
      issueType === IntakeIssueType.CUSTOMER_NOT_IDENTIFIED &&
      context.documentDirection !== 'RECEIVABLE'
    ) {
      return IntakeIssueSeverity.WARNING;
    }

    return DEFAULT_SEVERITY[issueType];
  }

  /**
   * Abre uma pendência, ou atualiza a que já existe do mesmo tipo e campo.
   *
   * Não cria duplicatas: o pipeline pode rodar de novo (retry, reprocessamento) e não deve
   * empilhar cinco vezes "empresa não identificada" no mesmo documento.
   */
  async raise(input: RaiseIssueInput) {
    const document = await this.prisma.intakeDocument.findFirstOrThrow({
      where: { id: input.documentId, deletedAt: null },
      select: { id: true, documentDirection: true },
    });

    const severity =
      input.severity ??
      this.severityFor(input.issueType, {
        documentDirection: document.documentDirection,
      });

    const existing = await this.prisma.intakeDocumentIssue.findFirst({
      where: {
        documentId: input.documentId,
        issueType: input.issueType,
        fieldName: input.fieldName ?? null,
        status: { in: [IntakeIssueStatus.OPEN, IntakeIssueStatus.IN_PROGRESS] },
      },
    });

    if (existing) {
      return this.prisma.intakeDocumentIssue.update({
        where: { id: existing.id },
        data: {
          severity,
          description: input.description ?? existing.description,
          assignedUserId: input.assignedUserId ?? existing.assignedUserId,
        },
      });
    }

    return this.prisma.intakeDocumentIssue.create({
      data: {
        documentId: input.documentId,
        issueType: input.issueType,
        severity,
        fieldName: input.fieldName ?? null,
        description: input.description ?? DEFAULT_DESCRIPTION[input.issueType],
        assignedUserId: input.assignedUserId ?? null,
      },
    });
  }

  /**
   * Fecha automaticamente as pendências de um tipo que deixaram de existir.
   *
   * Chamado quando o pipeline roda de novo: se a empresa foi identificada nesta passada, a
   * pendência anterior precisa sair sozinha — obrigar o usuário a fechar manualmente uma
   * pendência que o sistema já resolveu seria trabalho inútil.
   */
  async resolveAutomatically(
    documentId: string,
    issueTypes: IntakeIssueType[],
    resolution: string,
  ) {
    if (issueTypes.length === 0) return { resolved: 0 };

    const result = await this.prisma.intakeDocumentIssue.updateMany({
      where: {
        documentId,
        issueType: { in: issueTypes },
        status: { in: [IntakeIssueStatus.OPEN, IntakeIssueStatus.IN_PROGRESS] },
      },
      data: {
        status: IntakeIssueStatus.RESOLVED,
        resolution,
        resolvedAt: new Date(),
      },
    });

    return { resolved: result.count };
  }

  findAll(documentId: string) {
    return this.prisma.intakeDocumentIssue.findMany({
      where: { documentId },
      orderBy: [{ severity: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /** Pendências bloqueantes ainda abertas. Vazio significa que pode encaminhar. */
  findBlocking(documentId: string) {
    return this.prisma.intakeDocumentIssue.findMany({
      where: {
        documentId,
        severity: IntakeIssueSeverity.BLOCKING,
        status: { in: [IntakeIssueStatus.OPEN, IntakeIssueStatus.IN_PROGRESS] },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async update(
    documentId: string,
    issueId: string,
    data: {
      severity?: IntakeIssueSeverity;
      description?: string;
      assignedUserId?: string | null;
      status?: IntakeIssueStatus;
    },
  ) {
    const issue = await this.findOneOrThrow(documentId, issueId);

    return this.prisma.intakeDocumentIssue.update({
      where: { id: issue.id },
      data,
    });
  }

  /** Resolve uma pendência manualmente. A solução é obrigatória: some sem rastro, não. */
  async resolve(
    documentId: string,
    issueId: string,
    resolution: string,
    actor: RequestUser,
  ) {
    const issue = await this.findOneOrThrow(documentId, issueId);

    if (!resolution.trim()) {
      throw new BadRequestException('Informe como a pendência foi resolvida.');
    }

    const resolved = await this.prisma.intakeDocumentIssue.update({
      where: { id: issue.id },
      data: {
        status: IntakeIssueStatus.RESOLVED,
        resolution: resolution.trim(),
        resolvedBy: actor.id,
        resolvedAt: new Date(),
      },
    });

    await this.audit.log({
      organizationId: issue.document.organizationId,
      companyId: issue.document.companyId,
      userId: actor.id,
      action: 'RESOLVE_INTAKE_ISSUE',
      entity: 'IntakeDocumentIssue',
      entityId: issue.id,
      oldValue: { status: issue.status, severity: issue.severity },
      newValue: { status: IntakeIssueStatus.RESOLVED },
      reason: resolution.trim(),
    });

    return resolved;
  }

  /** Contagem de pendências abertas por severidade, para a visão geral. */
  async countBySeverity(organizationId: string, companyId?: string) {
    const grouped = await this.prisma.intakeDocumentIssue.groupBy({
      by: ['severity'],
      where: {
        status: { in: [IntakeIssueStatus.OPEN, IntakeIssueStatus.IN_PROGRESS] },
        document: {
          organizationId,
          deletedAt: null,
          ...(companyId ? { companyId } : {}),
        },
      },
      _count: { _all: true },
    });

    const counts: Record<IntakeIssueSeverity, number> = {
      BLOCKING: 0,
      WARNING: 0,
      INFORMATIONAL: 0,
    };

    for (const row of grouped) counts[row.severity] = row._count._all;
    return counts;
  }

  private async findOneOrThrow(documentId: string, issueId: string) {
    const issue = await this.prisma.intakeDocumentIssue.findFirst({
      where: { id: issueId, documentId },
      include: {
        document: { select: { organizationId: true, companyId: true } },
      },
    });

    if (!issue) throw new NotFoundException('Pendência não encontrada.');
    return issue;
  }
}

/** Exportado para o pipeline montar as pendências com a mesma descrição da tela. */
export { DEFAULT_DESCRIPTION as INTAKE_ISSUE_DESCRIPTIONS };

export type IntakeIssueWhereInput = Prisma.IntakeDocumentIssueWhereInput;
