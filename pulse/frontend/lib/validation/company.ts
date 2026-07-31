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
  addressType: z.enum(["FISCAL", "OPERATIONAL", "BILLING", "CORRESPONDENCE"]),
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
  sameAsAddressId: z.string().optional(),
});

const contactSchema = z.object({
  id: z.string().optional(),
  contactType: z.enum(["PRIMARY", "FINANCIAL", "FISCAL", "ACCOUNTING", "ADMINISTRATIVE", "OPERATIONAL", "OTHER"]),
  name: z.string().min(1, "Informe o nome do contato."),
  position: z.string().optional(),
  department: z.string().optional(),
  phone: optionalPhone,
  whatsapp: optionalPhone,
  email: optionalEmail,
  isPrimary: z.boolean().optional(),
});

const cnaeSchema = z.object({
  id: z.string().optional(),
  cnaeCode: z.string().min(1, "Informe o código do CNAE."),
  description: z.string().optional(),
  isMain: z.boolean().optional(),
});

export const companyFormSchema = z
  .object({
    organizationId: z.string().min(1, "Selecione a organização."),
    parentCompanyId: z.string().optional(),
    internalCode: z.string().optional(),
    personType: z.enum(["INDIVIDUAL", "LEGAL_ENTITY"]),
    documentNumber: z.string().min(1, "Informe o documento."),
    legalName: z.string().min(2, "Informe a razão social ou o nome completo."),
    tradeName: z.string().optional(),
    displayName: z.string().min(2, "Informe o nome de exibição."),
    establishmentType: z.enum(["HEADQUARTERS", "BRANCH", "OPERATING_UNIT"]),
    implementationStartDate: z.string().optional(),
    registrationNotes: z.string().optional(),

    openingDate: z.string().optional(),
    legalNature: z.string().optional(),
    companySize: z.string().optional(),
    shareCapital: z.number().min(0).optional(),
    stateRegistration: z.string().optional(),
    municipalRegistration: z.string().optional(),
    cnaes: z.array(cnaeSchema).default([]),

    addresses: z.array(addressSchema).default([]),

    phone: optionalPhone,
    phoneSecondary: optionalPhone,
    whatsapp: optionalPhone,
    email: optionalEmail,
    emailFinancial: optionalEmail,
    emailFiscal: optionalEmail,
    website: z.string().optional(),
    contacts: z.array(contactSchema).default([]),

    taxRegime: z
      .enum(["SIMPLES_NACIONAL", "LUCRO_PRESUMIDO", "LUCRO_REAL", "MEI", "IMUNE", "ISENTA", "OUTRO"])
      .optional(),
    taxAssessmentMethod: z.enum(["ACCRUAL", "CASH", "MIXED", "NOT_INFORMED"]).optional(),
    icmsTaxpayer: z.boolean().optional(),
    simplesNacionalOptant: z.boolean().optional(),
    simplesNacionalOptionDate: z.string().optional(),
    simplesNacionalExclusionDate: z.string().optional(),
    specialTaxRegime: z.string().optional(),
    accountingFirmName: z.string().optional(),
    accountingResponsibleName: z.string().optional(),
    taxNotes: z.string().optional(),

    currencyCode: z.string().default("BRL"),
    dateFormat: z.string().default("DD/MM/YYYY"),
    timezone: z.string().default("America/Bahia"),
    financialMethod: z.enum(["ACCRUAL", "CASH", "MIXED", "NOT_INFORMED"]).default("ACCRUAL"),
    financialMonthStartDay: z.number().min(1).max(31).default(1),
    monthClosingDay: z.number().min(1, "O dia de fechamento deve estar entre 1 e 31.").max(31, "O dia de fechamento deve estar entre 1 e 31.").default(31),
    allowRetroactiveEntries: z.boolean().default(true),
    allowFutureEntries: z.boolean().default(true),
    requiresCategory: z.boolean().default(true),
    requiresCostCenter: z.boolean().default(false),
    requiresSupplier: z.boolean().default(false),
    requiresCustomer: z.boolean().default(false),
    requiresAttachment: z.boolean().default(false),
    requiresApproval: z.boolean().default(false),
    approvalLevels: z.number().min(1).max(5).default(1),
    automaticCodeEnabled: z.boolean().default(true),
  })
  .superRefine((values, ctx) => {
    const digits = values.documentNumber.replace(/\D/g, "");

    if (values.personType === "LEGAL_ENTITY" && !cnpj.isValid(digits)) {
      ctx.addIssue({ code: "custom", path: ["documentNumber"], message: "Informe um CNPJ válido." });
    }

    if (values.personType === "INDIVIDUAL" && !cpf.isValid(digits)) {
      ctx.addIssue({ code: "custom", path: ["documentNumber"], message: "Informe um CPF válido." });
    }

    if (values.establishmentType !== "HEADQUARTERS" && !values.parentCompanyId) {
      ctx.addIssue({
        code: "custom",
        path: ["parentCompanyId"],
        message: "Selecione a empresa matriz para filiais e unidades operacionais.",
      });
    }
  });

// Usamos o tipo de entrada (antes da aplicação dos `.default(...)`) como tipo do
// formulário, já que é essa a forma que o react-hook-form manipula antes do submit —
// o zodResolver aplica os defaults apenas na validação/saída.
export type CompanyFormSchema = z.input<typeof companyFormSchema>;

/** Campos validados em cada etapa do formulário (usados com form.trigger() ao avançar). */
export const COMPANY_FORM_STEP_FIELDS: (keyof CompanyFormSchema)[][] = [
  ["organizationId", "personType", "documentNumber", "legalName", "displayName", "establishmentType", "parentCompanyId"],
  ["openingDate", "legalNature", "companySize", "shareCapital", "stateRegistration", "municipalRegistration", "cnaes"],
  ["addresses"],
  ["phone", "phoneSecondary", "whatsapp", "email", "emailFinancial", "emailFiscal", "website", "contacts"],
  ["taxRegime", "taxAssessmentMethod", "icmsTaxpayer", "simplesNacionalOptant"],
  ["currencyCode", "dateFormat", "timezone", "financialMethod", "financialMonthStartDay", "monthClosingDay", "approvalLevels"],
  [],
  [],
];
