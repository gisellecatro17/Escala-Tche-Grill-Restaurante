import { Injectable } from '@nestjs/common';

/**
 * Interpretação e validação de boletos (seções 22, 23 e 24).
 *
 * Isolado em um serviço próprio, e não espalhado pelo front-end, por dois motivos: as
 * regras bancárias mudam (o fator de vencimento já foi reiniciado uma vez) e o resultado
 * precisa ser auditável — cada validação registra qual regra aplicou.
 *
 * Este serviço **apenas interpreta e valida**. Não agenda, não envia ao banco, não paga.
 */

/** Data-base do fator de vencimento definida pela FEBRABAN. */
const BASE_DATE = Date.UTC(1997, 9, 7); // 07/10/1997
const MILLISECONDS_PER_DAY = 86_400_000;

/**
 * O fator tem 4 dígitos, então "estoura" em 9999 (21/02/2025) e reinicia em 1000. Um
 * fator de 1000 a 1999 lido hoje pode significar duas datas: 1997+fator ou o ciclo novo.
 * Tratamos isso explicitamente em vez de escolher em silêncio.
 */
const FACTOR_RESET_VALUE = 1000;
const FACTOR_MAXIMUM = 9999;
/** Dias acumulados até o fator estourar: 9999 - 1000 + 1. */
const FACTOR_CYCLE_DAYS = 9000;

export type BoletoSegment = 'BANK' | 'UTILITY';

export interface BoletoDueDateResult {
  factor: number;
  dueDate: Date | null;
  /** Quando o mesmo fator admite mais de uma data, todas aparecem aqui. */
  ambiguousCandidates: Date[];
  /** Identificação da regra aplicada, guardada na auditoria. */
  ruleApplied: string;
}

export interface BoletoValidationResult {
  valid: boolean;
  segment: BoletoSegment | null;
  /** Código de barras de 44 dígitos, sempre normalizado. */
  barcode: string | null;
  /** Linha digitável de 47 (bancário) ou 48 (concessionária) dígitos. */
  digitableLine: string | null;
  bankCode: string | null;
  currencyCode: string | null;
  amount: number | null;
  dueDate: Date | null;
  dueDateFactor: number | null;
  ambiguousDueDate: boolean;
  ambiguousCandidates: Date[];
  freeField: string | null;
  errors: string[];
  warnings: string[];
  /** Regras efetivamente aplicadas — a trilha de como o resultado foi obtido. */
  rulesApplied: string[];
}

export interface BoletoComparisonResult {
  matches: boolean;
  differences: {
    field: string;
    fromDocument: string | null;
    informed: string | null;
  }[];
}

@Injectable()
export class BoletoValidationService {
  /** Remove tudo que não é dígito. `1234.5` e `12345` passam a ser comparáveis. */
  normalize(value: string | null | undefined): string {
    return (value ?? '').replace(/\D/g, '');
  }

  // ── Fator de vencimento (seção 23) ────────────────────────────────────────

  /**
   * Converte o fator de vencimento em data.
   *
   * A ambiguidade é real e não pode ser escondida: fatores de 1000 a 1999 podem ser do
   * ciclo original (1997 + fator dias) ou do ciclo reiniciado em 22/02/2025. Devolvemos
   * as duas datas e deixamos a decisão para a revisão humana.
   */
  resolveDueDateFromFactor(
    factor: number,
    today = new Date(),
  ): BoletoDueDateResult {
    if (!Number.isInteger(factor) || factor <= 0 || factor > FACTOR_MAXIMUM) {
      return {
        factor,
        dueDate: null,
        ambiguousCandidates: [],
        ruleApplied: 'FACTOR_OUT_OF_RANGE',
      };
    }

    const firstCycle = new Date(BASE_DATE + factor * MILLISECONDS_PER_DAY);
    const secondCycle = new Date(
      BASE_DATE + (factor + FACTOR_CYCLE_DAYS) * MILLISECONDS_PER_DAY,
    );

    // Fatores acima de 1999 só existem no primeiro ciclo — não há o que decidir.
    if (factor >= 2000) {
      return {
        factor,
        dueDate: firstCycle,
        ambiguousCandidates: [],
        ruleApplied: 'FEBRABAN_FACTOR_BASE_1997',
      };
    }

    // Na faixa reiniciada, um vencimento no passado distante é implausível: preferimos o
    // ciclo novo, mas registramos a alternativa.
    const isFirstCyclePlausible =
      firstCycle.getTime() >= today.getTime() - 365 * MILLISECONDS_PER_DAY;

    return {
      factor,
      dueDate: isFirstCyclePlausible ? firstCycle : secondCycle,
      ambiguousCandidates: [firstCycle, secondCycle],
      ruleApplied: isFirstCyclePlausible
        ? 'FEBRABAN_FACTOR_RESET_RANGE_FIRST_CYCLE'
        : 'FEBRABAN_FACTOR_RESET_RANGE_SECOND_CYCLE',
    };
  }

  // ── Dígitos verificadores ─────────────────────────────────────────────────

  /** Módulo 11 com pesos 2..9 da direita para a esquerda (DV do código de barras). */
  private modulo11(digits: string): number {
    let weight = 2;
    let sum = 0;

    for (let index = digits.length - 1; index >= 0; index -= 1) {
      sum += Number(digits[index]) * weight;
      weight = weight === 9 ? 2 : weight + 1;
    }

    const remainder = sum % 11;
    const digit = 11 - remainder;
    // Por convenção da FEBRABAN, 0, 10 e 11 viram 1.
    return digit === 0 || digit > 9 ? 1 : digit;
  }

  /** Módulo 10 (DV dos campos da linha digitável e das concessionárias). */
  private modulo10(digits: string): number {
    let sum = 0;
    let multiplier = 2;

    for (let index = digits.length - 1; index >= 0; index -= 1) {
      const product = Number(digits[index]) * multiplier;
      sum += product > 9 ? product - 9 : product;
      multiplier = multiplier === 2 ? 1 : 2;
    }

    return (10 - (sum % 10)) % 10;
  }

  /** Módulo 11 base 10 usado pelo bloco de concessionária. */
  private modulo11Utility(digits: string): number {
    let weight = 2;
    let sum = 0;

    for (let index = digits.length - 1; index >= 0; index -= 1) {
      sum += Number(digits[index]) * weight;
      weight = weight === 9 ? 2 : weight + 1;
    }

    const remainder = sum % 11;
    if (remainder === 0) return 0;
    if (remainder === 1) return 1;
    return 11 - remainder;
  }

  // ── Conversões ────────────────────────────────────────────────────────────

  /**
   * Converte a linha digitável bancária (47 dígitos) no código de barras (44).
   *
   * A ordem dos campos muda entre os dois formatos — é justamente por isso que comparar
   * "linha digitável x código de barras" pega erro de digitação que uma comparação
   * ingênua deixaria passar.
   */
  digitableLineToBarcode(digitableLine: string): string | null {
    const digits = this.normalize(digitableLine);
    if (digits.length !== 47) return null;

    const bankAndCurrency = digits.slice(0, 4);
    const freeField1 = digits.slice(4, 9);
    const freeField2 = digits.slice(10, 20);
    const freeField3 = digits.slice(21, 31);
    const generalCheckDigit = digits.slice(32, 33);
    const factorAndAmount = digits.slice(33, 47);

    return `${bankAndCurrency}${generalCheckDigit}${factorAndAmount}${freeField1}${freeField2}${freeField3}`;
  }

  /** Converte o código de barras bancário (44 dígitos) na linha digitável (47). */
  barcodeToDigitableLine(barcode: string): string | null {
    const digits = this.normalize(barcode);
    if (digits.length !== 44) return null;

    const bank = digits.slice(0, 3);
    const currency = digits.slice(3, 4);
    const generalCheckDigit = digits.slice(4, 5);
    const factorAndAmount = digits.slice(5, 19);
    const freeField = digits.slice(19, 44);

    const field1 = `${bank}${currency}${freeField.slice(0, 5)}`;
    const field2 = freeField.slice(5, 15);
    const field3 = freeField.slice(15, 25);

    return (
      `${field1}${this.modulo10(field1)}` +
      `${field2}${this.modulo10(field2)}` +
      `${field3}${this.modulo10(field3)}` +
      `${generalCheckDigit}${factorAndAmount}`
    );
  }

  // ── Validação ─────────────────────────────────────────────────────────────

  /**
   * Valida um código de barras ou linha digitável e devolve os dados embutidos.
   *
   * Aceita qualquer um dos dois formatos e reconstrói o outro, para que a divergência
   * entre eles seja detectável. Nunca lança: o resultado carrega os erros, porque um
   * boleto inválido é um caso de negócio (pendência), não uma exceção.
   */
  validate(
    input: string,
    options: { today?: Date } = {},
  ): BoletoValidationResult {
    const digits = this.normalize(input);
    const errors: string[] = [];
    const warnings: string[] = [];
    const rulesApplied: string[] = [];

    const empty: BoletoValidationResult = {
      valid: false,
      segment: null,
      barcode: null,
      digitableLine: null,
      bankCode: null,
      currencyCode: null,
      amount: null,
      dueDate: null,
      dueDateFactor: null,
      ambiguousDueDate: false,
      ambiguousCandidates: [],
      freeField: null,
      errors,
      warnings,
      rulesApplied,
    };

    if (digits.length === 0) {
      errors.push('Informe o código de barras ou a linha digitável.');
      return empty;
    }

    // Concessionárias começam com 8 e têm 44 (código) ou 48 (linha) dígitos.
    const isUtility = digits.startsWith('8');

    if (isUtility) {
      return this.validateUtility(digits, { errors, warnings, rulesApplied });
    }

    if (![44, 47].includes(digits.length)) {
      errors.push(
        `A quantidade de dígitos é inválida: foram informados ${digits.length}, e o esperado é 44 (código de barras) ou 47 (linha digitável).`,
      );
      return empty;
    }

    let barcode: string;
    let digitableLine: string;

    if (digits.length === 47) {
      rulesApplied.push('INPUT_AS_DIGITABLE_LINE_47');
      // Os três campos da linha digitável têm DV próprio de módulo 10.
      const fields = [
        { label: 'primeiro', value: digits.slice(0, 9), check: digits[9] },
        { label: 'segundo', value: digits.slice(10, 20), check: digits[20] },
        { label: 'terceiro', value: digits.slice(21, 31), check: digits[31] },
      ];

      for (const field of fields) {
        const expected = this.modulo10(field.value);
        if (String(expected) !== field.check) {
          errors.push(
            `A linha digitável informada possui divergência no dígito verificador do ${field.label} campo.`,
          );
        }
      }
      rulesApplied.push('DIGITABLE_LINE_FIELD_MODULO_10');

      const converted = this.digitableLineToBarcode(digits);
      if (!converted) {
        errors.push(
          'Não foi possível interpretar a linha digitável informada.',
        );
        return empty;
      }
      barcode = converted;
      digitableLine = digits;
    } else {
      rulesApplied.push('INPUT_AS_BARCODE_44');
      barcode = digits;
      digitableLine = this.barcodeToDigitableLine(digits) ?? '';
    }

    // DV geral do código de barras: módulo 11 sobre os 43 dígitos, com o DV na 5ª casa.
    const withoutCheckDigit = `${barcode.slice(0, 4)}${barcode.slice(5, 44)}`;
    const expectedGeneral = this.modulo11(withoutCheckDigit);
    if (String(expectedGeneral) !== barcode[4]) {
      errors.push(
        'O código de barras possui divergência no dígito verificador geral.',
      );
    }
    rulesApplied.push('BARCODE_GENERAL_MODULO_11');

    const bankCode = barcode.slice(0, 3);
    const currencyCode = barcode.slice(3, 4);
    if (currencyCode !== '9') {
      warnings.push(
        `O código de moeda do boleto é ${currencyCode}, e não 9 (real) — confira o documento.`,
      );
    }

    const factor = Number(barcode.slice(5, 9));
    const amountDigits = barcode.slice(9, 19);
    const amount = Number(amountDigits) / 100;

    const dueDateResult = this.resolveDueDateFromFactor(factor, options.today);
    rulesApplied.push(dueDateResult.ruleApplied);

    if (factor === 0) {
      warnings.push(
        'O boleto não traz fator de vencimento — o vencimento precisa ser informado manualmente.',
      );
    }

    const ambiguous =
      factor >= FACTOR_RESET_VALUE &&
      factor < 2000 &&
      dueDateResult.ambiguousCandidates.length > 1;

    if (ambiguous) {
      warnings.push(
        'O fator de vencimento está na faixa reiniciada pela FEBRABAN e admite duas datas possíveis. Confira o vencimento impresso no documento.',
      );
    }

    if (amount === 0) {
      warnings.push(
        'O valor não está embutido no código — trata-se de boleto com valor em aberto.',
      );
    }

    return {
      valid: errors.length === 0,
      segment: 'BANK',
      barcode,
      digitableLine: digitableLine || null,
      bankCode,
      currencyCode,
      amount: amount > 0 ? amount : null,
      dueDate: dueDateResult.dueDate,
      dueDateFactor: factor,
      ambiguousDueDate: ambiguous,
      ambiguousCandidates: ambiguous ? dueDateResult.ambiguousCandidates : [],
      freeField: barcode.slice(19, 44),
      errors,
      warnings,
      rulesApplied,
    };
  }

  /**
   * Valida o bloco de concessionária (guias de água, luz, tributos).
   *
   * O DV muda conforme o 3º dígito: valor efetivo em reais usa módulo 10, os demais
   * indicadores usam módulo 11.
   */
  private validateUtility(
    digits: string,
    context: { errors: string[]; warnings: string[]; rulesApplied: string[] },
  ): BoletoValidationResult {
    const { errors, warnings, rulesApplied } = context;
    rulesApplied.push('UTILITY_SEGMENT');

    if (![44, 48].includes(digits.length)) {
      errors.push(
        `A quantidade de dígitos é inválida para conta de consumo: foram informados ${digits.length}, e o esperado é 44 ou 48.`,
      );
      return {
        valid: false,
        segment: 'UTILITY',
        barcode: null,
        digitableLine: null,
        bankCode: null,
        currencyCode: null,
        amount: null,
        dueDate: null,
        dueDateFactor: null,
        ambiguousDueDate: false,
        ambiguousCandidates: [],
        freeField: null,
        errors,
        warnings,
        rulesApplied,
      };
    }

    // A linha de 48 dígitos são 4 blocos de 11 (10 dados + 1 DV); o código é a
    // concatenação dos 44 dígitos de dados.
    let barcode: string;
    let digitableLine: string | null;

    if (digits.length === 48) {
      // 48 dígitos = 4 blocos de 12, cada um com 11 dígitos de dados + 1 DV.
      const blocks = [0, 1, 2, 3].map((index) =>
        digits.slice(index * 12, index * 12 + 12),
      );
      barcode = blocks.map((block) => block.slice(0, 11)).join('');
      digitableLine = digits;
      const useModulo10 = barcode[2] === '6' || barcode[2] === '7';
      for (const [index, block] of blocks.entries()) {
        const data = block.slice(0, 11);
        const expected = useModulo10
          ? this.modulo10(data)
          : this.modulo11Utility(data);
        if (String(expected) !== block[11]) {
          errors.push(
            `A linha digitável possui divergência no dígito verificador do bloco ${index + 1}.`,
          );
        }
      }
      rulesApplied.push(
        useModulo10 ? 'UTILITY_BLOCK_MODULO_10' : 'UTILITY_BLOCK_MODULO_11',
      );
    } else {
      barcode = digits;
      digitableLine = null;
    }

    const currencyIndicator = barcode[2];
    const useModulo10 = currencyIndicator === '6' || currencyIndicator === '7';
    const withoutCheckDigit = `${barcode.slice(0, 3)}${barcode.slice(4, 44)}`;
    const expectedGeneral = useModulo10
      ? this.modulo10(withoutCheckDigit)
      : this.modulo11Utility(withoutCheckDigit);

    if (String(expectedGeneral) !== barcode[3]) {
      errors.push(
        'O código de barras da conta de consumo possui divergência no dígito verificador geral.',
      );
    }
    rulesApplied.push(
      useModulo10 ? 'UTILITY_GENERAL_MODULO_10' : 'UTILITY_GENERAL_MODULO_11',
    );

    const amount = Number(barcode.slice(4, 15)) / 100;

    // Conta de consumo não carrega fator de vencimento: a data vem do corpo do documento.
    warnings.push(
      'Contas de consumo não trazem o vencimento no código — informe a data manualmente.',
    );

    return {
      valid: errors.length === 0,
      segment: 'UTILITY',
      barcode,
      digitableLine,
      bankCode: null,
      currencyCode: currencyIndicator,
      amount: amount > 0 ? amount : null,
      dueDate: null,
      dueDateFactor: null,
      ambiguousDueDate: false,
      ambiguousCandidates: [],
      freeField: barcode.slice(15, 44),
      errors,
      warnings,
      rulesApplied,
    };
  }

  /**
   * Compara o que foi lido do documento com o que o usuário informou (seções 22 e 24).
   *
   * Divergência não é bloqueio automático aqui: é informação para a revisão decidir. Quem
   * bloqueia é a regra de pendência.
   */
  compare(
    fromDocument: {
      barcode?: string | null;
      digitableLine?: string | null;
      amount?: number | null;
      dueDate?: Date | null;
    },
    informed: {
      barcode?: string | null;
      digitableLine?: string | null;
      amount?: number | null;
      dueDate?: Date | null;
    },
  ): BoletoComparisonResult {
    const differences: BoletoComparisonResult['differences'] = [];

    const compareDigits = (
      field: string,
      a?: string | null,
      b?: string | null,
    ) => {
      const left = this.normalize(a);
      const right = this.normalize(b);
      if (left && right && left !== right) {
        differences.push({ field, fromDocument: left, informed: right });
      }
    };

    compareDigits('barcode', fromDocument.barcode, informed.barcode);
    compareDigits(
      'digitableLine',
      fromDocument.digitableLine,
      informed.digitableLine,
    );

    if (
      fromDocument.amount != null &&
      informed.amount != null &&
      Math.abs(fromDocument.amount - informed.amount) > 0.001
    ) {
      differences.push({
        field: 'amount',
        fromDocument: fromDocument.amount.toFixed(2),
        informed: informed.amount.toFixed(2),
      });
    }

    if (fromDocument.dueDate && informed.dueDate) {
      const left = fromDocument.dueDate.toISOString().slice(0, 10);
      const right = informed.dueDate.toISOString().slice(0, 10);
      if (left !== right) {
        differences.push({
          field: 'dueDate',
          fromDocument: left,
          informed: right,
        });
      }
    }

    return { matches: differences.length === 0, differences };
  }
}
