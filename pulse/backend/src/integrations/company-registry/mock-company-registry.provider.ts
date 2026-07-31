import { Injectable } from '@nestjs/common';

import type {
  CompanyRegistryData,
  CompanyRegistryProvider,
  CompanyRegistryQueryResult,
} from './company-registry.types';

/**
 * Implementação simulada usada em desenvolvimento/testes (COMPANY_REGISTRY_PROVIDER=mock,
 * valor padrão). Gera dados plausíveis e determinísticos a partir do próprio documento,
 * sem chamar nenhum serviço externo.
 */
@Injectable()
export class MockCompanyRegistryProvider implements CompanyRegistryProvider {
  readonly name = 'mock';

  async queryDocument(
    documentNumber: string,
  ): Promise<CompanyRegistryQueryResult> {
    await this.simulateLatency();

    if (documentNumber.length !== 14) {
      return {
        success: false,
        provider: this.name,
        errorCode: 'UNSUPPORTED_DOCUMENT',
        errorMessage:
          'A consulta automática está disponível apenas para CNPJ nesta etapa.',
      };
    }

    const branchDigits = documentNumber.slice(8, 12);
    const isHeadquarters = branchDigits === '0001';

    const data: CompanyRegistryData = {
      documentNumber,
      legalName: `EMPRESA ${documentNumber.slice(0, 6)} LTDA`,
      tradeName: `Empresa ${documentNumber.slice(0, 6)}`,
      openingDate: '2015-03-10',
      registrationStatus: 'ATIVA',
      registrationStatusDate: '2015-03-10',
      legalNature: 'Sociedade Empresária Limitada',
      companySize: 'ME',
      shareCapital: 50000,
      establishmentType: isHeadquarters ? 'HEADQUARTERS' : 'BRANCH',
      mainCnae: { code: '56.11-2-01', description: 'Restaurantes e similares' },
      secondaryCnaes: [
        {
          code: '56.20-1-04',
          description: 'Fornecimento de alimentos preparados',
        },
      ],
      address: {
        postalCode: '44350-000',
        street: 'Avenida Exemplo',
        number: '100',
        district: 'Centro',
        city: 'Governador Mangabeira',
        cityCode: '2911402',
        state: 'BA',
      },
      phone: '(75) 3000-0000',
      email: 'contato@empresaexemplo.com.br',
    };

    return { success: true, provider: this.name, data };
  }

  private async simulateLatency(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
}
