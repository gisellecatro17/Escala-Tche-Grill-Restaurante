import { BoletoValidationService } from './boleto-validation.service';
import {
  buildValidBoleto,
  formatDigitableLine,
  dueDateToFactor,
} from './utils/boleto-fixture.util';

/**
 * Cenários de leitura de boletos das seções 22, 23 e 24.
 *
 * Os boletos usados aqui são gerados com dígito verificador **calculado**, não copiados de
 * documentação: as linhas digitáveis que circulam em material bancário costumam ter o DV
 * geral inconsistente, e usá-las daria a impressão de que o validador está errado.
 */
describe('BoletoValidationService', () => {
  const service = new BoletoValidationService();
  const today = new Date('2026-07-30T00:00:00Z');

  describe('linha digitável válida', () => {
    const boleto = buildValidBoleto({
      bankCode: '001',
      amount: 2450,
      dueDate: new Date('2026-08-10T00:00:00Z'),
      seed: '7',
    });

    it('aceita a linha digitável e devolve os dados embutidos', () => {
      const result = service.validate(boleto.digitableLine, { today });

      expect(result.valid).toBe(true);
      expect(result.segment).toBe('BANK');
      expect(result.bankCode).toBe('001');
      expect(result.amount).toBe(2450);
      expect(result.dueDate?.toISOString().slice(0, 10)).toBe('2026-08-10');
      expect(result.errors).toHaveLength(0);
    });

    it('aceita a mesma informação pelo código de barras', () => {
      const byBarcode = service.validate(boleto.barcode, { today });

      expect(byBarcode.valid).toBe(true);
      expect(byBarcode.amount).toBe(2450);
      expect(byBarcode.dueDate?.toISOString().slice(0, 10)).toBe('2026-08-10');
    });

    it('aceita a linha digitável formatada, como aparece impressa', () => {
      const result = service.validate(
        formatDigitableLine(boleto.digitableLine),
        { today },
      );

      expect(result.valid).toBe(true);
      expect(result.amount).toBe(2450);
    });

    it('converte entre linha digitável e código de barras nos dois sentidos', () => {
      expect(service.digitableLineToBarcode(boleto.digitableLine)).toBe(
        boleto.barcode,
      );
      expect(service.barcodeToDigitableLine(boleto.barcode)).toBe(
        boleto.digitableLine,
      );
    });

    it('registra as regras aplicadas, para a auditoria', () => {
      const result = service.validate(boleto.digitableLine, { today });

      expect(result.rulesApplied).toContain('DIGITABLE_LINE_FIELD_MODULO_10');
      expect(result.rulesApplied).toContain('BARCODE_GENERAL_MODULO_11');
    });
  });

  describe('linha digitável inválida', () => {
    const boleto = buildValidBoleto({
      amount: 100,
      dueDate: new Date('2026-08-10T00:00:00Z'),
      seed: '2',
    });

    it('recusa quando um dígito do primeiro campo é alterado', () => {
      // Troca um dígito dentro do primeiro campo, mantendo o tamanho.
      const digits = boleto.digitableLine.split('');
      digits[5] = digits[5] === '9' ? '0' : '9';
      const tampered = digits.join('');

      const result = service.validate(tampered, { today });

      expect(result.valid).toBe(false);
      expect(result.errors.join(' ')).toContain('primeiro campo');
    });

    it('recusa quando o dígito verificador geral não fecha', () => {
      // O DV geral fica na 33ª posição da linha digitável.
      const digits = boleto.digitableLine.split('');
      digits[32] = digits[32] === '9' ? '0' : '9';

      const result = service.validate(digits.join(''), { today });

      expect(result.valid).toBe(false);
      expect(result.errors.join(' ')).toContain('dígito verificador geral');
    });

    it('recusa quantidade de dígitos fora de 44, 47 ou 48', () => {
      const result = service.validate('1234567890', { today });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('quantidade de dígitos');
    });

    it('recusa entrada vazia sem lançar exceção', () => {
      const result = service.validate('', { today });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('fator de vencimento (seção 23)', () => {
    it('interpreta fatores acima de 1999 pela data-base de 1997, sem ambiguidade', () => {
      const result = service.resolveDueDateFromFactor(3000, today);

      expect(result.ruleApplied).toBe('FEBRABAN_FACTOR_BASE_1997');
      expect(result.ambiguousCandidates).toHaveLength(0);
      expect(result.dueDate?.toISOString().slice(0, 10)).toBe('2005-12-24');
    });

    it('devolve as duas datas possíveis na faixa reiniciada pela FEBRABAN', () => {
      // Fatores de 1000 a 1999 podem ser do ciclo original ou do reiniciado em 2025.
      const result = service.resolveDueDateFromFactor(1500, today);

      expect(result.ambiguousCandidates).toHaveLength(2);
      expect(
        result.ambiguousCandidates.map((date) =>
          date.toISOString().slice(0, 10),
        ),
      ).toEqual(['2001-11-15', '2026-07-07']);
    });

    it('escolhe o ciclo novo quando o antigo seria um vencimento implausível', () => {
      const result = service.resolveDueDateFromFactor(1500, today);

      expect(result.ruleApplied).toBe(
        'FEBRABAN_FACTOR_RESET_RANGE_SECOND_CYCLE',
      );
      expect(result.dueDate?.toISOString().slice(0, 10)).toBe('2026-07-07');
    });

    it('sinaliza a ambiguidade no resultado da validação, em vez de escolher em silêncio', () => {
      const boleto = buildValidBoleto({
        amount: 500,
        dueDate: new Date('2026-09-15T00:00:00Z'),
        seed: '4',
      });

      const result = service.validate(boleto.digitableLine, { today });

      expect(result.ambiguousDueDate).toBe(true);
      expect(result.warnings.join(' ')).toContain('duas datas possíveis');
    });

    it('recusa fator fora da faixa de quatro dígitos', () => {
      expect(service.resolveDueDateFromFactor(0, today).ruleApplied).toBe(
        'FACTOR_OUT_OF_RANGE',
      );
      expect(
        service.resolveDueDateFromFactor(10_000, today).dueDate,
      ).toBeNull();
    });

    it('o fator de uma data de 2026 cabe em quatro dígitos', () => {
      // Sem descontar o ciclo, 2026 daria 10.534 dias — cinco dígitos.
      expect(
        dueDateToFactor(new Date('2026-08-10T00:00:00Z')),
      ).toBeLessThanOrEqual(9999);
    });
  });

  describe('comparação com o que o usuário informou (seção 24)', () => {
    it('aponta divergência de valor', () => {
      const comparison = service.compare(
        { amount: 2450, dueDate: new Date('2026-08-10') },
        { amount: 2500, dueDate: new Date('2026-08-10') },
      );

      expect(comparison.matches).toBe(false);
      expect(comparison.differences).toEqual([
        { field: 'amount', fromDocument: '2450.00', informed: '2500.00' },
      ]);
    });

    it('aponta divergência de vencimento', () => {
      const comparison = service.compare(
        { dueDate: new Date('2026-08-10') },
        { dueDate: new Date('2026-08-15') },
      );

      expect(comparison.differences[0].field).toBe('dueDate');
    });

    it('ignora diferença de formatação na linha digitável', () => {
      const boleto = buildValidBoleto({
        amount: 100,
        dueDate: new Date('2026-08-10T00:00:00Z'),
        seed: '3',
      });

      const comparison = service.compare(
        { digitableLine: boleto.digitableLine },
        { digitableLine: formatDigitableLine(boleto.digitableLine) },
      );

      expect(comparison.matches).toBe(true);
    });

    it('não acusa divergência quando o usuário não informou nada', () => {
      const comparison = service.compare({ amount: 2450 }, { amount: null });

      expect(comparison.matches).toBe(true);
    });
  });

  describe('conta de consumo (concessionária)', () => {
    it('reconhece o segmento pelo primeiro dígito 8', () => {
      // 44 dígitos começando com 8: bloco de concessionária.
      const result = service.validate(`8${'1'.repeat(43)}`);

      expect(result.segment).toBe('UTILITY');
    });

    it('avisa que o vencimento não vem no código', () => {
      const result = service.validate(`8${'1'.repeat(43)}`);

      expect(result.warnings.join(' ')).toContain('não trazem o vencimento');
      expect(result.dueDate).toBeNull();
    });

    it('recusa quantidade de dígitos inválida para concessionária', () => {
      const result = service.validate(`8${'1'.repeat(40)}`);

      expect(result.valid).toBe(false);
      expect(result.errors.join(' ')).toContain('conta de consumo');
    });
  });

  describe('normalização', () => {
    it('remove qualquer caractere que não seja dígito', () => {
      expect(service.normalize('00190.50095 40144.816069')).toBe(
        '001905009540144816069',
      );
      expect(service.normalize(null)).toBe('');
    });
  });
});
