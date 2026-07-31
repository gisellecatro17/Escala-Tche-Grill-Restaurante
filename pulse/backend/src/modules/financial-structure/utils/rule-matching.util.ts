import { RuleConditionField, RuleConditionOperator } from '@prisma/client';

/** Lançamento hipotético avaliado pelo motor de regras (nunca persistido nesta etapa). */
export interface RuleEvaluationInput {
  description?: string;
  counterpartyName?: string;
  counterpartyDocument?: string;
  bankHistory?: string;
  documentNumber?: string;
  amount?: number;
  date?: string;
  pixKey?: string;
  bankAccount?: string;
  bank?: string;
  transactionType?: string;
  companyBankAccountId?: string;
  contractId?: string;
  projectId?: string;
  supplierId?: string;
  customerId?: string;
  origin?: string;
  previousCategoryId?: string;
  confirmationCount?: number;
}

export interface EvaluableCondition {
  field: RuleConditionField;
  operator: RuleConditionOperator;
  value: string;
  secondaryValue?: string | null;
}

/**
 * Normaliza texto para comparação estável: maiúsculas, sem acentos e com espaços
 * colapsados. É o mesmo tratamento aplicado em `normalizedValue` ao gravar a condição,
 * de modo que "COELBA" case com "Coelba" e "coélba".
 */
export function normalizeForMatching(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

/** Remove tudo que não é dígito — usado para comparar CPF/CNPJ e documentos. */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/** Extrai do lançamento o valor correspondente ao campo da condição. */
function resolveFieldValue(
  field: RuleConditionField,
  input: RuleEvaluationInput,
): string | number | undefined {
  switch (field) {
    case RuleConditionField.DESCRIPTION:
    case RuleConditionField.KEYWORD:
      return input.description;
    case RuleConditionField.CNPJ:
    case RuleConditionField.CPF:
      return input.counterpartyDocument;
    case RuleConditionField.SUPPLIER:
      return input.supplierId ?? input.counterpartyName;
    case RuleConditionField.CUSTOMER:
      return input.customerId ?? input.counterpartyName;
    case RuleConditionField.BANK_HISTORY:
      return input.bankHistory;
    case RuleConditionField.PIX_KEY:
      return input.pixKey;
    case RuleConditionField.BANK_ACCOUNT:
      return input.bankAccount;
    case RuleConditionField.BANK:
      return input.bank;
    case RuleConditionField.TRANSACTION_TYPE:
      return input.transactionType;
    case RuleConditionField.AMOUNT:
      return input.amount;
    case RuleConditionField.DATE:
      return input.date;
    case RuleConditionField.WEEKDAY:
      return input.date ? new Date(input.date).getUTCDay() : undefined;
    case RuleConditionField.DAY_OF_MONTH:
      return input.date ? new Date(input.date).getUTCDate() : undefined;
    case RuleConditionField.COMPANY_BANK_ACCOUNT:
      return input.companyBankAccountId;
    case RuleConditionField.CONTRACT:
      return input.contractId;
    case RuleConditionField.PROJECT:
      return input.projectId;
    case RuleConditionField.DOCUMENT_NUMBER:
      return input.documentNumber;
    case RuleConditionField.ORIGIN:
      return input.origin;
    case RuleConditionField.PREVIOUS_CATEGORY:
      return input.previousCategoryId;
    case RuleConditionField.CONFIRMATION_COUNT:
      return input.confirmationCount;
  }
}

/** Campos cuja comparação deve ignorar pontuação (documentos). */
const DOCUMENT_FIELDS: RuleConditionField[] = [
  RuleConditionField.CNPJ,
  RuleConditionField.CPF,
  RuleConditionField.DOCUMENT_NUMBER,
];

/** Campos naturalmente numéricos. */
const NUMERIC_FIELDS: RuleConditionField[] = [
  RuleConditionField.AMOUNT,
  RuleConditionField.WEEKDAY,
  RuleConditionField.DAY_OF_MONTH,
  RuleConditionField.CONFIRMATION_COUNT,
];

/** Uma expressão regular inválida gravada no passado não pode derrubar a avaliação. */
function safeRegexTest(pattern: string, value: string): boolean {
  try {
    return new RegExp(pattern, 'i').test(value);
  } catch {
    return false;
  }
}

/** Divide o valor de uma condição `IN`/`NOT_IN` em itens normalizados. */
function splitList(value: string): string[] {
  return value
    .split(/[;,|]/)
    .map((item) => normalizeForMatching(item))
    .filter((item) => item.length > 0);
}

/** Avalia uma única condição contra o lançamento. */
export function evaluateCondition(
  condition: EvaluableCondition,
  input: RuleEvaluationInput,
): boolean {
  const raw = resolveFieldValue(condition.field, input);

  // EXISTS/NOT_EXISTS são os únicos operadores que fazem sentido com valor ausente.
  if (condition.operator === RuleConditionOperator.EXISTS) {
    return raw !== undefined && raw !== null && String(raw).length > 0;
  }
  if (condition.operator === RuleConditionOperator.NOT_EXISTS) {
    return raw === undefined || raw === null || String(raw).length === 0;
  }

  if (raw === undefined || raw === null) return false;

  const isNumeric =
    NUMERIC_FIELDS.includes(condition.field) || typeof raw === 'number';

  if (isNumeric) {
    const actual = Number(raw);
    const expected = Number(condition.value);
    const expectedSecondary =
      condition.secondaryValue != null
        ? Number(condition.secondaryValue)
        : undefined;

    if (Number.isNaN(actual)) return false;

    switch (condition.operator) {
      case RuleConditionOperator.EQUALS:
        return actual === expected;
      case RuleConditionOperator.NOT_EQUALS:
        return actual !== expected;
      case RuleConditionOperator.GREATER_THAN:
        return actual > expected;
      case RuleConditionOperator.LESS_THAN:
        return actual < expected;
      case RuleConditionOperator.BETWEEN:
        return (
          expectedSecondary !== undefined &&
          actual >= Math.min(expected, expectedSecondary) &&
          actual <= Math.max(expected, expectedSecondary)
        );
      case RuleConditionOperator.IN:
        return splitList(condition.value).includes(String(actual));
      case RuleConditionOperator.NOT_IN:
        return !splitList(condition.value).includes(String(actual));
      default:
        // Operadores de texto não se aplicam a campos numéricos.
        return false;
    }
  }

  const useDigits = DOCUMENT_FIELDS.includes(condition.field);
  const actualText = useDigits
    ? digitsOnly(String(raw))
    : normalizeForMatching(String(raw));
  const expectedText = useDigits
    ? digitsOnly(condition.value)
    : normalizeForMatching(condition.value);

  switch (condition.operator) {
    case RuleConditionOperator.EQUALS:
      return actualText === expectedText;
    case RuleConditionOperator.NOT_EQUALS:
      return actualText !== expectedText;
    case RuleConditionOperator.CONTAINS:
      return actualText.includes(expectedText);
    case RuleConditionOperator.NOT_CONTAINS:
      return !actualText.includes(expectedText);
    case RuleConditionOperator.STARTS_WITH:
      return actualText.startsWith(expectedText);
    case RuleConditionOperator.ENDS_WITH:
      return actualText.endsWith(expectedText);
    case RuleConditionOperator.REGEX:
      return safeRegexTest(condition.value, String(raw));
    case RuleConditionOperator.IN:
      return splitList(condition.value).includes(actualText);
    case RuleConditionOperator.NOT_IN:
      return !splitList(condition.value).includes(actualText);
    case RuleConditionOperator.GREATER_THAN:
      return actualText > expectedText;
    case RuleConditionOperator.LESS_THAN:
      return actualText < expectedText;
    case RuleConditionOperator.BETWEEN:
      return (
        condition.secondaryValue != null &&
        actualText >= expectedText &&
        actualText <= normalizeForMatching(condition.secondaryValue)
      );
    default:
      return false;
  }
}

/**
 * Uma regra casa quando **todas** as suas condições casam (E lógico). Uma regra sem
 * condições nunca casa — caso contrário ela se aplicaria a todo lançamento, que é
 * justamente o erro que a seção 74 manda impedir.
 */
export function evaluateRule(
  conditions: EvaluableCondition[],
  input: RuleEvaluationInput,
): boolean {
  if (conditions.length === 0) return false;
  return conditions.every((condition) => evaluateCondition(condition, input));
}

/**
 * Duas regras conflitam quando têm a **mesma prioridade** e ações divergentes para a
 * mesma dimensão — nesse caso não há critério objetivo de desempate e a automação
 * precisa ser suspensa (seção 39).
 */
export interface ConflictCandidate {
  id: string;
  name: string;
  priority: number;
  actions: {
    categoryId?: string | null;
    costCenterId?: string | null;
    resultCenterId?: string | null;
    projectId?: string | null;
    accountPlanId?: string | null;
    financialNatureId?: string | null;
  }[];
}

export interface RuleConflict {
  priority: number;
  field: string;
  rules: { id: string; name: string; value: string }[];
}

const CONFLICT_FIELDS = [
  'categoryId',
  'costCenterId',
  'resultCenterId',
  'projectId',
  'accountPlanId',
  'financialNatureId',
] as const;

const CONFLICT_FIELD_LABELS: Record<(typeof CONFLICT_FIELDS)[number], string> =
  {
    categoryId: 'categoria',
    costCenterId: 'centro de custo',
    resultCenterId: 'centro de resultado',
    projectId: 'projeto',
    accountPlanId: 'conta do plano',
    financialNatureId: 'natureza financeira',
  };

/** Detecta regras de mesma prioridade que aplicariam valores diferentes na mesma dimensão. */
export function detectConflicts(rules: ConflictCandidate[]): RuleConflict[] {
  const byPriority = new Map<number, ConflictCandidate[]>();
  for (const rule of rules) {
    byPriority.set(rule.priority, [
      ...(byPriority.get(rule.priority) ?? []),
      rule,
    ]);
  }

  const conflicts: RuleConflict[] = [];

  for (const [priority, group] of byPriority) {
    if (group.length < 2) continue;

    for (const field of CONFLICT_FIELDS) {
      const assignments = new Map<
        string,
        { id: string; name: string; value: string }
      >();

      for (const rule of group) {
        for (const action of rule.actions) {
          const value = action[field];
          if (!value) continue;
          // Guarda apenas a primeira regra por valor: o conflito é entre valores distintos.
          if (!assignments.has(value)) {
            assignments.set(value, { id: rule.id, name: rule.name, value });
          }
        }
      }

      if (assignments.size > 1) {
        conflicts.push({
          priority,
          field: CONFLICT_FIELD_LABELS[field],
          rules: [...assignments.values()],
        });
      }
    }
  }

  return conflicts;
}
