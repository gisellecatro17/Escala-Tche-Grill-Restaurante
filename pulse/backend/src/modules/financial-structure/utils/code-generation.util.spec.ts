import { BadRequestException } from '@nestjs/common';

import {
  assertCodeMatchesParent,
  generateNextCode,
  levelFromCode,
  normalizeCode,
} from './code-generation.util';

describe('generateNextCode', () => {
  it('gera o primeiro código de um nível quando não há irmãos', () => {
    expect(generateNextCode('5.02', [], 2)).toBe('5.02.001');
  });

  it('continua a sequência a partir do maior irmão', () => {
    expect(generateNextCode('5.02', ['5.02.001', '5.02.002'], 2)).toBe(
      '5.02.003',
    );
  });

  it('gera código de raiz sem prefixo', () => {
    expect(generateNextCode(null, ['1', '2', '3', '4'], 0)).toBe('5');
  });

  it('ignora netos ao calcular o próximo código', () => {
    // "5.02.001.7" é neto e não deve influenciar a sequência do nível de "5.02".
    expect(generateNextCode('5.02', ['5.02.001', '5.02.001.7'], 2)).toBe(
      '5.02.002',
    );
  });

  it('ignora irmãos de outros prefixos', () => {
    expect(generateNextCode('5.02', ['5.01.009', '5.02.001'], 2)).toBe(
      '5.02.002',
    );
  });

  it('preenche com zeros conforme a quantidade de dígitos do nível', () => {
    expect(generateNextCode('1', [], 1)).toBe('1.01');
  });

  it('respeita separador e dígitos personalizados', () => {
    expect(
      generateNextCode('5-02', ['5-02-0001'], 2, {
        separator: '-',
        digitsPerLevel: [1, 2, 4],
      }),
    ).toBe('5-02-0002');
  });

  it('pode gerar sem preenchimento de zeros', () => {
    expect(generateNextCode('1', [], 1, { padWithZeros: false })).toBe('1.1');
  });

  it('tolera irmãos com código não numérico', () => {
    expect(generateNextCode('5', ['5.CUSTOM', '5.01'], 1)).toBe('5.02');
  });
});

describe('normalizeCode', () => {
  it('remove zeros à esquerda de cada segmento', () => {
    expect(normalizeCode('05.02.001')).toBe('5.2.1');
  });

  it('trata dois códigos equivalentes como iguais', () => {
    expect(normalizeCode('5.02.001')).toBe(normalizeCode('05.2.1'));
  });

  it('descarta segmentos vazios', () => {
    expect(normalizeCode('5..02')).toBe('5.2');
  });
});

describe('assertCodeMatchesParent', () => {
  it('aceita código coerente com o pai', () => {
    expect(() => assertCodeMatchesParent('5.02.001', '5.02')).not.toThrow();
  });

  it('aceita código com zeros diferentes, mas equivalente', () => {
    expect(() => assertCodeMatchesParent('05.02.001', '5.2')).not.toThrow();
  });

  it('recusa código que não deriva do pai', () => {
    expect(() => assertCodeMatchesParent('4.01.001', '5.02')).toThrow(
      BadRequestException,
    );
  });

  it('não valida nada quando a conta é raiz', () => {
    expect(() => assertCodeMatchesParent('9', null)).not.toThrow();
  });
});

describe('levelFromCode', () => {
  it('deriva a profundidade a partir dos separadores', () => {
    expect(levelFromCode('5')).toBe(0);
    expect(levelFromCode('5.02')).toBe(1);
    expect(levelFromCode('5.02.001')).toBe(2);
  });
});
