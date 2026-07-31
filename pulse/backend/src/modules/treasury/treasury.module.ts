import { Module } from '@nestjs/common';

import { AccountDetailsController } from './account-details.controller';
import { AccountDetailsService } from './account-details.service';
import { CompanyPixKeysController } from './company-pix-keys.controller';
import { CorporateCardsController } from './corporate-cards.controller';
import { CorporateCardsService } from './corporate-cards.service';
import { FinancialAccountsController } from './financial-accounts.controller';
import { FinancialAccountsService } from './financial-accounts.service';
import { PaymentMethodsController } from './payment-methods.controller';
import { PaymentMethodsService } from './payment-methods.service';
import { ReceiptMethodsController } from './receipt-methods.controller';
import { TreasuryController } from './treasury.controller';
import { TreasuryService } from './treasury.service';

/**
 * Tesouraria: contas financeiras (bancárias, caixas e carteiras), saldos, limites,
 * chaves PIX da empresa, usuários por conta, integrações bancárias, cartões
 * corporativos, formas de pagamento e recebimento, favorecidos e parâmetros.
 *
 * Reaproveita `financial_institutions`, `attachments` e `audit_logs`, e lê — sem
 * duplicar — as contas e chaves PIX já cadastradas nos fornecedores.
 */
@Module({
  controllers: [
    TreasuryController,
    FinancialAccountsController,
    AccountDetailsController,
    CompanyPixKeysController,
    CorporateCardsController,
    PaymentMethodsController,
    ReceiptMethodsController,
  ],
  providers: [
    TreasuryService,
    FinancialAccountsService,
    AccountDetailsService,
    CorporateCardsService,
    PaymentMethodsService,
  ],
  exports: [
    TreasuryService,
    FinancialAccountsService,
    AccountDetailsService,
    CorporateCardsService,
    PaymentMethodsService,
  ],
})
export class TreasuryModule {}
