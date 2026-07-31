export interface CompanyRegistryAddress {
  postalCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  cityCode?: string;
  state?: string;
}

export interface CompanyRegistryCnae {
  code: string;
  description: string;
}

/** Dados normalizados retornados por um provider de consulta cadastral (CNPJ/CPF). */
export interface CompanyRegistryData {
  documentNumber: string;
  legalName?: string;
  tradeName?: string;
  openingDate?: string;
  registrationStatus?: string;
  registrationStatusDate?: string;
  legalNature?: string;
  companySize?: string;
  shareCapital?: number;
  establishmentType?: 'HEADQUARTERS' | 'BRANCH';
  mainCnae?: CompanyRegistryCnae;
  secondaryCnaes?: CompanyRegistryCnae[];
  address?: CompanyRegistryAddress;
  phone?: string;
  email?: string;
}

export interface CompanyRegistryQueryResult {
  success: boolean;
  provider: string;
  data?: CompanyRegistryData;
  errorCode?: string;
  errorMessage?: string;
}

export const COMPANY_REGISTRY_PROVIDER = Symbol('COMPANY_REGISTRY_PROVIDER');

/**
 * Camada de integração desacoplada para consulta cadastral (CNPJ/CPF) — permite trocar o
 * provedor externo (ex.: BrasilAPI, ReceitaWS, provedor pago) sem alterar o restante do
 * sistema. Nunca deve ser chamada diretamente pelo front-end nem expor chaves de API.
 */
export interface CompanyRegistryProvider {
  readonly name: string;
  queryDocument(documentNumber: string): Promise<CompanyRegistryQueryResult>;
}
