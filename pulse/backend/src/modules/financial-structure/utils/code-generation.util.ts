import { BadRequestException } from '@nestjs/common';

/** Configuração de geração automática de código (seção 13). */
export interface CodeGenerationSettings {
  /** Separador entre os níveis. Padrão: ponto. */
  separator?: string;
  /** Quantidade de dígitos por nível. Padrão: 2 na raiz e 3 nos demais. */
  digitsPerLevel?: number[];
  /** Preenche com zeros à esquerda até atingir `digitsPerLevel`. */
  padWithZeros?: boolean;
}

const DEFAULT_SEPARATOR = '.';
const DEFAULT_DIGITS = [1, 2, 3];

/**
 * Gera o próximo código de um nível da árvore.
 *
 * Exemplo: pai `5.02` com filhos `5.02.001` e `5.02.002` produz `5.02.003`.
 * Na raiz, com irmãos `1`..`4`, produz `5`.
 *
 * A geração acontece **no back-end** para que a unicidade seja garantida no mesmo lugar
 * em que é validada (seção 13).
 */
export function generateNextCode(
  parentCode: string | null,
  siblingCodes: string[],
  level: number,
  settings: CodeGenerationSettings = {},
): string {
  const separator = settings.separator ?? DEFAULT_SEPARATOR;
  const digits =
    settings.digitsPerLevel?.[level] ??
    DEFAULT_DIGITS[level] ??
    DEFAULT_DIGITS.at(-1)!;
  const padWithZeros = settings.padWithZeros ?? true;

  const prefix = parentCode ? `${parentCode}${separator}` : '';

  // Considera apenas os irmãos que realmente pertencem a este prefixo e nível.
  const usedNumbers = siblingCodes
    .filter((code) => code.startsWith(prefix))
    .map((code) => code.slice(prefix.length))
    // Descarta netos: só interessa o segmento imediatamente após o prefixo.
    .filter((rest) => rest.length > 0 && !rest.includes(separator))
    .map((rest) => Number.parseInt(rest, 10))
    .filter((value) => Number.isFinite(value));

  const next = usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : 1;
  const segment = padWithZeros
    ? String(next).padStart(digits, '0')
    : String(next);

  return `${prefix}${segment}`;
}

/**
 * Normaliza um código para comparação e unicidade: remove separadores e zeros à
 * esquerda de cada segmento, de modo que `5.02.001` e `05.2.1` sejam reconhecidos como
 * o mesmo código e a duplicidade seja bloqueada.
 */
export function normalizeCode(
  code: string,
  separator = DEFAULT_SEPARATOR,
): string {
  return code
    .trim()
    .split(separator)
    .map((segment) => segment.replace(/^0+(?=\d)/, ''))
    .filter((segment) => segment.length > 0)
    .join(separator);
}

/** Valida que o código do filho começa com o código do pai (coerência da árvore). */
export function assertCodeMatchesParent(
  code: string,
  parentCode: string | null,
  separator = DEFAULT_SEPARATOR,
): void {
  if (!parentCode) return;

  const normalizedChild = normalizeCode(code, separator);
  const normalizedParent = normalizeCode(parentCode, separator);

  if (!normalizedChild.startsWith(`${normalizedParent}${separator}`)) {
    throw new BadRequestException(
      `O código "${code}" não é coerente com a conta superior "${parentCode}". Utilize a geração automática ou informe um código iniciado por "${parentCode}${separator}".`,
    );
  }
}

/** Profundidade implícita do código: `5.02.001` está no nível 2. */
export function levelFromCode(
  code: string,
  separator = DEFAULT_SEPARATOR,
): number {
  return Math.max(
    0,
    normalizeCode(code, separator).split(separator).length - 1,
  );
}
