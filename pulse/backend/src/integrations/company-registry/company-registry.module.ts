import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { BrasilApiCompanyRegistryProvider } from './brasil-api-company-registry.provider';
import { COMPANY_REGISTRY_PROVIDER } from './company-registry.types';
import { MockCompanyRegistryProvider } from './mock-company-registry.provider';

@Module({
  imports: [ConfigModule],
  providers: [
    MockCompanyRegistryProvider,
    BrasilApiCompanyRegistryProvider,
    {
      provide: COMPANY_REGISTRY_PROVIDER,
      inject: [
        ConfigService,
        MockCompanyRegistryProvider,
        BrasilApiCompanyRegistryProvider,
      ],
      useFactory: (
        config: ConfigService,
        mock: MockCompanyRegistryProvider,
        brasilApi: BrasilApiCompanyRegistryProvider,
      ) => {
        const provider =
          config.get<string>('COMPANY_REGISTRY_PROVIDER') ?? 'mock';
        return provider === 'brasilapi' ? brasilApi : mock;
      },
    },
  ],
  exports: [COMPANY_REGISTRY_PROVIDER],
})
export class CompanyRegistryModule {}
