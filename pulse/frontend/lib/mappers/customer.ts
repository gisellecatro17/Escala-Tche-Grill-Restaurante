import type { CustomerFormSchema } from "@/lib/validation/customer";
import type { Customer, CustomerCompanyLink } from "@/types/customer";

const DEFAULT_FORM_VALUES: CustomerFormSchema = {
  organizationId: "",
  companyId: "",
  personType: "LEGAL_ENTITY",
  documentNumber: "",
  legalName: "",
  displayName: "",
  customerTypes: [],
  cnaes: [],
  addresses: [],
  contacts: [],
  abcClassification: "NOT_CLASSIFIED",
  defaultLateFeePercentage: 2,
  defaultMonthlyInterestPercentage: 1,
  gracePeriodDays: 0,
  riskLevel: "NOT_ASSESSED",
  allowOverCreditLimit: false,
  requiresOverLimitApproval: true,
  automaticBlockEnabled: false,
  autoIdentificationEnabled: true,
  autoRevenueClassificationEnabled: true,
  autoResultCenterEnabled: true,
  receivableSuggestionEnabled: true,
  autoReceivableCreationEnabled: false,
  autoReceiptMatchingEnabled: false,
  confirmationThreshold: 95,
  billingRulesEnabled: false,
  contracts: [],
  recurringReceivables: [],
};

export function defaultCustomerFormValues(organizationId?: string, companyId?: string): CustomerFormSchema {
  return { ...DEFAULT_FORM_VALUES, organizationId: organizationId ?? "", companyId: companyId ?? "" };
}

function toDateInputValue(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value.slice(0, 10);
}

/** Converte um cliente + o vínculo com a empresa selecionada para os valores do formulário. */
export function customerToFormValues(
  customer: Customer,
  link: CustomerCompanyLink | undefined,
  organizationId: string,
): CustomerFormSchema {
  return {
    organizationId,
    companyId: link?.companyId ?? "",
    personType: customer.personType,
    documentNumber: customer.documentNumber ?? "",
    foreignDocument: customer.foreignDocument ?? undefined,
    billingCurrency: customer.billingCurrency ?? undefined,
    preferredLanguage: customer.preferredLanguage ?? undefined,
    internalCode: link?.internalCode ?? undefined,
    legalName: customer.legalName ?? "",
    tradeName: customer.tradeName ?? undefined,
    displayName: customer.displayName ?? "",
    customerTypes: link?.customerTypes ?? [],
    source: link?.source ?? undefined,
    generalNotes: customer.generalNotes ?? undefined,

    stateRegistration: customer.stateRegistration ?? undefined,
    municipalRegistration: customer.municipalRegistration ?? undefined,
    openingDate: toDateInputValue(customer.openingDate),
    birthDate: toDateInputValue(customer.birthDate),
    legalNature: customer.legalNature ?? undefined,
    companySize: customer.companySize ?? undefined,
    shareCapital: customer.shareCapital ? Number(customer.shareCapital) : undefined,
    segment: customer.segment ?? undefined,
    cnaes: customer.cnaes.map((c) => ({ id: c.id, cnaeCode: c.cnaeCode, description: c.description ?? undefined, isMain: c.isMain })),

    addresses: customer.addresses.map((a) => ({
      id: a.id,
      addressType: a.addressType,
      postalCode: a.postalCode,
      street: a.street,
      number: a.number ?? undefined,
      complement: a.complement ?? undefined,
      district: a.district ?? undefined,
      city: a.city,
      state: a.state,
      country: a.country,
      cityCode: a.cityCode ?? undefined,
      reference: a.reference ?? undefined,
      isPrimary: a.isPrimary,
    })),
    phone: customer.phone ?? undefined,
    whatsapp: customer.whatsapp ?? undefined,
    email: customer.email ?? undefined,
    emailFinancial: customer.emailFinancial ?? undefined,
    emailBilling: customer.emailBilling ?? undefined,
    emailFiscal: customer.emailFiscal ?? undefined,
    website: customer.website ?? undefined,
    contacts: customer.contacts.map((c) => ({
      id: c.id,
      name: c.name,
      position: c.position ?? undefined,
      department: c.department ?? undefined,
      phone: c.phone ?? undefined,
      whatsapp: c.whatsapp ?? undefined,
      email: c.email ?? undefined,
      isPrimary: c.isPrimary,
      isFinancialContact: c.isFinancialContact,
      isBillingContact: c.isBillingContact,
      isContractContact: c.isContractContact,
      isTaxContact: c.isTaxContact,
      isOperationalContact: c.isOperationalContact,
      receivesInvoices: c.receivesInvoices,
      receivesBilling: c.receivesBilling,
      receivesTaxDocuments: c.receivesTaxDocuments,
      receivesContracts: c.receivesContracts,
      receivesReports: c.receivesReports,
    })),

    defaultRevenueCategoryId: link?.defaultRevenueCategoryId ?? undefined,
    defaultSubcategoryId: link?.defaultSubcategoryId ?? undefined,
    defaultResultCenterId: link?.defaultResultCenterId ?? undefined,
    defaultAccountingAccount: link?.defaultAccountingAccount ?? undefined,
    defaultProductService: link?.defaultProductService ?? undefined,
    abcClassification: link?.abcClassification ?? "NOT_CLASSIFIED",
    revenuePotentialLevel: link?.revenuePotentialLevel ?? undefined,
    estimatedMonthlyRevenue: link?.estimatedMonthlyRevenue ?? undefined,
    estimatedAnnualRevenue: link?.estimatedAnnualRevenue ?? undefined,
    estimatedAverageTicket: link?.estimatedAverageTicket ?? undefined,
    estimatedMarginPercentage: link?.estimatedMarginPercentage ?? undefined,

    paymentTermDays: link?.paymentTermDays ?? undefined,
    defaultDueDay: link?.defaultDueDay ?? undefined,
    billingFrequency: link?.billingFrequency ?? undefined,
    preferredPaymentMethod: link?.preferredPaymentMethod ?? undefined,
    defaultLateFeePercentage: link?.defaultLateFeePercentage ?? 2,
    defaultMonthlyInterestPercentage: link?.defaultMonthlyInterestPercentage ?? 1,
    defaultDiscountPercentage: link?.defaultDiscountPercentage ?? undefined,
    earlyPaymentDiscountPercentage: link?.earlyPaymentDiscountPercentage ?? undefined,
    earlyPaymentDays: link?.earlyPaymentDays ?? undefined,
    gracePeriodDays: link?.gracePeriodDays ?? 0,

    creditLimit: link?.creditLimit ?? undefined,
    riskLevel: link?.riskLevel ?? "NOT_ASSESSED",
    allowOverCreditLimit: link?.allowOverCreditLimit ?? false,
    requiresOverLimitApproval: link?.requiresOverLimitApproval ?? true,
    automaticBlockEnabled: link?.automaticBlockEnabled ?? false,
    automaticBlockDays: link?.automaticBlockDays ?? undefined,

    autoIdentificationEnabled: link?.autoIdentificationEnabled ?? true,
    autoRevenueClassificationEnabled: link?.autoRevenueClassificationEnabled ?? true,
    autoResultCenterEnabled: link?.autoResultCenterEnabled ?? true,
    receivableSuggestionEnabled: link?.receivableSuggestionEnabled ?? true,
    autoReceivableCreationEnabled: link?.autoReceivableCreationEnabled ?? false,
    autoReceiptMatchingEnabled: link?.autoReceiptMatchingEnabled ?? false,
    confirmationThreshold: link?.confirmationThreshold ?? 95,
    billingRulesEnabled: false,

    contracts: (link?.contracts ?? []).map((c) => ({
      id: c.id,
      contractNumber: c.contractNumber ?? undefined,
      description: c.description ?? undefined,
      object: c.object ?? undefined,
      productService: c.productService ?? undefined,
      planName: c.planName ?? undefined,
      initialValue: c.initialValue ?? undefined,
      currentValue: c.currentValue ?? undefined,
      startDate: toDateInputValue(c.startDate),
      endDate: toDateInputValue(c.endDate),
      isIndefiniteTerm: c.isIndefiniteTerm,
      automaticRenewal: c.automaticRenewal,
      billingFrequency: c.billingFrequency ?? undefined,
      dueDay: c.dueDay ?? undefined,
      notes: c.notes ?? undefined,
    })),
    recurringReceivables: (link?.recurringReceivables ?? []).map((r) => ({
      id: r.id,
      description: r.description ?? undefined,
      amount: r.amount,
      frequency: r.frequency,
      startDate: toDateInputValue(r.startDate) ?? r.startDate,
      endDate: toDateInputValue(r.endDate),
      fixedDueDay: r.fixedDueDay ?? undefined,
    })),
    internalNotes: link?.internalNotes ?? undefined,
  };
}

function sanitize<T extends Record<string, unknown>>(values: T): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === "" || value === undefined) continue;
    payload[key] = value;
  }
  return payload;
}

const LINK_FIELD_KEYS = [
  "internalCode",
  "customerTypes",
  "source",
  "defaultRevenueCategoryId",
  "defaultSubcategoryId",
  "defaultResultCenterId",
  "defaultAccountingAccount",
  "defaultProductService",
  "defaultDescription",
  "defaultHistory",
  "abcClassification",
  "revenuePotentialLevel",
  "estimatedMonthlyRevenue",
  "estimatedAnnualRevenue",
  "estimatedAverageTicket",
  "estimatedMarginPercentage",
  "paymentTermDays",
  "defaultDueDay",
  "billingFrequency",
  "preferredPaymentMethod",
  "defaultLateFeePercentage",
  "defaultMonthlyInterestPercentage",
  "defaultDiscountPercentage",
  "earlyPaymentDiscountPercentage",
  "earlyPaymentDays",
  "gracePeriodDays",
  "autoIdentificationEnabled",
  "autoRevenueClassificationEnabled",
  "autoResultCenterEnabled",
  "receivableSuggestionEnabled",
  "autoReceivableCreationEnabled",
  "autoReceiptMatchingEnabled",
  "confirmationThreshold",
  "billingRulesEnabled",
  "internalNotes",
] as const;

const CREDIT_FIELD_KEYS = [
  "creditLimit",
  "riskLevel",
  "allowOverCreditLimit",
  "requiresOverLimitApproval",
  "automaticBlockEnabled",
  "automaticBlockDays",
] as const;

/**
 * Separa os valores do formulário em: (1) payload do cadastro geral do cliente, já
 * incluindo o vínculo/prospect inicial com a empresa selecionada (`companyLink`); (2) os
 * campos de crédito, enviados separadamente via `PATCH /customer-company-links/:id/credit`
 * (permissão dedicada); e (3) as listas de contratos/recorrências, enviadas em chamadas
 * separadas depois que o vínculo é criado.
 */
export function buildCustomerSubmissionPayload(values: CustomerFormSchema & { id?: string }) {
  const { companyId, contracts, recurringReceivables, id, ...rest } = values;

  const linkFields: Record<string, unknown> = {};
  const creditFields: Record<string, unknown> = {};
  const globalFields: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(rest)) {
    if ((CREDIT_FIELD_KEYS as readonly string[]).includes(key)) {
      creditFields[key] = value;
    } else if ((LINK_FIELD_KEYS as readonly string[]).includes(key)) {
      linkFields[key] = value;
    } else {
      globalFields[key] = value;
    }
  }

  const companyLink: Record<string, unknown> = { companyId, ...sanitize(linkFields) };
  const customerPayload: Record<string, unknown> = { ...sanitize(globalFields), id, companyLink };

  return {
    customerPayload,
    creditPayload: sanitize(creditFields),
    contracts: contracts ?? [],
    recurringReceivables: recurringReceivables ?? [],
  };
}
