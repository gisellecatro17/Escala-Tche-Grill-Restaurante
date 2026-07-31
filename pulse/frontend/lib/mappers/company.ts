import type { CompanyFormSchema } from "@/lib/validation/company";
import type { Company } from "@/types/company";

const DEFAULT_FORM_VALUES: CompanyFormSchema = {
  organizationId: "",
  personType: "LEGAL_ENTITY",
  documentNumber: "",
  legalName: "",
  displayName: "",
  establishmentType: "HEADQUARTERS",
  cnaes: [],
  addresses: [],
  contacts: [],
  currencyCode: "BRL",
  dateFormat: "DD/MM/YYYY",
  timezone: "America/Bahia",
  financialMethod: "ACCRUAL",
  financialMonthStartDay: 1,
  monthClosingDay: 31,
  allowRetroactiveEntries: true,
  allowFutureEntries: true,
  requiresCategory: true,
  requiresCostCenter: false,
  requiresSupplier: false,
  requiresCustomer: false,
  requiresAttachment: false,
  requiresApproval: false,
  approvalLevels: 1,
  automaticCodeEnabled: true,
};

export function defaultCompanyFormValues(organizationId?: string): CompanyFormSchema {
  return { ...DEFAULT_FORM_VALUES, organizationId: organizationId ?? "" };
}

function toDateInputValue(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value.slice(0, 10);
}

/** Converte uma empresa vinda da API para os valores do formulário (retomar rascunho / editar). */
export function companyToFormValues(company: Company): CompanyFormSchema {
  return {
    organizationId: company.organizationId,
    parentCompanyId: company.parentCompanyId ?? undefined,
    internalCode: company.internalCode ?? undefined,
    personType: company.personType,
    documentNumber: company.documentNumber ?? "",
    legalName: company.legalName ?? "",
    tradeName: company.tradeName ?? undefined,
    displayName: company.displayName ?? "",
    establishmentType: company.establishmentType,
    implementationStartDate: toDateInputValue(company.implementationStartDate),
    registrationNotes: company.registrationNotes ?? undefined,

    openingDate: toDateInputValue(company.openingDate),
    legalNature: company.legalNature ?? undefined,
    companySize: company.companySize ?? undefined,
    shareCapital: company.shareCapital ? Number(company.shareCapital) : undefined,
    stateRegistration: company.stateRegistration ?? undefined,
    municipalRegistration: company.municipalRegistration ?? undefined,
    cnaes: company.cnaes.map((c) => ({ id: c.id, cnaeCode: c.cnaeCode, description: c.description ?? undefined, isMain: c.isMain })),

    addresses: company.addresses.map((a) => ({
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

    phone: company.phone ?? undefined,
    phoneSecondary: company.phoneSecondary ?? undefined,
    whatsapp: company.whatsapp ?? undefined,
    email: company.email ?? undefined,
    emailFinancial: company.emailFinancial ?? undefined,
    emailFiscal: company.emailFiscal ?? undefined,
    website: company.website ?? undefined,
    contacts: company.contacts.map((c) => ({
      id: c.id,
      contactType: c.contactType,
      name: c.name,
      position: c.position ?? undefined,
      department: c.department ?? undefined,
      phone: c.phone ?? undefined,
      whatsapp: c.whatsapp ?? undefined,
      email: c.email ?? undefined,
      isPrimary: c.isPrimary,
    })),

    taxRegime: company.taxRegime ?? undefined,
    taxAssessmentMethod: company.taxAssessmentMethod ?? undefined,
    icmsTaxpayer: company.icmsTaxpayer ?? undefined,
    simplesNacionalOptant: company.simplesNacionalOptant ?? undefined,
    simplesNacionalOptionDate: toDateInputValue(company.simplesNacionalOptionDate),
    simplesNacionalExclusionDate: toDateInputValue(company.simplesNacionalExclusionDate),
    specialTaxRegime: company.specialTaxRegime ?? undefined,
    accountingFirmName: company.accountingFirmName ?? undefined,
    accountingResponsibleName: company.accountingResponsibleName ?? undefined,
    taxNotes: company.taxNotes ?? undefined,

    currencyCode: company.currencyCode,
    dateFormat: company.dateFormat,
    timezone: company.timezone,
    financialMethod: company.financialMethod,
    financialMonthStartDay: company.financialMonthStartDay,
    monthClosingDay: company.monthClosingDay,
    allowRetroactiveEntries: company.allowRetroactiveEntries,
    allowFutureEntries: company.allowFutureEntries,
    requiresCategory: company.requiresCategory,
    requiresCostCenter: company.requiresCostCenter,
    requiresSupplier: company.requiresSupplier,
    requiresCustomer: company.requiresCustomer,
    requiresAttachment: company.requiresAttachment,
    requiresApproval: company.requiresApproval,
    approvalLevels: company.approvalLevels,
    automaticCodeEnabled: company.automaticCodeEnabled,
  };
}

/** Remove campos vazios/undefined antes de enviar à API (evita sobrescrever com "" sem intenção). */
export function sanitizeCompanyPayload<T extends Record<string, unknown>>(values: T): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(values)) {
    if (value === "" || value === undefined) continue;
    payload[key] = value;
  }

  return payload;
}
