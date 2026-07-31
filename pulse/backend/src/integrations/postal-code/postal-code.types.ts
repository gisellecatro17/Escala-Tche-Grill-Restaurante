export interface PostalCodeData {
  postalCode: string;
  street?: string;
  district?: string;
  city?: string;
  cityCode?: string;
  state?: string;
}

export interface PostalCodeQueryResult {
  success: boolean;
  provider: string;
  data?: PostalCodeData;
  errorMessage?: string;
}

export const POSTAL_CODE_PROVIDER = Symbol('POSTAL_CODE_PROVIDER');

/** Camada de integração desacoplada para consulta de CEP. */
export interface PostalCodeProvider {
  readonly name: string;
  queryPostalCode(postalCode: string): Promise<PostalCodeQueryResult>;
}
