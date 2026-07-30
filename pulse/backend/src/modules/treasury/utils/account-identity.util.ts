import { FinancialAccountType } from '@prisma/client';

import { onlyDigits } from '../../../common/utils/normalize.util';
import { BANK_ACCOUNT_TYPES } from '../dto/financial-account.dto';

/** Uma conta em instituição financeira exige agência, conta e titular. */
export function isBankAccount(accountType: FinancialAccountType): boolean {
  return BANK_ACCOUNT_TYPES.includes(accountType);
}

/**
 * Identificador normalizado da conta: instituição + agência + conta, só dígitos.
 *
 * É o que detecta duplicidade real — `1234-5 / 12345-6` e `12345 / 123456` são a mesma
 * conta escrita de dois jeitos, e a constraint de texto literal não pegaria isso.
 */
export function buildAccountIdentifier(input: {
  financialInstitutionId?: string | null;
  branchNumber?: string | null;
  branchDigit?: string | null;
  accountNumber?: string | null;
  accountDigit?: string | null;
}): string | null {
  const branch = `${onlyDigits(input.branchNumber ?? '')}${onlyDigits(input.branchDigit ?? '')}`;
  const account = `${onlyDigits(input.accountNumber ?? '')}${onlyDigits(input.accountDigit ?? '')}`;

  if (!branch && !account) return null;

  return [
    input.financialInstitutionId ?? 'sem-instituicao',
    branch,
    account,
  ].join(':');
}

/**
 * Nome de exibição usado em seletores, relatórios e conciliação (seção 12). Quando o
 * usuário não informa, monta a partir da instituição e do nome da conta.
 */
export function buildDisplayName(
  informed: string | undefined | null,
  institutionName: string | undefined | null,
  accountName: string,
): string {
  if (informed?.trim()) return informed.trim();
  if (institutionName?.trim())
    return `${institutionName.trim()} — ${accountName}`;
  return accountName;
}
