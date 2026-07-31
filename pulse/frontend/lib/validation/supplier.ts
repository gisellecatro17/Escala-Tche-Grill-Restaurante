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
  addressType: z.enum(["FISCAL", "COMMERCIAL", "BILLING", "CORRESPONDENCE", "OPERATIONAL"]),
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
  isCommercialContact: z.boolean().optional(),
  isInvoiceResponsible: z.boolean().optional(),
  isBillingResponsible: z.boolean().optional(),
  receivesPaymentReceipts: z.boolean().optional(),
});

const cnaeSchema = z.object({
  id: z.string().optional(),
  cnaeCode: z.string().min(1, "Informe o código do CNAE."),
  description: z.string().optional(),
  isMain: z.boolean().optional(),
});

const bankAccountSchema = z
  .object({
    id: z.string().optional(),
    financialInstitutionId: z.string().optional(),
    branchNumber: z.string().min(1, "Informe a agência."),
    branchDigit: z.string().optional(),
    accountNumber: z.string().min(1, "Informe a conta."),
    accountDigit: z.string().optional(),
    accountType: z.enum(["CHECKING", "SAVINGS", "PAYMENT", "DIGITAL", "THIRD_PARTY", "OTHER"]),
    holderName: z.string().min(1, "Informe o nome do titular."),
    holderDocument: z.string().min(11, "Informe o CPF/CNPJ do titular."),
    isPrimary: z.boolean().optional(),
    isThirdParty: z.boolean().optional(),
    thirdPartyReason: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.isThirdParty && !values.thirdPartyReason?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["thirdPartyReason"],
        message: "Informe o motivo da utilização de conta de terceiro.",
      });
    }
  });

const pixKeySchema = z
  .object({
    id: z.string().optional(),
    pixType: z.enum(["CPF", "CNPJ", "PHONE", "EMAIL", "RANDOM", "BANK_DATA"]),
    pixKey: z.string().min(1, "Informe a chave PIX."),
    holderName: z.string().min(1, "Informe o nome do titular."),
    holderDocument: z.string().min(11, "Informe o CPF/CNPJ do titular."),
    bankAccountId: z.string().optional(),
    isPrimary: z.boolean().optional(),
    isThirdParty: z.boolean().optional(),
    thirdPartyReason: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.isThirdParty && !values.thirdPartyReason?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["thirdPartyReason"],
        message: "Informe o motivo da utilização de chave PIX de terceiro.",
      });
    }
  });

const allocationSchema = z.object({
  id: z.string().optional(),
  categoryId: z.string().optional(),
  costCenterId: z.string().optional(),
  allocationType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  percentage: z.number().min(0).max(100).optional(),
  fixedAmount: z.number().min(0).optional(),
  priority: z.number().optional(),
});

const taxWithholdingSchema = z.object({
  id: z.string().optional(),
  taxType: z.enum(["INSS", "IRRF", "ISS", "PIS", "COFINS", "CSLL", "OTHER"]),
  rate: z.number().min(0).max(100).optional(),
  minimumAmount: z.number().min(0).optional(),
  calculationBase: z.string().optional(),
  serviceCode: z.string().optional(),
  cityCode: z.string().optional(),
  revenueCode: z.string().optional(),
  automatic: z.boolean().optional(),
  requiresConfirmation: z.boolean().optional(),
  notes: z.string().optional(),
});

const contractSchema = z.object({
  id: z.string().optional(),
  contractNumber: z.string().optional(),
  description: z.string().optional(),
  object: z.string().optional(),
  contractValue: z.number().min(0).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  automaticRenewal: z.boolean().optional(),
  billingFrequency: z.string().optional(),
  adjustmentIndex: z.string().optional(),
  notes: z.string().optional(),
});

export const supplierFormSchema = z
  .object({
    organizationId: z.string().min(1, "Selecione a organização."),
    companyId: z.string().min(1, "Selecione a empresa vinculada."),

    personType: z.enum(["INDIVIDUAL", "LEGAL_ENTITY", "FOREIGN"]),
    documentNumber: z.string().optional(),
    foreignTaxId: z.string().optional(),
    foreignCountry: z.string().optional(),
    foreignCurrency: z.string().optional(),

    internalCode: z.string().optional(),
    legalName: z.string().min(2, "Informe a razão social ou o nome completo."),
    tradeName: z.string().optional(),
    displayName: z.string().min(2, "Informe o nome de exibição."),
    supplierTypes: z.array(z.string()).default([]),
    generalNotes: z.string().optional(),

    stateRegistration: z.string().optional(),
    municipalRegistration: z.string().optional(),
    openingDate: z.string().optional(),
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
    emailPaymentReceipts: optionalEmail,
    website: z.string().optional(),
    contacts: z.array(contactSchema).default([]),

    bankAccounts: z.array(bankAccountSchema).default([]),
    pixKeys: z.array(pixKeySchema).default([]),

    defaultCategoryId: z.string().optional(),
    defaultSubcategoryId: z.string().optional(),
    defaultCostCenterId: z.string().optional(),
    defaultAccountingAccount: z.string().optional(),
    defaultDescription: z.string().optional(),
    defaultHistory: z.string().optional(),
    financialNature: z
      .enum(["COST", "EXPENSE", "INVESTMENT", "TAX", "LOAN", "DISTRIBUTION", "REIMBURSEMENT", "ADVANCE", "TRANSFER", "OTHER"])
      .optional(),
    categoryRequired: z.boolean().default(false),
    costCenterRequired: z.boolean().default(false),

    preferredPaymentMethod: z.enum(["PIX", "BOLETO", "BANK_TRANSFER", "DIRECT_DEBIT", "CARD", "CASH", "CHECK", "OTHER"]).optional(),
    paymentTermDays: z.number().min(0).optional(),
    paymentTermFixedDueDay: z.number().min(1).max(31).optional(),
    paymentTermPeriodicity: z.string().optional(),
    preferredBankAccountIndex: z.number().optional(),
    preferredPixKeyIndex: z.number().optional(),
    minimumAmount: z.number().min(0).optional(),
    maximumAmountWithoutApproval: z.number().min(0).optional(),
    hasContract: z.boolean().default(false),
    requiresMatchingBeneficiary: z.boolean().default(true),
    allowsThirdPartyPayment: z.boolean().default(false),

    taxWithholdingPolicy: z.enum(["YES", "NO", "EVALUATE_PER_ENTRY"]).optional(),
    taxWithholdings: z.array(taxWithholdingSchema).default([]),
    allocationEnabled: z.boolean().default(false),
    allocations: z.array(allocationSchema).default([]),

    autoIdentificationEnabled: z.boolean().default(true),
    autoClassificationEnabled: z.boolean().default(true),
    autoCostCenterEnabled: z.boolean().default(true),
    autoAllocationEnabled: z.boolean().default(true),
    reconciliationSuggestionEnabled: z.boolean().default(true),
    autoEntryCreationEnabled: z.boolean().default(false),
    autoReconciliationEnabled: z.boolean().default(false),
    confirmationThreshold: z.number().min(0).max(100).default(95),

    contracts: z.array(contractSchema).default([]),
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
    if (values.personType === "FOREIGN" && !values.foreignTaxId?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["foreignTaxId"],
        message: "Informe o número de identificação fiscal do fornecedor estrangeiro.",
      });
    }

    const percentageTotal = values.allocations
      .filter((a) => a.allocationType === "PERCENTAGE")
      .reduce((sum, a) => sum + (a.percentage ?? 0), 0);
    if (values.allocations.length > 0 && percentageTotal > 100) {
      ctx.addIssue({ code: "custom", path: ["allocations"], message: "A soma dos rateios deve ser igual a 100%." });
    }
  });

export type SupplierFormSchema = z.input<typeof supplierFormSchema>;

/** Campos validados em cada etapa do formulário (usados com form.trigger() ao avançar). */
export const SUPPLIER_FORM_STEP_FIELDS: (keyof SupplierFormSchema)[][] = [
  ["organizationId", "companyId", "personType", "documentNumber", "foreignTaxId", "legalName", "displayName", "supplierTypes"],
  ["stateRegistration", "municipalRegistration", "openingDate", "legalNature", "companySize", "shareCapital", "segment", "cnaes"],
  ["addresses", "phone", "whatsapp", "email", "emailFinancial", "emailPaymentReceipts", "website", "contacts"],
  ["bankAccounts", "pixKeys"],
  ["defaultCategoryId", "defaultSubcategoryId", "defaultCostCenterId", "financialNature"],
  ["preferredPaymentMethod", "paymentTermDays", "preferredBankAccountIndex", "preferredPixKeyIndex"],
  ["taxWithholdingPolicy", "taxWithholdings", "allocations"],
  ["autoIdentificationEnabled", "confirmationThreshold"],
  ["contracts"],
  [],
];
