import type { SupplierFormSchema } from "@/lib/validation/supplier";
import type { Supplier, SupplierCompanyLink } from "@/types/supplier";

const DEFAULT_FORM_VALUES: SupplierFormSchema = {
  organizationId: "",
  companyId: "",
  personType: "LEGAL_ENTITY",
  documentNumber: "",
  legalName: "",
  displayName: "",
  supplierTypes: [],
  cnaes: [],
  addresses: [],
  contacts: [],
  bankAccounts: [],
  pixKeys: [],
  categoryRequired: false,
  costCenterRequired: false,
  hasContract: false,
  requiresMatchingBeneficiary: true,
  allowsThirdPartyPayment: false,
  taxWithholdings: [],
  allocationEnabled: false,
  allocations: [],
  autoIdentificationEnabled: true,
  autoClassificationEnabled: true,
  autoCostCenterEnabled: true,
  autoAllocationEnabled: true,
  reconciliationSuggestionEnabled: true,
  autoEntryCreationEnabled: false,
  autoReconciliationEnabled: false,
  confirmationThreshold: 95,
  contracts: [],
};

export function defaultSupplierFormValues(organizationId?: string, companyId?: string): SupplierFormSchema {
  return { ...DEFAULT_FORM_VALUES, organizationId: organizationId ?? "", companyId: companyId ?? "" };
}

function toDateInputValue(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value.slice(0, 10);
}

/** Converte um fornecedor + o vínculo com a empresa selecionada para os valores do formulário. */
export function supplierToFormValues(
  supplier: Supplier,
  link: SupplierCompanyLink | undefined,
  organizationId: string,
): SupplierFormSchema {
  return {
    organizationId,
    companyId: link?.companyId ?? "",
    personType: supplier.personType,
    documentNumber: supplier.documentNumber ?? "",
    foreignTaxId: supplier.foreignTaxId ?? undefined,
    foreignCountry: supplier.foreignCountry ?? undefined,
    foreignCurrency: supplier.foreignCurrency ?? undefined,
    internalCode: link?.internalCode ?? undefined,
    legalName: supplier.legalName ?? "",
    tradeName: supplier.tradeName ?? undefined,
    displayName: supplier.displayName ?? "",
    supplierTypes: link?.supplierTypes ?? [],
    generalNotes: supplier.generalNotes ?? undefined,

    stateRegistration: supplier.stateRegistration ?? undefined,
    municipalRegistration: supplier.municipalRegistration ?? undefined,
    openingDate: toDateInputValue(supplier.openingDate),
    legalNature: supplier.legalNature ?? undefined,
    companySize: supplier.companySize ?? undefined,
    shareCapital: supplier.shareCapital ? Number(supplier.shareCapital) : undefined,
    segment: supplier.segment ?? undefined,
    cnaes: supplier.cnaes.map((c) => ({ id: c.id, cnaeCode: c.cnaeCode, description: c.description ?? undefined, isMain: c.isMain })),

    addresses: supplier.addresses.map((a) => ({
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
    phone: supplier.phone ?? undefined,
    whatsapp: supplier.whatsapp ?? undefined,
    email: supplier.email ?? undefined,
    emailFinancial: supplier.emailFinancial ?? undefined,
    emailPaymentReceipts: supplier.emailPaymentReceipts ?? undefined,
    website: supplier.website ?? undefined,
    contacts: supplier.contacts.map((c) => ({
      id: c.id,
      name: c.name,
      position: c.position ?? undefined,
      department: c.department ?? undefined,
      phone: c.phone ?? undefined,
      whatsapp: c.whatsapp ?? undefined,
      email: c.email ?? undefined,
      isPrimary: c.isPrimary,
      isFinancialContact: c.isFinancialContact,
      isCommercialContact: c.isCommercialContact,
      isInvoiceResponsible: c.isInvoiceResponsible,
      isBillingResponsible: c.isBillingResponsible,
      receivesPaymentReceipts: c.receivesPaymentReceipts,
    })),

    bankAccounts: supplier.bankAccounts.map((b) => ({
      id: b.id,
      financialInstitutionId: b.financialInstitutionId ?? undefined,
      branchNumber: b.branchNumber,
      branchDigit: b.branchDigit ?? undefined,
      accountNumber: b.accountNumber,
      accountDigit: b.accountDigit ?? undefined,
      accountType: b.accountType,
      holderName: b.holderName,
      holderDocument: b.holderDocument,
      isPrimary: b.isPrimary,
      isThirdParty: b.isThirdParty,
      thirdPartyReason: b.thirdPartyReason ?? undefined,
    })),
    pixKeys: supplier.pixKeys.map((p) => ({
      id: p.id,
      pixType: p.pixType,
      pixKey: p.pixKey,
      holderName: p.holderName,
      holderDocument: p.holderDocument,
      bankAccountId: p.bankAccountId ?? undefined,
      isPrimary: p.isPrimary,
      isThirdParty: p.isThirdParty,
      thirdPartyReason: p.thirdPartyReason ?? undefined,
    })),

    defaultCategoryId: link?.defaultCategoryId ?? undefined,
    defaultSubcategoryId: link?.defaultSubcategoryId ?? undefined,
    defaultCostCenterId: link?.defaultCostCenterId ?? undefined,
    defaultAccountingAccount: link?.defaultAccountingAccount ?? undefined,
    defaultDescription: link?.defaultDescription ?? undefined,
    defaultHistory: link?.defaultHistory ?? undefined,
    financialNature: link?.financialNature ?? undefined,
    categoryRequired: link?.categoryRequired ?? false,
    costCenterRequired: link?.costCenterRequired ?? false,

    preferredPaymentMethod: link?.preferredPaymentMethod ?? undefined,
    paymentTermDays: link?.paymentTermDays ?? undefined,
    paymentTermFixedDueDay: link?.paymentTermFixedDueDay ?? undefined,
    paymentTermPeriodicity: link?.paymentTermPeriodicity ?? undefined,
    minimumAmount: link?.minimumAmount ?? undefined,
    maximumAmountWithoutApproval: link?.maximumAmountWithoutApproval ?? undefined,
    hasContract: link?.hasContract ?? false,
    requiresMatchingBeneficiary: link?.requiresMatchingBeneficiary ?? true,
    allowsThirdPartyPayment: link?.allowsThirdPartyPayment ?? false,

    taxWithholdingPolicy: link?.taxWithholdingPolicy ?? undefined,
    taxWithholdings: (link?.taxWithholdings ?? []).map((w) => ({
      id: w.id,
      taxType: w.taxType,
      rate: w.rate ?? undefined,
      minimumAmount: w.minimumAmount ?? undefined,
      calculationBase: w.calculationBase ?? undefined,
      serviceCode: w.serviceCode ?? undefined,
      cityCode: w.cityCode ?? undefined,
      revenueCode: w.revenueCode ?? undefined,
      automatic: w.automatic,
      requiresConfirmation: w.requiresConfirmation,
      notes: w.notes ?? undefined,
    })),
    allocationEnabled: link?.allocationEnabled ?? false,
    allocations: (link?.allocations ?? []).map((a) => ({
      id: a.id,
      categoryId: a.categoryId ?? undefined,
      costCenterId: a.costCenterId ?? undefined,
      allocationType: a.allocationType,
      percentage: a.percentage ?? undefined,
      fixedAmount: a.fixedAmount ?? undefined,
      priority: a.priority,
    })),

    autoIdentificationEnabled: link?.autoIdentificationEnabled ?? true,
    autoClassificationEnabled: link?.autoClassificationEnabled ?? true,
    autoCostCenterEnabled: link?.autoCostCenterEnabled ?? true,
    autoAllocationEnabled: link?.autoAllocationEnabled ?? true,
    reconciliationSuggestionEnabled: link?.reconciliationSuggestionEnabled ?? true,
    autoEntryCreationEnabled: link?.autoEntryCreationEnabled ?? false,
    autoReconciliationEnabled: link?.autoReconciliationEnabled ?? false,
    confirmationThreshold: link?.confirmationThreshold ?? 95,

    contracts: (link?.contracts ?? []).map((c) => ({
      id: c.id,
      contractNumber: c.contractNumber ?? undefined,
      description: c.description ?? undefined,
      object: c.object ?? undefined,
      contractValue: c.contractValue ?? undefined,
      startDate: toDateInputValue(c.startDate),
      endDate: toDateInputValue(c.endDate),
      automaticRenewal: c.automaticRenewal,
      billingFrequency: c.billingFrequency ?? undefined,
      adjustmentIndex: c.adjustmentIndex ?? undefined,
      notes: c.notes ?? undefined,
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
  "supplierTypes",
  "defaultCategoryId",
  "defaultSubcategoryId",
  "defaultCostCenterId",
  "defaultAccountingAccount",
  "defaultDescription",
  "defaultHistory",
  "financialNature",
  "categoryRequired",
  "costCenterRequired",
  "preferredPaymentMethod",
  "paymentTermDays",
  "paymentTermFixedDueDay",
  "paymentTermPeriodicity",
  "minimumAmount",
  "maximumAmountWithoutApproval",
  "hasContract",
  "requiresMatchingBeneficiary",
  "allowsThirdPartyPayment",
  "taxWithholdingPolicy",
  "allocationEnabled",
  "autoIdentificationEnabled",
  "autoClassificationEnabled",
  "autoCostCenterEnabled",
  "autoAllocationEnabled",
  "reconciliationSuggestionEnabled",
  "autoEntryCreationEnabled",
  "autoReconciliationEnabled",
  "confirmationThreshold",
  "internalNotes",
] as const;

/**
 * Separa os valores do formulário em: (1) payload do cadastro global do fornecedor,
 * já incluindo o vínculo inicial com a empresa selecionada (`companyLink`); e (2) as
 * listas de rateios/retenções/contratos, que são enviadas em chamadas separadas depois
 * que o vínculo é criado (essas rotas exigem um `supplierCompanyLinkId` existente).
 */
export function buildSupplierSubmissionPayload(values: SupplierFormSchema & { id?: string }) {
  const {
    companyId,
    allocations,
    taxWithholdings,
    contracts,
    id,
    preferredBankAccountIndex,
    preferredPixKeyIndex,
    ...rest
  } = values;

  const linkFields: Record<string, unknown> = {};
  const globalFields: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(rest)) {
    if ((LINK_FIELD_KEYS as readonly string[]).includes(key)) {
      linkFields[key] = value;
    } else {
      globalFields[key] = value;
    }
  }

  const companyLink: Record<string, unknown> = { companyId, ...sanitize(linkFields) };

  const supplierPayload: Record<string, unknown> = { ...sanitize(globalFields), id, companyLink };

  return {
    supplierPayload,
    allocations: allocations ?? [],
    taxWithholdings: taxWithholdings ?? [],
    contracts: contracts ?? [],
    preferredBankAccountIndex,
    preferredPixKeyIndex,
  };
}
