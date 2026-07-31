import { BadRequestException } from '@nestjs/common';
import { StructureImportFormat } from '@prisma/client';
import ExcelJS from 'exceljs';

/** Campos internos que a importação sabe preencher (seção 44). */
export const IMPORT_FIELDS = [
  'code',
  'name',
  'parentCode',
  'type',
  'notes',
  'shortName',
  'accountType',
  'financialNature',
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];

/** Rótulos exibidos na etapa de mapeamento de colunas. */
export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  code: 'Código',
  name: 'Nome / descrição',
  parentCode: 'Código do registro superior',
  type: 'Tipo',
  notes: 'Observações',
  shortName: 'Nome curto',
  accountType: 'Natureza da conta',
  financialNature: 'Natureza financeira',
};

/** Campos sem os quais a importação não tem como criar um registro. */
export const REQUIRED_IMPORT_FIELDS: ImportField[] = ['code', 'name'];

/**
 * Cabeçalhos reconhecidos automaticamente por campo. Os "modelos de ERP" não são
 * integrações: apenas mapeiam nomes de coluna diferentes para o mesmo formato interno.
 */
const COLUMN_ALIASES: Record<ImportField, string[]> = {
  code: ['codigo', 'code', 'conta', 'cod', 'classificacao', 'codigo_reduzido'],
  name: [
    'nome',
    'descricao',
    'name',
    'description',
    'titulo',
    'conta_descricao',
  ],
  parentCode: [
    'codigo_pai',
    'conta_pai',
    'parent',
    'parent_code',
    'pai',
    'superior',
    'codigo_superior',
  ],
  type: ['tipo', 'type', 'grupo', 'especie'],
  notes: ['observacoes', 'notes', 'obs', 'observacao'],
  shortName: ['nome_curto', 'apelido', 'short_name', 'reduzido'],
  accountType: ['natureza_conta', 'account_type', 'tipo_conta', 'd_c'],
  financialNature: ['natureza', 'natureza_financeira', 'nature'],
};

/**
 * Converte um valor de célula/JSON em texto. Objetos viram string vazia em vez de
 * `[object Object]`, que entraria no cadastro como se fosse um nome válido.
 */
function primitiveToText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return '';
}

export interface ParsedFile {
  /** Cabeçalhos exatamente como vieram do arquivo. */
  headers: string[];
  /** Linhas com as chaves originais, na ordem do arquivo. */
  rows: Record<string, string>[];
}

/** Remove acentos e uniformiza separadores, para comparar cabeçalhos. */
export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Mapeamento sugerido na etapa 3 do assistente: campo interno → cabeçalho do arquivo.
 * O usuário confirma ou corrige antes de validar, então um palpite errado não vira dado
 * errado.
 */
export function suggestMapping(
  headers: string[],
): Partial<Record<ImportField, string>> {
  const normalized = headers.map((header) => ({
    original: header,
    normalized: normalizeHeader(header),
  }));

  const mapping: Partial<Record<ImportField, string>> = {};
  const used = new Set<string>();

  for (const field of IMPORT_FIELDS) {
    const match = normalized.find(
      (header) =>
        !used.has(header.original) &&
        COLUMN_ALIASES[field].includes(header.normalized),
    );
    if (match) {
      mapping[field] = match.original;
      used.add(match.original);
    }
  }

  return mapping;
}

/** Deduz o formato pelo nome do arquivo, para o usuário não precisar informar. */
export function detectFormat(fileName?: string): StructureImportFormat {
  const extension = fileName?.toLowerCase().split('.').pop();

  if (extension === 'xlsx' || extension === 'xlsm') {
    return StructureImportFormat.XLSX;
  }
  if (extension === 'xls') return StructureImportFormat.EXCEL;
  if (extension === 'json') return StructureImportFormat.JSON;
  return StructureImportFormat.CSV;
}

const MAX_ROWS = 20_000;

/**
 * Converte o arquivo enviado em cabeçalhos + linhas. Suporta XLSX (via exceljs), CSV/TSV
 * com aspas e JSON (array de objetos).
 */
export async function parseStructureFile(
  buffer: Buffer,
  format: StructureImportFormat,
  fileName?: string,
): Promise<ParsedFile> {
  const effective =
    format === StructureImportFormat.CUSTOM ? detectFormat(fileName) : format;

  if (
    effective === StructureImportFormat.XLSX ||
    effective === StructureImportFormat.EXCEL
  ) {
    return parseXlsx(buffer);
  }

  // Remove o BOM UTF-8 (U+FEFF), que grudaria no primeiro cabeçalho.
  const text = buffer.toString('utf-8').replace(/^\ufeff/, '');

  if (effective === StructureImportFormat.JSON) return parseJson(text);
  return parseDelimited(text);
}

async function parseXlsx(buffer: Buffer): Promise<ParsedFile> {
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new BadRequestException(
      'Não foi possível ler a planilha. Verifique se o arquivo é um .xlsx válido.',
    );
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new BadRequestException('A planilha enviada não possui nenhuma aba.');
  }

  const cellText = (cell: ExcelJS.Cell): string => {
    const value = cell.value;
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (typeof value === 'object') {
      // Fórmulas e rich text guardam o texto exibido em `result`/`richText`.
      if ('richText' in value) {
        return value.richText.map((part) => part.text).join('');
      }
      if ('result' in value) return primitiveToText(value.result);
      if ('text' in value) return primitiveToText(value.text);
      return '';
    }
    return primitiveToText(value);
  };

  const rowsOfCells: string[][] = [];
  sheet.eachRow((row) => {
    const cells: string[] = [];
    // `row.eachCell` pula células vazias; o índice mantém as colunas alinhadas.
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cells[colNumber - 1] = cellText(cell);
    });
    rowsOfCells.push(cells);
  });

  const nonEmpty = rowsOfCells.filter((cells) =>
    cells.some((cell) => (cell ?? '').trim().length > 0),
  );

  return buildParsedFile(nonEmpty);
}

function parseJson(text: string): ParsedFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BadRequestException('O arquivo JSON enviado não é válido.');
  }

  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { rows?: unknown }).rows)
      ? (parsed as { rows: unknown[] }).rows
      : null;

  if (!list) {
    throw new BadRequestException(
      'O JSON precisa ser uma lista de objetos ou um objeto com a propriedade "rows".',
    );
  }

  if (list.length === 0) {
    throw new BadRequestException(
      'O arquivo não contém nenhuma linha de dados.',
    );
  }

  // A união das chaves cobre objetos que omitem campos vazios.
  const headers: string[] = [];
  for (const item of list) {
    for (const key of Object.keys(item as Record<string, unknown>)) {
      if (!headers.includes(key)) headers.push(key);
    }
  }

  const rows = list.slice(0, MAX_ROWS).map((item) => {
    const source = item as Record<string, unknown>;
    return Object.fromEntries(
      headers.map((header) => [header, primitiveToText(source[header])]),
    );
  });

  return { headers, rows };
}

function parseDelimited(text: string): ParsedFile {
  const lines = splitLines(text);

  if (lines.length === 0) {
    throw new BadRequestException('O arquivo enviado está vazio.');
  }

  const delimiter = detectDelimiter(lines[0]);
  const cells = lines.map((line) => splitCsvLine(line, delimiter));

  return buildParsedFile(cells);
}

/** Quebra em linhas respeitando quebras dentro de campos entre aspas. */
function splitLines(text: string): string[] {
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '""';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      current += char;
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      if (current.trim().length > 0) lines.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim().length > 0) lines.push(current);
  return lines;
}

function detectDelimiter(headerLine: string): string {
  if (headerLine.includes('\t')) return '\t';
  // Conta fora das aspas: um nome como "Aluguel, energia" não define o separador.
  const count = (delimiter: string) =>
    splitCsvLine(headerLine, delimiter).length;
  return count(';') > count(',') ? ';' : ',';
}

/** Divide uma linha respeitando aspas e aspas duplicadas (`""` = literal). */
function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

/** Primeira linha = cabeçalho; as demais viram objetos com essas chaves. */
function buildParsedFile(cells: string[][]): ParsedFile {
  if (cells.length < 2) {
    throw new BadRequestException(
      'O arquivo precisa conter um cabeçalho e ao menos uma linha de dados.',
    );
  }

  const headers = cells[0].map((header, index) =>
    (header ?? '').trim().length > 0 ? header.trim() : `Coluna ${index + 1}`,
  );

  const rows = cells
    .slice(1, MAX_ROWS + 1)
    .map((row) =>
      Object.fromEntries(
        headers.map((header, index) => [header, (row[index] ?? '').trim()]),
      ),
    );

  return { headers, rows };
}
