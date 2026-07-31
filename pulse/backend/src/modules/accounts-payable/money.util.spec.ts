import { cents, clampToZero, fromCents, split, sum } from './money.util';

describe('Aritmética de dinheiro', () => {
  it('soma sem o erro do ponto flutuante', () => {
    // 0.1 + 0.2 em ponto flutuante dá 0.30000000000000004, e um saldo assim nunca zera.
    expect(sum([0.1, 0.2])).toBe(0.3);
    expect(sum([1234.56, 7890.12, 0.32])).toBe(9125);
  });

  it('converte Decimal, número e texto para centavos', () => {
    expect(cents('1250.75')).toBe(125075);
    expect(cents(1250.75)).toBe(125075);
    expect(cents(null)).toBe(0);
    expect(cents(undefined)).toBe(0);
  });

  it('arredonda ao voltar de centavos', () => {
    expect(fromCents(125075)).toBe(1250.75);
    expect(fromCents(1)).toBe(0.01);
  });

  it('não deixa saldo negativo', () => {
    expect(clampToZero(-0.01)).toBe(0);
    expect(clampToZero(10)).toBe(10);
  });

  describe('divisão em partes', () => {
    it('joga a sobra do arredondamento na última parte', () => {
      const parts = split(100, 3);

      expect(parts).toEqual([33.33, 33.33, 33.34]);
      expect(sum(parts)).toBe(100);
    });

    it('fecha exatamente com o total em qualquer quantidade', () => {
      for (const count of [1, 2, 5, 7, 12, 13]) {
        expect(sum(split(1000.01, count))).toBe(1000.01);
      }
    });

    it('trata contagem inválida como uma parte só', () => {
      expect(split(50, 0)).toEqual([50]);
    });
  });
});
