import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type {
  CompanyRegistryData,
  CompanyRegistryProvider,
  CompanyRegistryQueryResult,
} from './company-registry.types';

interface BrasilApiCnpjResponse {
  razao_social?: string;
  nome_fantasia?: string;
  data_inicio_atividade?: string;
  descricao_situacao_cadastral?: string;
  data_situacao_cadastral?: string;
  natureza_juridica?: string;
  porte?: string;
  capital_social?: number;
  identificador_matriz_filial?: number;
  cnae_fiscal?: number;
  cnae_fiscal_descricao?: string;
  cnaes_secundarios?: { codigo: number; descricao: string }[];
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  codigo_municipio_ibge?: number;
  uf?: string;
  ddd_telefone_1?: string;
  email?: string;
}

/**
 * Provedor real, opt-in via COMPANY_REGISTRY_PROVIDER=brasilapi. Usa a BrasilAPI
 * (https://brasilapi.com.br), uma API pública de dados cadastrais mantida pela
 * comunidade — não realiza raspagem de páginas nem acessa diretamente o site da
 * Receita Federal. Não requer chave de API, mas a URL é configurável via
 * COMPANY_REGISTRY_API_URL para permitir a troca por outro provedor autorizado no futuro.
 */
@Injectable()
export class BrasilApiCompanyRegistryProvider implements CompanyRegistryProvider {
  readonly name = 'brasilapi';
  private readonly logger = new Logger(BrasilApiCompanyRegistryProvider.name);
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl =
      this.config.get<string>('COMPANY_REGISTRY_API_URL') ??
      'https://brasilapi.com.br/api/cnpj/v1';
  }

  async queryDocument(
    documentNumber: string,
  ): Promise<CompanyRegistryQueryResult> {
    if (documentNumber.length !== 14) {
      return {
        success: false,
        provider: this.name,
        errorCode: 'UNSUPPORTED_DOCUMENT',
        errorMessage:
          'A consulta automática está disponível apenas para CNPJ nesta etapa.',
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/${documentNumber}`, {
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        return {
          success: false,
          provider: this.name,
          errorCode: `HTTP_${response.status}`,
          errorMessage:
            'Não foi possível consultar os dados cadastrais neste momento.',
        };
      }

      const payload = (await response.json()) as BrasilApiCnpjResponse;

      const data: CompanyRegistryData = {
        documentNumber,
        legalName: payload.razao_social,
        tradeName: payload.nome_fantasia,
        openingDate: payload.data_inicio_atividade,
        registrationStatus: payload.descricao_situacao_cadastral,
        registrationStatusDate: payload.data_situacao_cadastral,
        legalNature: payload.natureza_juridica,
        companySize: payload.porte,
        shareCapital: payload.capital_social,
        establishmentType:
          payload.identificador_matriz_filial === 1 ? 'HEADQUARTERS' : 'BRANCH',
        mainCnae: payload.cnae_fiscal
          ? {
              code: String(payload.cnae_fiscal),
              description: payload.cnae_fiscal_descricao ?? '',
            }
          : undefined,
        secondaryCnaes: payload.cnaes_secundarios?.map((c) => ({
          code: String(c.codigo),
          description: c.descricao,
        })),
        address: {
          postalCode: payload.cep,
          street: payload.logradouro,
          number: payload.numero,
          complement: payload.complemento,
          district: payload.bairro,
          city: payload.municipio,
          cityCode: payload.codigo_municipio_ibge
            ? String(payload.codigo_municipio_ibge)
            : undefined,
          state: payload.uf,
        },
        phone: payload.ddd_telefone_1,
        email: payload.email,
      };

      return { success: true, provider: this.name, data };
    } catch (error) {
      this.logger.warn(
        `Falha ao consultar CNPJ ${documentNumber}: ${(error as Error).message}`,
      );

      return {
        success: false,
        provider: this.name,
        errorCode: 'PROVIDER_UNAVAILABLE',
        errorMessage:
          'Não foi possível consultar os dados cadastrais neste momento.',
      };
    }
  }
}
