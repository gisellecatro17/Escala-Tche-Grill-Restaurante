import { Injectable } from '@nestjs/common';
import { Prisma, RecordStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

/**
 * Identificação de empresa, fornecedor e cliente a partir dos dados extraídos
 * (seções 28, 29 e 30).
 *
 * Não cria estrutura de reconhecimento nova: usa `supplier_bank_identifiers` e
 * `supplier_recognition_learning`, que foram criadas no módulo de Fornecedores exatamente
 * para isto. A prioridade é a do prompt — documento exato primeiro, similaridade textual
 * por último — porque cada degrau abaixo vale menos e um acerto por CNPJ não deve ser
 * disputado por um acerto por nome parecido.
 */

export interface IdentificationCandidate<T> {
  entity: T;
  confidence: number;
  /** Como o vínculo foi encontrado — aparece na tela e na auditoria. */
  matchedBy: string;
  matchedValue: string | null;
}

export interface IdentificationResult<T> {
  /** Escolhido apenas quando há um vencedor claro. */
  identified: IdentificationCandidate<T> | null;
  candidates: IdentificationCandidate<T>[];
  /** `true` quando há empate técnico e a escolha precisa ser humana. */
  ambiguous: boolean;
}

/** Dados que a identificação consegue usar, vindos da extração. */
export interface IdentificationInput {
  issuerDocument?: string | null;
  issuerName?: string | null;
  recipientDocument?: string | null;
  recipientName?: string | null;
  pixKey?: string | null;
  bankAccount?: { institution?: string | null; branch?: string | null; account?: string | null } | null;
  barcode?: string | null;
  text?: string | null;
}

/**
 * Confiança de cada critério, na ordem de prioridade das seções 28-30.
 *
 * Os números não são decorativos: eles alimentam as faixas da seção 32, que decidem se o
 * sistema preenche o campo sozinho ou exige revisão. Um acerto por similaridade textual
 * fica deliberadamente abaixo de 75, a faixa de "média confiança", para nunca preencher
 * fornecedor em silêncio com base em nome parecido.
 */
const CONFIDENCE = {
  EXACT_DOCUMENT: 99,
  PIX_KEY: 96,
  BANK_ACCOUNT: 94,
  CONFIRMED_IDENTIFIER: 92,
  LEGAL_NAME: 88,
  TRADE_NAME: 84,
  ALTERNATIVE_NAME: 80,
  LEARNED_TEXT: 78,
  TEXT_SIMILARITY: 60,
} as const;

const COMPANY_SELECT = {
  id: true,
  legalName: true,
  tradeName: true,
  documentNumber: true,
  normalizedDocumentNumber: true,
} satisfies Prisma.CompanySelect;

const SUPPLIER_SELECT = {
  id: true,
  legalName: true,
  tradeName: true,
  documentNumber: true,
  normalizedDocumentNumber: true,
} satisfies Prisma.SupplierSelect;

const CUSTOMER_SELECT = {
  id: true,
  legalName: true,
  tradeName: true,
  documentNumber: true,
  normalizedDocumentNumber: true,
} satisfies Prisma.CustomerSelect;

export type IdentifiedCompany = Prisma.CompanyGetPayload<{ select: typeof COMPANY_SELECT }>;
export type IdentifiedSupplier = Prisma.SupplierGetPayload<{ select: typeof SUPPLIER_SELECT }>;
export type IdentifiedCustomer = Prisma.CustomerGetPayload<{ select: typeof CUSTOMER_SELECT }>;

@Injectable()
export class PartyIdentificationService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Empresa (seção 28) ────────────────────────────────────────────────────

  /**
   * Identifica a empresa de destino do documento.
   *
   * Procura o CNPJ do **destinatário** — é ele que diz para quem o documento foi emitido.
   * Usar o CNPJ do emitente daria a empresa errada em toda nota de compra.
   *
   * `allowedCompanyIds` restringe a busca às empresas a que o usuário tem acesso: a
   * identificação nunca pode revelar a existência de uma empresa que o usuário não vê.
   */
  async identifyCompany(
    organizationId: string,
    input: IdentificationInput,
    allowedCompanyIds: string[] | null,
  ): Promise<IdentificationResult<IdentifiedCompany>> {
    const candidates: IdentificationCandidate<IdentifiedCompany>[] = [];

    const scope: Prisma.CompanyWhereInput = {
      organizationId,
      deletedAt: null,
      ...(allowedCompanyIds ? { id: { in: allowedCompanyIds } } : {}),
    };

    const recipientDocument = onlyDigits(input.recipientDocument);
    if (recipientDocument) {
      const company = await this.prisma.company.findFirst({
        where: { ...scope, normalizedDocumentNumber: recipientDocument },
        select: COMPANY_SELECT,
      });
      if (company) {
        candidates.push({
          entity: company,
          confidence: CONFIDENCE.EXACT_DOCUMENT,
          matchedBy: 'RECIPIENT_DOCUMENT',
          matchedValue: recipientDocument,
        });
      }
    }

    // O documento pode citar o CNPJ da empresa em outro lugar que não o campo de
    // destinatário (conta de consumo, guia tributária). Procuramos os CNPJs do texto.
    if (candidates.length === 0 && input.text) {
      const documentsInText = extractDocumentsFromText(input.text);
      const issuerDocument = onlyDigits(input.issuerDocument);

      for (const candidateDocument of documentsInText) {
        // O CNPJ do emitente não identifica a empresa: ele identifica o fornecedor.
        if (candidateDocument === issuerDocument) continue;

        const company = await this.prisma.company.findFirst({
          where: { ...scope, normalizedDocumentNumber: candidateDocument },
          select: COMPANY_SELECT,
        });
        if (company) {
          candidates.push({
            entity: company,
            confidence: CONFIDENCE.LEGAL_NAME,
            matchedBy: 'DOCUMENT_IN_TEXT',
            matchedValue: candidateDocument,
          });
        }
      }
    }

    // Conta bancária citada no documento: o boleto de débito automático traz a conta da
    // empresa pagadora.
    if (candidates.length === 0 && input.bankAccount?.account) {
      const account = onlyDigits(input.bankAccount.account);
      const branch = onlyDigits(input.bankAccount.branch);
      if (account) {
        const financialAccount = await this.prisma.financialAccount.findFirst({
          where: {
            organizationId,
            deletedAt: null,
            accountNumber: { contains: account },
            ...(branch ? { branchNumber: { contains: branch } } : {}),
            ...(allowedCompanyIds ? { companyId: { in: allowedCompanyIds } } : {}),
          },
          select: { companyId: true },
        });

        if (financialAccount) {
          const company = await this.prisma.company.findFirst({
            where: { ...scope, id: financialAccount.companyId },
            select: COMPANY_SELECT,
          });
          if (company) {
            candidates.push({
              entity: company,
              confidence: CONFIDENCE.BANK_ACCOUNT,
              matchedBy: 'FINANCIAL_ACCOUNT',
              matchedValue: account,
            });
          }
        }
      }
    }

    return resolve(candidates);
  }

  // ── Fornecedor (seção 29) ─────────────────────────────────────────────────

  /**
   * Identifica o fornecedor pela ordem de prioridade da seção 29.
   *
   * Para cada degrau, só desce ao seguinte se o anterior não achou nada: um CNPJ exato
   * encerra a busca, e não faz sentido continuar procurando por nome depois disso.
   */
  async identifySupplier(
    organizationId: string,
    companyId: string | null,
    input: IdentificationInput,
  ): Promise<IdentificationResult<IdentifiedSupplier>> {
    const candidates: IdentificationCandidate<IdentifiedSupplier>[] = [];
    const scope: Prisma.SupplierWhereInput = { organizationId, deletedAt: null };

    // 1. CNPJ ou CPF exato.
    const issuerDocument = onlyDigits(input.issuerDocument);
    if (issuerDocument) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { ...scope, normalizedDocumentNumber: issuerDocument },
        select: SUPPLIER_SELECT,
      });
      if (supplier) {
        return resolve([
          {
            entity: supplier,
            confidence: CONFIDENCE.EXACT_DOCUMENT,
            matchedBy: 'ISSUER_DOCUMENT',
            matchedValue: issuerDocument,
          },
        ]);
      }
    }

    // 2. Chave PIX e 3. conta bancária — ambas em supplier_bank_identifiers, a tabela que
    // o módulo de Fornecedores criou para reconhecimento.
    const identifierValues = [
      input.pixKey ? { value: normalizeIdentifier(input.pixKey), kind: 'PIX_KEY' as const } : null,
      input.bankAccount?.account
        ? { value: normalizeIdentifier(input.bankAccount.account), kind: 'BANK_ACCOUNT' as const }
        : null,
    ].filter((entry): entry is { value: string; kind: 'PIX_KEY' | 'BANK_ACCOUNT' } => entry !== null);

    for (const identifier of identifierValues) {
      const found = await this.prisma.supplierBankIdentifier.findFirst({
        where: {
          normalizedValue: identifier.value,
          status: RecordStatus.ACTIVE,
          supplier: scope,
          ...(companyId ? { OR: [{ companyId }, { companyId: null }] } : {}),
        },
        include: { supplier: { select: SUPPLIER_SELECT } },
        orderBy: [{ confirmedCount: 'desc' }, { priority: 'asc' }],
      });

      if (found) {
        candidates.push({
          entity: found.supplier,
          confidence:
            identifier.kind === 'PIX_KEY' ? CONFIDENCE.PIX_KEY : CONFIDENCE.BANK_ACCOUNT,
          matchedBy: identifier.kind,
          matchedValue: identifier.value,
        });
      }
    }

    if (candidates.length > 0) return resolve(candidates);

    // 4. Identificador confirmado: qualquer valor do documento que já foi confirmado antes
    // para um fornecedor (número de cliente na concessionária, código do convênio).
    if (input.text) {
      const learned = await this.matchLearnedText(organizationId, companyId, input.text);
      if (learned) candidates.push(learned);
    }

    if (candidates.length > 0) return resolve(candidates);

    // 5-7. Razão social, nome fantasia e nome alternativo.
    const name = input.issuerName?.trim();
    if (name) {
      const byName = await this.matchSupplierByName(scope, name);
      candidates.push(...byName);
    }

    return resolve(candidates);
  }

  /**
   * Procura no texto do documento um trecho que já foi confirmado como pertencente a um
   * fornecedor (`supplier_recognition_learning`).
   *
   * O aprendizado é por confirmação humana: quanto mais vezes um texto foi confirmado,
   * mais confiável ele é. Registros mais rejeitados que confirmados são ignorados — o
   * usuário já disse que aquele texto não identifica aquele fornecedor.
   */
  private async matchLearnedText(
    organizationId: string,
    companyId: string | null,
    text: string,
  ): Promise<IdentificationCandidate<IdentifiedSupplier> | null> {
    const normalizedText = normalizeText(text);

    const learnings = await this.prisma.supplierRecognitionLearning.findMany({
      where: {
        organizationId,
        status: RecordStatus.ACTIVE,
        supplierId: { not: null },
        ...(companyId ? { OR: [{ companyId }, { companyId: null }] } : {}),
      },
      orderBy: [{ confirmedCount: 'desc' }],
      take: 300,
    });

    for (const learning of learnings) {
      if (learning.rejectedCount > learning.confirmedCount) continue;
      if (learning.normalizedText.length < 4) continue;
      if (!normalizedText.includes(learning.normalizedText)) continue;

      const supplier = await this.prisma.supplier.findFirst({
        where: { id: learning.supplierId!, deletedAt: null },
        select: SUPPLIER_SELECT,
      });
      if (!supplier) continue;

      return {
        entity: supplier,
        confidence: Math.min(
          CONFIDENCE.LEARNED_TEXT + Math.min(learning.confirmedCount, 10),
          CONFIDENCE.CONFIRMED_IDENTIFIER,
        ),
        matchedBy: 'LEARNED_TEXT',
        matchedValue: learning.originalText,
      };
    }

    return null;
  }

  private async matchSupplierByName(
    scope: Prisma.SupplierWhereInput,
    name: string,
  ): Promise<IdentificationCandidate<IdentifiedSupplier>[]> {
    const candidates: IdentificationCandidate<IdentifiedSupplier>[] = [];

    const [byLegalName, byTradeName, byAlternative] = await Promise.all([
      this.prisma.supplier.findMany({
        where: { ...scope, legalName: { equals: name, mode: 'insensitive' } },
        select: SUPPLIER_SELECT,
        take: 5,
      }),
      this.prisma.supplier.findMany({
        where: { ...scope, tradeName: { equals: name, mode: 'insensitive' } },
        select: SUPPLIER_SELECT,
        take: 5,
      }),
      this.prisma.supplierAlternativeName.findMany({
        where: { name: { equals: name, mode: 'insensitive' }, supplier: scope },
        include: { supplier: { select: SUPPLIER_SELECT } },
        take: 5,
      }),
    ]);

    for (const supplier of byLegalName) {
      candidates.push({
        entity: supplier,
        confidence: CONFIDENCE.LEGAL_NAME,
        matchedBy: 'LEGAL_NAME',
        matchedValue: name,
      });
    }
    for (const supplier of byTradeName) {
      candidates.push({
        entity: supplier,
        confidence: CONFIDENCE.TRADE_NAME,
        matchedBy: 'TRADE_NAME',
        matchedValue: name,
      });
    }
    for (const alternative of byAlternative) {
      candidates.push({
        entity: alternative.supplier,
        confidence: CONFIDENCE.ALTERNATIVE_NAME,
        matchedBy: 'ALTERNATIVE_NAME',
        matchedValue: alternative.name,
      });
    }

    // 9. Similaridade textual, só se nada exato apareceu. Confiança abaixo de 75 de
    // propósito: nome parecido nunca preenche fornecedor automaticamente.
    if (candidates.length === 0) {
      const normalized = normalizeText(name);
      const firstWord = normalized.split(' ')[0];

      if (firstWord && firstWord.length >= 4) {
        const similar = await this.prisma.supplier.findMany({
          where: {
            ...scope,
            OR: [
              { legalName: { contains: firstWord, mode: 'insensitive' } },
              { tradeName: { contains: firstWord, mode: 'insensitive' } },
            ],
          },
          select: SUPPLIER_SELECT,
          take: 5,
        });

        for (const supplier of similar) {
          const score = similarity(normalized, normalizeText(supplier.legalName ?? supplier.tradeName ?? ''));
          candidates.push({
            entity: supplier,
            confidence: Math.round(CONFIDENCE.TEXT_SIMILARITY * score * 100) / 100,
            matchedBy: 'TEXT_SIMILARITY',
            matchedValue: name,
          });
        }
      }
    }

    return candidates;
  }

  // ── Cliente (seção 30) ────────────────────────────────────────────────────

  /** Identifica o cliente, para documentos de receita. Mesma lógica de prioridade. */
  async identifyCustomer(
    organizationId: string,
    input: IdentificationInput,
  ): Promise<IdentificationResult<IdentifiedCustomer>> {
    const scope: Prisma.CustomerWhereInput = { organizationId, deletedAt: null };
    const candidates: IdentificationCandidate<IdentifiedCustomer>[] = [];

    // Em documento de receita, quem paga é o cliente: o destinatário.
    const document = onlyDigits(input.recipientDocument) ?? onlyDigits(input.issuerDocument);
    if (document) {
      const customer = await this.prisma.customer.findFirst({
        where: { ...scope, normalizedDocumentNumber: document },
        select: CUSTOMER_SELECT,
      });
      if (customer) {
        return resolve([
          {
            entity: customer,
            confidence: CONFIDENCE.EXACT_DOCUMENT,
            matchedBy: 'DOCUMENT',
            matchedValue: document,
          },
        ]);
      }
    }

    const identifierValue = input.pixKey
      ? normalizeIdentifier(input.pixKey)
      : input.bankAccount?.account
        ? normalizeIdentifier(input.bankAccount.account)
        : null;

    if (identifierValue) {
      const found = await this.prisma.customerBankIdentifier.findFirst({
        where: { normalizedValue: identifierValue, status: RecordStatus.ACTIVE, customer: scope },
        include: { customer: { select: CUSTOMER_SELECT } },
        orderBy: [{ confirmedCount: 'desc' }, { priority: 'asc' }],
      });
      if (found) {
        candidates.push({
          entity: found.customer,
          confidence: CONFIDENCE.CONFIRMED_IDENTIFIER,
          matchedBy: 'BANK_IDENTIFIER',
          matchedValue: identifierValue,
        });
      }
    }

    const name = (input.recipientName ?? input.issuerName)?.trim();
    if (candidates.length === 0 && name) {
      const [byLegalName, byTradeName] = await Promise.all([
        this.prisma.customer.findMany({
          where: { ...scope, legalName: { equals: name, mode: 'insensitive' } },
          select: CUSTOMER_SELECT,
          take: 5,
        }),
        this.prisma.customer.findMany({
          where: { ...scope, tradeName: { equals: name, mode: 'insensitive' } },
          select: CUSTOMER_SELECT,
          take: 5,
        }),
      ]);

      for (const customer of byLegalName) {
        candidates.push({
          entity: customer,
          confidence: CONFIDENCE.LEGAL_NAME,
          matchedBy: 'LEGAL_NAME',
          matchedValue: name,
        });
      }
      for (const customer of byTradeName) {
        candidates.push({
          entity: customer,
          confidence: CONFIDENCE.TRADE_NAME,
          matchedBy: 'TRADE_NAME',
          matchedValue: name,
        });
      }
    }

    return resolve(candidates);
  }

  /**
   * Registra que um texto do documento identifica um fornecedor (aprendizado da seção 16).
   *
   * Chamado quando o usuário confirma o fornecedor na revisão. O contador de confirmações
   * é o que faz o reconhecimento melhorar com o uso, sem nenhuma decisão automática.
   */
  async learnSupplierRecognition(params: {
    organizationId: string;
    companyId: string | null;
    supplierId: string;
    text: string;
    userId: string | null;
    confirmed: boolean;
  }): Promise<void> {
    const normalizedText = normalizeText(params.text).slice(0, 200);
    if (normalizedText.length < 4) return;

    const existing = await this.prisma.supplierRecognitionLearning.findFirst({
      where: {
        organizationId: params.organizationId,
        supplierId: params.supplierId,
        normalizedText,
      },
    });

    if (existing) {
      await this.prisma.supplierRecognitionLearning.update({
        where: { id: existing.id },
        data: params.confirmed
          ? {
              confirmedCount: { increment: 1 },
              lastConfirmedBy: params.userId,
              lastConfirmedAt: new Date(),
            }
          : { rejectedCount: { increment: 1 } },
      });
      return;
    }

    if (!params.confirmed) return;

    await this.prisma.supplierRecognitionLearning.create({
      data: {
        organizationId: params.organizationId,
        companyId: params.companyId,
        supplierId: params.supplierId,
        originalText: params.text.slice(0, 200),
        normalizedText,
        sourceType: 'DOCUMENT_INTAKE',
        confirmedCount: 1,
        lastConfirmedBy: params.userId,
        lastConfirmedAt: new Date(),
      },
    });
  }
}

// ── Auxiliares ──────────────────────────────────────────────────────────────

/**
 * Escolhe o vencedor entre os candidatos.
 *
 * Só declara identificação quando há um vencedor **destacado**: se o segundo colocado
 * está a menos de 5 pontos, é empate técnico e a escolha volta para o usuário. Escolher
 * um dos dois em silêncio vincularia o documento ao fornecedor errado sem ninguém notar.
 */
function resolve<T>(
  candidates: IdentificationCandidate<T>[],
): IdentificationResult<T> {
  if (candidates.length === 0) {
    return { identified: null, candidates: [], ambiguous: false };
  }

  const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence);
  const [best, second] = sorted;

  const ambiguous =
    second !== undefined &&
    best.confidence - second.confidence < 5 &&
    !sameEntity(best.entity, second.entity);

  return {
    identified: ambiguous ? null : best,
    candidates: sorted,
    ambiguous,
  };
}

function sameEntity(a: unknown, b: unknown): boolean {
  const idA = (a as { id?: string })?.id;
  const idB = (b as { id?: string })?.id;
  return idA !== undefined && idA === idB;
}

function onlyDigits(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  return digits.length > 0 ? digits : null;
}

/** Remove acentos, pontuação e caixa — para comparar "COELBA" com "Coelba." */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\w\s@.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Chave PIX e conta bancária: e-mail em minúsculas, o resto só dígitos. */
function normalizeIdentifier(value: string): string {
  const trimmed = value.trim();
  if (trimmed.includes('@')) return trimmed.toLowerCase();
  const digits = trimmed.replace(/\D/g, '');
  return digits.length > 0 ? digits : trimmed.toLowerCase();
}

/** CNPJs e CPFs formatados encontrados no texto, sem repetição. */
export function extractDocumentsFromText(text: string): string[] {
  const found = new Set<string>();

  for (const match of text.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g) ?? []) {
    found.add(match.replace(/\D/g, ''));
  }
  for (const match of text.match(/(?<!\d)\d{3}\.\d{3}\.\d{3}-\d{2}(?!\d)/g) ?? []) {
    found.add(match.replace(/\D/g, ''));
  }

  return [...found];
}

/**
 * Semelhança entre dois nomes, pela proporção de palavras em comum.
 *
 * Bem mais previsível que distância de edição para nomes de empresa: "Neoenergia Coelba
 * S.A." e "Coelba" compartilham uma palavra de duas, então 0,5 — o que mantém o resultado
 * na faixa de baixa confiança, exigindo revisão.
 */
export function similarity(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;
  if (a === b) return 1;

  const wordsA = new Set(a.split(' ').filter((word) => word.length > 2));
  const wordsB = new Set(b.split(' ').filter((word) => word.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let shared = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) shared += 1;
  }

  return shared / Math.max(wordsA.size, wordsB.size);
}
