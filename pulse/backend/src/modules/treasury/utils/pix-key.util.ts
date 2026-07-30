import { BadRequestException } from '@nestjs/common';
import { PixKeyType } from '@prisma/client';
import { cnpj, cpf } from 'cpf-cnpj-validator';

import { onlyDigits } from '../../../common/utils/normalize.util';

/**
 * Acrescenta o DDI 55 quando ausente.
 *
 * A decisão é pelo **comprimento**, não pelo prefixo: 55 também é um DDD válido (Rio
 * Grande do Sul), então `55999998888` é "DDD 55 + celular", e não um número já com DDI.
 * Telefone nacional tem 10 ou 11 dígitos; com DDI, 12 ou 13.
 */
function withCountryCode(digits: string): string {
  const national = digits.replace(/^0+/, '');

  if (national.length === 10 || national.length === 11) {
    return `55${national}`;
  }

  return national;
}

/**
 * Normaliza a chave PIX conforme o tipo, para comparar duas grafias da mesma chave
 * (`11.222.333/0001-81` e `11222333000181` são a mesma chave).
 */
export function normalizePixKey(type: PixKeyType, key: string): string {
  const trimmed = key.trim();

  switch (type) {
    case PixKeyType.CPF:
    case PixKeyType.CNPJ:
      return onlyDigits(trimmed);
    case PixKeyType.PHONE:
      // O DDI é opcional na digitação; guardamos sempre com ele.
      return `+${withCountryCode(onlyDigits(trimmed))}`;
    case PixKeyType.EMAIL:
      return trimmed.toLowerCase();
    case PixKeyType.RANDOM:
      return trimmed.toLowerCase();
    default:
      return trimmed;
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Chave aleatória do Banco Central: UUID v4 em minúsculas. */
const RANDOM_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Valida a chave conforme o tipo declarado (seção 23). Uma chave inválida cadastrada
 * hoje vira um pagamento que não chega ao destino depois.
 */
export function assertValidPixKey(type: PixKeyType, key: string): void {
  const normalized = normalizePixKey(type, key);

  switch (type) {
    case PixKeyType.CPF:
      if (!cpf.isValid(normalized)) {
        throw new BadRequestException(
          'O CPF informado como chave PIX é inválido.',
        );
      }
      return;

    case PixKeyType.CNPJ:
      if (!cnpj.isValid(normalized)) {
        throw new BadRequestException(
          'O CNPJ informado como chave PIX é inválido.',
        );
      }
      return;

    case PixKeyType.PHONE: {
      const digits = onlyDigits(normalized);
      // Com DDI: 55 + DDD (2) + número (8 ou 9).
      if (digits.length < 12 || digits.length > 13) {
        throw new BadRequestException(
          'O telefone informado como chave PIX é inválido. Use DDD e número, como (71) 99999-9999.',
        );
      }
      return;
    }

    case PixKeyType.EMAIL:
      if (!EMAIL_PATTERN.test(normalized)) {
        throw new BadRequestException(
          'O e-mail informado como chave PIX é inválido.',
        );
      }
      return;

    case PixKeyType.RANDOM:
      if (!RANDOM_KEY_PATTERN.test(normalized)) {
        throw new BadRequestException(
          'A chave aleatória deve ter o formato fornecido pelo banco (32 caracteres com hífens).',
        );
      }
      return;

    case PixKeyType.BANK_DATA:
      // Dados bancários como "chave" não têm formato próprio: a validação é a da conta.
      return;

    default:
      return;
  }
}
