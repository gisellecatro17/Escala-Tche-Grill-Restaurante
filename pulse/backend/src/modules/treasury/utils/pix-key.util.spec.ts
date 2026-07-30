import { BadRequestException } from '@nestjs/common';
import { PixKeyType } from '@prisma/client';

import { assertValidPixKey, normalizePixKey } from './pix-key.util';

describe('normalizePixKey', () => {
  it('reduz CPF e CNPJ a dígitos', () => {
    expect(normalizePixKey(PixKeyType.CNPJ, '11.222.333/0001-81')).toBe(
      '11222333000181',
    );
    expect(normalizePixKey(PixKeyType.CPF, '529.982.247-25')).toBe(
      '52998224725',
    );
  });

  it('normaliza o e-mail para minúsculas', () => {
    expect(normalizePixKey(PixKeyType.EMAIL, 'Financeiro@Empresa.COM')).toBe(
      'financeiro@empresa.com',
    );
  });

  it('normaliza a chave aleatória para minúsculas', () => {
    expect(
      normalizePixKey(
        PixKeyType.RANDOM,
        '3F2504E0-4F89-41D3-9A0C-0305E82C3301',
      ),
    ).toBe('3f2504e0-4f89-41d3-9a0c-0305e82c3301');
  });

  it('guarda o telefone sempre com DDI', () => {
    expect(normalizePixKey(PixKeyType.PHONE, '(71) 99999-8888')).toBe(
      '+5571999998888',
    );
    // Já com DDI, não duplica o 55.
    expect(normalizePixKey(PixKeyType.PHONE, '+55 71 99999-8888')).toBe(
      '+5571999998888',
    );
  });

  it('reconhece duas grafias da mesma chave como iguais', () => {
    expect(normalizePixKey(PixKeyType.CNPJ, '11.222.333/0001-81')).toBe(
      normalizePixKey(PixKeyType.CNPJ, '11222333000181'),
    );
  });
});

describe('assertValidPixKey', () => {
  it('aceita CPF e CNPJ válidos', () => {
    expect(() =>
      assertValidPixKey(PixKeyType.CNPJ, '11.222.333/0001-81'),
    ).not.toThrow();
    expect(() =>
      assertValidPixKey(PixKeyType.CPF, '529.982.247-25'),
    ).not.toThrow();
  });

  it('recusa CPF com dígito verificador errado', () => {
    expect(() => assertValidPixKey(PixKeyType.CPF, '111.111.111-11')).toThrow(
      BadRequestException,
    );
  });

  it('recusa CNPJ inválido', () => {
    expect(() =>
      assertValidPixKey(PixKeyType.CNPJ, '11.222.333/0001-99'),
    ).toThrow(/CNPJ/);
  });

  it('aceita e-mail válido e recusa inválido', () => {
    expect(() =>
      assertValidPixKey(PixKeyType.EMAIL, 'financeiro@empresa.com.br'),
    ).not.toThrow();
    expect(() => assertValidPixKey(PixKeyType.EMAIL, 'sem-arroba')).toThrow(
      /e-mail/i,
    );
  });

  it('aceita telefone com DDD e recusa número curto', () => {
    expect(() =>
      assertValidPixKey(PixKeyType.PHONE, '(71) 99999-8888'),
    ).not.toThrow();
    expect(() => assertValidPixKey(PixKeyType.PHONE, '9999')).toThrow(
      /telefone/i,
    );
  });

  it('aceita chave aleatória no formato do banco e recusa texto livre', () => {
    expect(() =>
      assertValidPixKey(
        PixKeyType.RANDOM,
        '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
      ),
    ).not.toThrow();
    expect(() => assertValidPixKey(PixKeyType.RANDOM, 'minha-chave')).toThrow(
      /chave aleatória/i,
    );
  });

  it('não impõe formato a dados bancários', () => {
    expect(() =>
      assertValidPixKey(PixKeyType.BANK_DATA, 'ag 1234 cc 56789'),
    ).not.toThrow();
  });
});
