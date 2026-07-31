export type ApprovalRequestStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "APPROVED"
  | "REJECTED"
  | "WAITING_INFORMATION"
  | "CANCELLED"
  | "EXPIRED";

export type ApprovalStepStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "APPROVED"
  | "REJECTED"
  | "WAITING_INFORMATION"
  | "SKIPPED";

export type ApprovalApproverType =
  | "SPECIFIC_USER"
  | "ROLE"
  | "ANY_WITH_PERMISSION";

export type ApprovalPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type ApprovalDelegationReason =
  | "VACATION"
  | "LEAVE"
  | "TRAVEL"
  | "ABSENCE"
  | "OTHER";

export type ApprovalNotificationChannel =
  | "EMAIL"
  | "PUSH"
  | "WHATSAPP"
  | "TEAMS"
  | "SLACK";

export type ApprovalActionType =
  | "CREATED"
  | "APPROVED"
  | "REJECTED"
  | "CHANGES_REQUESTED"
  | "DOCUMENTS_REQUESTED"
  | "DELEGATED"
  | "FORWARDED"
  | "COMMENTED"
  | "CANCELLED"
  | "RESTARTED"
  | "EXPIRED"
  | "FLOW_CHANGED"
  | "APPROVERS_CHANGED"
  | "THRESHOLD_CHANGED"
  | "PRIORITY_CHANGED";

export const REQUEST_STATUS_LABELS: Record<ApprovalRequestStatus, string> = {
  PENDING: "Aguardando autorização",
  IN_PROGRESS: "Em aprovação",
  APPROVED: "Aprovado",
  REJECTED: "Reprovado",
  WAITING_INFORMATION: "Aguardando informações",
  CANCELLED: "Cancelado",
  EXPIRED: "Expirado",
};

/** O que cada situação significa na prática — "expirado" não é "reprovado". */
export const REQUEST_STATUS_HINTS: Record<ApprovalRequestStatus, string> = {
  PENDING: "Criada, nenhuma etapa começou.",
  IN_PROGRESS: "Alguma etapa aguarda decisão.",
  APPROVED:
    "Todas as etapas obrigatórias foram aprovadas. A despesa pode virar obrigação — nenhum pagamento foi autorizado.",
  REJECTED: "Reprovada. O lançamento não segue para Contas a Pagar.",
  WAITING_INFORMATION:
    "Devolvida a quem pediu. Volta a andar assim que alguém responder.",
  CANCELLED: "Cancelada com motivo. O registro permanece.",
  EXPIRED:
    "Passou do prazo sem decisão. Não é reprovação: alguém precisa reiniciar o fluxo.",
};

export const STEP_STATUS_LABELS: Record<ApprovalStepStatus, string> = {
  PENDING: "Aguardando",
  IN_PROGRESS: "Em aprovação",
  APPROVED: "Aprovada",
  REJECTED: "Reprovada",
  WAITING_INFORMATION: "Aguardando informações",
  SKIPPED: "Dispensada pela alçada",
};

export const APPROVER_TYPE_LABELS: Record<ApprovalApproverType, string> = {
  SPECIFIC_USER: "Pessoa específica",
  ROLE: "Perfil",
  ANY_WITH_PERMISSION: "Qualquer aprovador",
};

export const PRIORITY_LABELS: Record<ApprovalPriority, string> = {
  LOW: "Baixa",
  NORMAL: "Normal",
  HIGH: "Alta",
  URGENT: "Urgente",
};

export const DELEGATION_REASON_LABELS: Record<ApprovalDelegationReason, string> =
  {
    VACATION: "Férias",
    LEAVE: "Licença",
    TRAVEL: "Viagem",
    ABSENCE: "Ausência",
    OTHER: "Outro",
  };

export const NOTIFICATION_CHANNEL_LABELS: Record<
  ApprovalNotificationChannel,
  string
> = {
  EMAIL: "E-mail",
  PUSH: "Push",
  WHATSAPP: "WhatsApp",
  TEAMS: "Microsoft Teams",
  SLACK: "Slack",
};

/** Canais declarados mas sem envio real nesta etapa. */
export const UNIMPLEMENTED_CHANNELS: ApprovalNotificationChannel[] = [
  "WHATSAPP",
  "TEAMS",
  "SLACK",
];

export const ACTION_LABELS: Record<ApprovalActionType, string> = {
  CREATED: "Solicitação criada",
  APPROVED: "Aprovado",
  REJECTED: "Reprovado",
  CHANGES_REQUESTED: "Ajuste solicitado",
  DOCUMENTS_REQUESTED: "Documentos solicitados",
  DELEGATED: "Aprovação delegada",
  FORWARDED: "Encaminhado",
  COMMENTED: "Comentário",
  CANCELLED: "Fluxo cancelado",
  RESTARTED: "Fluxo reiniciado",
  EXPIRED: "Prazo vencido",
  FLOW_CHANGED: "Fluxo alterado",
  APPROVERS_CHANGED: "Aprovadores alterados",
  THRESHOLD_CHANGED: "Alçada alterada",
  PRIORITY_CHANGED: "Prioridade alterada",
};

interface Summary {
  id: string;
  legalName?: string | null;
  tradeName?: string | null;
}

export interface ApprovalStepApproval {
  id: string;
  requestStepId: string;
  approvedBy: string;
  onBehalfOf: string | null;
  delegationId: string | null;
  comment: string | null;
  approvedAt: string;
}

export interface ApprovalRequestStep {
  id: string;
  requestId: string;
  flowStepId: string | null;
  stepOrder: number;
  name: string;
  approverType: ApprovalApproverType;
  approverUserId: string | null;
  approverRoleId: string | null;
  requiredApprovals: number;
  approvalsGiven: number;
  isMandatory: boolean;
  blockSelfApproval: boolean;
  status: ApprovalStepStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionComment: string | null;
  actedOnBehalfOf: string | null;
  dueAt: string | null;
  startedAt: string | null;
  approvals?: ApprovalStepApproval[];
}

export interface ApprovalComment {
  id: string;
  requestId: string;
  stepOrder: number | null;
  authorId: string;
  text: string;
  attachmentIds: string[];
  isDocumentRequest: boolean;
  createdAt: string;
}

export interface ApprovalHistoryEntry {
  id: string;
  requestId: string;
  action: ApprovalActionType;
  stepOrder: number | null;
  actorId: string | null;
  onBehalfOf: string | null;
  previousStatus: ApprovalRequestStatus | null;
  newStatus: ApprovalRequestStatus | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ApprovalRequest {
  id: string;
  organizationId: string;
  companyId: string;
  company?: Summary | null;

  entryId: string;
  entry?: {
    id: string;
    documentNumber: string | null;
    description: string | null;
    direction: "PAYABLE" | "RECEIVABLE";
    netAmount: string | number;
    status: string;
    categoryId: string | null;
    costCenterId: string | null;
    sourceIntakeDocumentId: string | null;
    supplier?: Summary | null;
    customer?: Summary | null;
  };

  flowId: string;
  flow?: { id: string; name: string };

  attempt: number;
  status: ApprovalRequestStatus;
  priority: ApprovalPriority;
  amount: string | number;

  currentStepOrder: number | null;
  dueAt: string | null;
  startedAt: string | null;
  decidedAt: string | null;
  decisionSeconds: number | null;

  requestedBy: string | null;
  rejectionReason: string | null;
  cancellationReason: string | null;

  createdAt: string;
  updatedAt: string;

  steps?: ApprovalRequestStep[];
  comments?: ApprovalComment[];
  history?: ApprovalHistoryEntry[];
}

export interface ApprovalFlowStep {
  id: string;
  flowId: string;
  stepOrder: number;
  name: string;
  approverType: ApprovalApproverType;
  approverUserId: string | null;
  approverRoleId: string | null;
  requiredApprovals: number;
  isMandatory: boolean;
  minimumAmount: string | number | null;
  maximumAmount: string | number | null;
  deadlineHours: number | null;
  blockSelfApproval: boolean;
  notes: string | null;
}

export interface ApprovalFlow {
  id: string;
  organizationId: string;
  companyId: string;
  name: string;
  description: string | null;

  categoryId: string | null;
  costCenterId: string | null;
  projectId: string | null;
  businessUnitId: string | null;
  financialNatureId: string | null;
  contractId: string | null;
  supplierId: string | null;
  paymentMethodId: string | null;
  documentType: string | null;
  direction: "PAYABLE" | "RECEIVABLE" | null;
  minimumAmount: string | number | null;
  maximumAmount: string | number | null;
  minimumPriority: ApprovalPriority | null;

  priority: number;
  defaultDeadlineHours: number;
  notificationChannels: ApprovalNotificationChannel[];
  isDefault: boolean;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";

  steps?: ApprovalFlowStep[];
  _count?: { requests: number };
}

export interface ApprovalDelegation {
  id: string;
  organizationId: string;
  companyId: string;
  delegatorId: string;
  delegateId: string;
  reason: ApprovalDelegationReason;
  description: string | null;
  startsAt: string;
  endsAt: string;
  maximumAmount: string | number | null;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  revokedBy: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface ApprovalDashboard {
  cards: {
    pending: number;
    pendingAmount: number;
    overdue: number;
    urgent: number;
    rejected: number;
    approvedTotal: number;
  };
  byCompany: {
    companyId: string;
    companyName: string | null;
    count: number;
    amount: number;
  }[];
  byStatus: { status: ApprovalRequestStatus; count: number }[];
  byApprover: { userId: string | null; userName: string | null; count: number }[];
  byCostCenter: {
    costCenterId: string | null;
    costCenterName: string | null;
    count: number;
    amount: number;
  }[];
  indicators: {
    averageDecisionSeconds: number | null;
    decidedCount: number;
  };
  note: string;
}

export interface ApprovalSettings {
  id: string;
  organizationId: string;
  companyId: string;
  requireApprovalForAll: boolean;
  mandatoryAboveAmount: string | number | null;
  blockSelfApprovalGlobally: boolean;
  enforceIndividualLimit: boolean;
  expireOverdueRequests: boolean;
  defaultDeadlineHours: number;
  notificationChannels: ApprovalNotificationChannel[];
}

export interface BatchApprovalResult {
  succeeded: number;
  failed: { id: string; reason: string }[];
  total: number;
}

/** Tempo médio de aprovação em texto curto — segundos crus não dizem nada a ninguém. */
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h`;

  return `${Math.round(hours / 24)} dias`;
}
