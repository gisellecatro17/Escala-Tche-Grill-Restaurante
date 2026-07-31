import { Injectable } from '@nestjs/common';

import type {
  PostalCodeProvider,
  PostalCodeQueryResult,
} from './postal-code.types';

/** Implementação simulada usada em desenvolvimento/testes (POSTAL_CODE_PROVIDER=mock). */
@Injectable()
export class MockPostalCodeProvider implements PostalCodeProvider {
  readonly name = 'mock';

  async queryPostalCode(postalCode: string): Promise<PostalCodeQueryResult> {
    await new Promise((resolve) => setTimeout(resolve, 200));

    if (postalCode.length !== 8) {
      return {
        success: false,
        provider: this.name,
        errorMessage: 'CEP inválido.',
      };
    }

    return {
      success: true,
      provider: this.name,
      data: {
        postalCode,
        street: 'Avenida Exemplo',
        district: 'Centro',
        city: 'Governador Mangabeira',
        cityCode: '2911402',
        state: 'BA',
      },
    };
  }
}
