import {
  maskAccountFragment,
  maskPixKeyValue,
} from '../../../common/utils/mask.util';

/**
 * Mascaramento dos dados sensíveis da tesouraria (seção 76).
 *
 * Aplicado no **back-end**: um usuário sem permissão nunca recebe o dado completo, nem
 * mesmo para o front-end esconder. Esconder na tela deixaria o valor no tráfego e no
 * cache do navegador.
 */

/** Marcador exibido no lugar de um valor monetário protegido. */
export const MASKED_AMOUNT = '••••••••';

export interface MaskableAccount {
  branchNumber?: string | null;
  branchDigit?: string | null;
  accountNumber?: string | null;
  accountDigit?: string | null;
  holderDocument?: string | null;
  iban?: string | null;
  swiftCode?: string | null;
  [key: string]: unknown;
}

/** Substitui agência, conta e documento do titular por versões mascaradas. */
export function maskBankData<T extends MaskableAccount>(account: T): T {
  return {
    ...account,
    branchNumber: maskAccountFragment(account.branchNumber),
    accountNumber: maskAccountFragment(account.accountNumber),
    holderDocument: maskAccountFragment(account.holderDocument),
    iban: maskAccountFragment(account.iban),
    swiftCode: maskAccountFragment(account.swiftCode),
  };
}

export interface MaskablePixKey {
  pixKey?: string | null;
  normalizedKey?: string | null;
  holderDocument?: string | null;
  [key: string]: unknown;
}

export function maskPixKey<T extends MaskablePixKey>(key: T): T {
  return {
    ...key,
    pixKey: maskPixKeyValue(key.pixKey),
    // A chave normalizada existe para busca interna; devolvê-la anularia o mascaramento.
    normalizedKey: maskPixKeyValue(key.normalizedKey),
    holderDocument: maskAccountFragment(key.holderDocument),
  };
}

/**
 * Oculta os campos de saldo e limite. Sem a permissão de ver saldo, o valor sai da
 * resposta por completo — devolver zero ou nulo seria uma informação em si.
 */
export function maskBalances<T extends Record<string, unknown>>(
  record: T,
  fields: string[],
): T {
  const masked = { ...record } as Record<string, unknown>;
  for (const field of fields) {
    if (masked[field] !== undefined && masked[field] !== null) {
      masked[field] = MASKED_AMOUNT;
    }
  }
  return masked as T;
}

/** Campos monetários de uma conta financeira, ocultados juntos. */
export const ACCOUNT_BALANCE_FIELDS = [
  'minimumRecommendedBalance',
  'maximumRecommendedBalance',
  'blockedBalance',
  'closingBalance',
];
