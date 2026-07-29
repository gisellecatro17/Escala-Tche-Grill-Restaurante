import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type {
  PostalCodeProvider,
  PostalCodeQueryResult,
} from './postal-code.types';

interface ViaCepResponse {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  ibge?: string;
  uf?: string;
  erro?: boolean;
}

/**
 * Provedor padrão de consulta de CEP, usando o ViaCEP (https://viacep.com.br) — serviço
 * público brasileiro, sem necessidade de chave de API. A URL base é configurável via
 * POSTAL_CODE_API_URL para permitir a troca por outro provedor no futuro.
 */
@Injectable()
export class ViaCepPostalCodeProvider implements PostalCodeProvider {
  readonly name = 'viacep';
  private readonly logger = new Logger(ViaCepPostalCodeProvider.name);
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl =
      this.config.get<string>('POSTAL_CODE_API_URL') ??
      'https://viacep.com.br/ws';
  }

  async queryPostalCode(postalCode: string): Promise<PostalCodeQueryResult> {
    try {
      const response = await fetch(`${this.baseUrl}/${postalCode}/json/`, {
        signal: AbortSignal.timeout(6000),
      });

      if (!response.ok) {
        return {
          success: false,
          provider: this.name,
          errorMessage: 'Não foi possível consultar o CEP.',
        };
      }

      const payload = (await response.json()) as ViaCepResponse;

      if (payload.erro) {
        return {
          success: false,
          provider: this.name,
          errorMessage: 'CEP não encontrado.',
        };
      }

      return {
        success: true,
        provider: this.name,
        data: {
          postalCode,
          street: payload.logradouro,
          district: payload.bairro,
          city: payload.localidade,
          cityCode: payload.ibge,
          state: payload.uf,
        },
      };
    } catch (error) {
      this.logger.warn(
        `Falha ao consultar CEP ${postalCode}: ${(error as Error).message}`,
      );
      return {
        success: false,
        provider: this.name,
        errorMessage: 'Não foi possível consultar o CEP.',
      };
    }
  }
}
