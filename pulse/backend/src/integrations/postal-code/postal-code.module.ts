import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { MockPostalCodeProvider } from './mock-postal-code.provider';
import { POSTAL_CODE_PROVIDER } from './postal-code.types';
import { ViaCepPostalCodeProvider } from './viacep-postal-code.provider';

@Module({
  imports: [ConfigModule],
  providers: [
    MockPostalCodeProvider,
    ViaCepPostalCodeProvider,
    {
      provide: POSTAL_CODE_PROVIDER,
      inject: [ConfigService, MockPostalCodeProvider, ViaCepPostalCodeProvider],
      useFactory: (
        config: ConfigService,
        mock: MockPostalCodeProvider,
        viaCep: ViaCepPostalCodeProvider,
      ) => {
        const provider = config.get<string>('POSTAL_CODE_PROVIDER') ?? 'viacep';
        return provider === 'mock' ? mock : viaCep;
      },
    },
  ],
  exports: [POSTAL_CODE_PROVIDER],
})
export class PostalCodeModule {}
