import { cnpj, cpf } from "cpf-cnpj-validator";
import { isValidPhoneNumber } from "libphonenumber-js";
import { z } from "zod";

const optionalPhone = z
  .string()
  .optional()
  .refine((value) => !value || isValidPhoneNumber(value, "BR"), { message: "Informe um telefone válido." });

const optionalEmail = z
  .string()
  .optional()
  .refine((value) => !value || z.email().safeParse(value).success, { message: "Informe um e-mail válido." });

const addressSchema = z.object({
  id: z.string().optional(),
  addressType: z.enum(["FISCAL", "BILLING", "DELIVERY", "OPERATIONAL", "CORRESPONDENCE"]),
  postalCode: z.string().min(9, "Informe um CEP válido."),
  street: z.string().min(1, "Informe o logradouro."),
  number: z.string().optional(),
  complement: z.string().optional(),
  district: z.string().optional(),
  city: z.string().min(1, "Informe o município."),
  state: z.string().length(2, "Informe a UF (2 letras)."),
  country: z.string().optional(),
  cityCode: z.string().optional(),
  reference: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

const contactSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Informe o nome do contato."),
  position: z.string().optional(),
  department: z.string().optional(),
  phone: optionalPhone,
  whatsapp: optionalPhone,
  email: optionalEmail,
  isPrimary: z.boolean().optional(),
  isFinancialContact: z.boolean().optional(),
  isBillingContact: z.boolean().optional(),
  isContractContact: z.boolean().optional(),
  isTaxContact: z.boolean().optional(),
  isOperationalContact: z.boolean().optional(),
  receivesInvoices: z.boolean().optional(),
  receivesBilling: z.boolean().optional(),
  receivesTaxDocuments: z.boolean().optional(),
  receivesContracts: z.boolean().optional(),
  receivesReports: z.boolean().optional(),
});

const cnaeSchema = z.object({
  id: z.string().optional(),
  cnaeCode: z.string().min(1, "Informe o código do CNAE."),
  description: z.string().optional(),
  isMain: z.boolean().optional(),
});

const contractSchema = z
  .object({
    id: z.string().optional(),
    contractNumber: z.string().optional(),
    description: z.string().optional(),
    object: z.string().optional(),
    productService: z.string().optional(),
    planName: z.string().optional(),
    initialValue: z.number().min(0).optional(),
    currentValue: z.number().min(0).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    isIndefiniteTerm: z.boolean().optional(),
    automaticRenewal: z.boolean().optional(),
    billingFrequency: z
      .enum(["ONCE", "WEEKLY", "BIWEEKLY", "MONTHLY", "BIMONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "CUSTOM"])
      .optional(),
    dueDay: z.number().min(1).max(31).optional(),
    notes: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (!values.isIndefiniteTerm && values.startDate && values.endDate && values.endDate <= values.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "A data final do contrato deve ser posterior à data inicial.",
      });
    }
  });

const recurringReceivableSchema = z.object({
  id: z.string().optional(),
  description: z.string().optional(),
  amount: z.number().min(0.01, "Informe o valor da recorrência."),
  frequency: z.enum(["ONCE", "WEEKLY", "BIWEEKLY", "MONTHLY", "BIMONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "CUSTOM"]),
  startDate: z.string().min(1, "Informe a data inicial."),
  endDate: z.string().optional(),
  fixedDueDay: z.number().min(1).max(31).optional(),
});

export const customerFormSchema = z
  .object({
    organizationId: z.string().min(1, "Selecione a organização."),
    companyId: z.string().min(1, "Selecione a empresa vinculada."),

    personType: z.enum(["INDIVIDUAL", "LEGAL_ENTITY", "FOREIGN"]),
    documentNumber: z.string().optional(),
    foreignDocument: z.string().optional(),
    billingCurrency: z.string().optional(),
    preferredLanguage: z.string().optional(),

    internalCode: z.string().optional(),
    legalName: z.string().min(2, "Informe a razão social ou o nome completo."),
    tradeName: z.string().optional(),
    displayName: z.string().min(2, "Informe o nome de exibição."),
    customerTypes: z.array(z.string()).default([]),
    source: z
      .enum([
        "REFERRAL",
        "ACTIVE_PROSPECTING",
        "WEBSITE",
        "SOCIAL_MEDIA",
        "EVENT",
        "PARTNER",
        "CAMPAIGN",
        "OLD_CUSTOMER",
        "SYSTEM_MIGRATION",
        "OTHER",
      ])
      .optional(),
    generalNotes: z.string().optional(),

    stateRegistration: z.string().optional(),
    municipalRegistration: z.string().optional(),
    openingDate: z.string().optional(),
    birthDate: z.string().optional(),
    legalNature: z.string().optional(),
    companySize: z.string().optional(),
    shareCapital: z.number().min(0).optional(),
    segment: z.string().optional(),
    cnaes: z.array(cnaeSchema).default([]),

    addresses: z.array(addressSchema).default([]),
    phone: optionalPhone,
    whatsapp: optionalPhone,
    email: optionalEmail,
    emailFinancial: optionalEmail,
    emailBilling: optionalEmail,
    emailFiscal: optionalEmail,
    website: z.string().optional(),
    contacts: z.array(contactSchema).default([]),

    defaultRevenueCategoryId: z.string().optional(),
    defaultSubcategoryId: z.string().optional(),
    defaultResultCenterId: z.string().optional(),
    defaultAccountingAccount: z.string().optional(),
    defaultProductService: z.string().optional(),
    defaultDescription: z.string().optional(),
    defaultHistory: z.string().optional(),
    abcClassification: z.enum(["A", "B", "C", "NOT_CLASSIFIED"]).default("NOT_CLASSIFIED"),
    revenuePotentialLevel: z.enum(["LOW", "MEDIUM", "HIGH", "STRATEGIC"]).optional(),
    estimatedMonthlyRevenue: z.number().min(0).optional(),
    estimatedAnnualRevenue: z.number().min(0).optional(),
    estimatedAverageTicket: z.number().min(0).optional(),
    estimatedMarginPercentage: z.number().min(0).max(100).optional(),

    paymentTermDays: z.number().min(0).optional(),
    defaultDueDay: z.number().min(1).max(31).optional(),
    billingFrequency: z
      .enum(["ONCE", "WEEKLY", "BIWEEKLY", "MONTHLY", "BIMONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "CUSTOM"])
      .optional(),
    preferredPaymentMethod: z
      .enum(["PIX", "BOLETO", "BANK_TRANSFER", "CREDIT_CARD", "DEBIT_CARD", "CASH", "DIRECT_DEBIT", "PAYMENT_LINK", "CHECK", "OTHER"])
      .optional(),
    defaultLateFeePercentage: z.number().min(0).max(100).default(2),
    defaultMonthlyInterestPercentage: z.number().min(0).max(100).default(1),
    defaultDiscountPercentage: z.number().min(0).max(100).optional(),
    earlyPaymentDiscountPercentage: z.number().min(0).max(100).optional(),
    earlyPaymentDays: z.number().min(0).optional(),
    gracePeriodDays: z.number().min(0).default(0),

    creditLimit: z.number().min(0, "O limite de crédito não pode ser negativo.").optional(),
    riskLevel: z.enum(["VERY_LOW", "LOW", "MODERATE", "HIGH", "VERY_HIGH", "NOT_ASSESSED"]).default("NOT_ASSESSED"),
    allowOverCreditLimit: z.boolean().default(false),
    requiresOverLimitApproval: z.boolean().default(true),
    automaticBlockEnabled: z.boolean().default(false),
    automaticBlockDays: z.number().min(1).optional(),

    autoIdentificationEnabled: z.boolean().default(true),
    autoRevenueClassificationEnabled: z.boolean().default(true),
    autoResultCenterEnabled: z.boolean().default(true),
    receivableSuggestionEnabled: z.boolean().default(true),
    autoReceivableCreationEnabled: z.boolean().default(false),
    autoReceiptMatchingEnabled: z.boolean().default(false),
    confirmationThreshold: z.number().min(0).max(100).default(95),
    billingRulesEnabled: z.boolean().default(false),

    contracts: z.array(contractSchema).default([]),
    recurringReceivables: z.array(recurringReceivableSchema).default([]),
    internalNotes: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    const digits = (values.documentNumber ?? "").replace(/\D/g, "");

    if (values.personType === "LEGAL_ENTITY" && !cnpj.isValid(digits)) {
      ctx.addIssue({ code: "custom", path: ["documentNumber"], message: "Informe um CNPJ válido." });
    }
    if (values.personType === "INDIVIDUAL" && !cpf.isValid(digits)) {
      ctx.addIssue({ code: "custom", path: ["documentNumber"], message: "Informe um CPF válido." });
    }
    if (values.personType === "FOREIGN" && !values.foreignDocument?.trim()) {
      ctx.addIssue({ code: "custom", path: ["foreignDocument"], message: "Informe o documento do cliente estrangeiro." });
    }
  });

export type CustomerFormSchema = z.input<typeof customerFormSchema>;

/** Campos validados em cada etapa do formulário (usados com form.trigger() ao avançar). */
export const CUSTOMER_FORM_STEP_FIELDS: (keyof CustomerFormSchema)[][] = [
  ["organizationId", "companyId", "personType", "documentNumber", "foreignDocument", "legalName", "displayName", "customerTypes"],
  ["stateRegistration", "municipalRegistration", "openingDate", "birthDate", "legalNature", "companySize", "shareCapital", "segment", "cnaes"],
  ["addresses", "phone", "whatsapp", "email", "emailFinancial", "emailBilling", "emailFiscal", "website", "contacts"],
  ["defaultRevenueCategoryId", "defaultSubcategoryId", "defaultResultCenterId", "abcClassification"],
  ["preferredPaymentMethod", "paymentTermDays", "defaultDueDay", "billingFrequency"],
  ["creditLimit", "riskLevel"],
  ["billingRulesEnabled"],
  ["contracts", "recurringReceivables"],
  ["contracts"],
  [],
];
