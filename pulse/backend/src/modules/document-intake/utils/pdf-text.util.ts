import { inflateSync, unzipSync } from 'node:zlib';

/**
 * Extração do texto **nativo** de um PDF (regra 1 da seção 20).
 *
 * Boleto e nota fiscal gerados por sistema trazem o texto embutido: ler esse texto é
 * exato, instantâneo e gratuito, enquanto OCR é aproximado, lento e pago. Por isso a
 * ordem do prompt é clara — OCR só entra quando não há texto.
 *
 * Implementado sobre o `zlib` do próprio Node, sem dependência externa. Cobre PDFs com
 * streams `FlateDecode` e codificação padrão, que é o caso dos documentos emitidos por
 * bancos e ERPs. Para PDFs com fontes CID e mapeamento `ToUnicode` próprio, o texto sai
 * incompleto — e é justamente aí que `hasUsefulText` devolve `false` e o pipeline manda
 * para o OCR, em vez de entregar texto truncado como se estivesse completo.
 */

/**
 * Abaixo disto o texto encontrado é ruído (marca d'água de digitalizador, rodapé) e não
 * conteúdo — o documento precisa ir para o OCR.
 *
 * Um limiar sozinho não resolve: um PDF escaneado com a marca "Digitalizado por X"
 * passaria por "tem texto nativo" e perderia todo o conteúdo real. Por isso o resultado
 * também expõe `characterCount`, e o pipeline reavalia — se o texto nativo existe mas não
 * produz nenhum campo aproveitável, o documento é escalado para OCR de qualquer forma.
 */
const MINIMUM_USEFUL_CHARACTERS = 20;

interface PdfStream {
  dictionary: string;
  data: Buffer;
}

/** Localiza os streams do arquivo e devolve os que forem descomprimíveis. */
function extractStreams(buffer: Buffer): PdfStream[] {
  const streams: PdfStream[] = [];
  const latin = buffer.toString('latin1');
  const pattern = /stream\r?\n?/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(latin)) !== null) {
    const start = match.index + match[0].length;
    const end = latin.indexOf('endstream', start);
    if (end === -1) continue;

    // O dicionário do objeto vem imediatamente antes da palavra `stream`.
    const dictionaryStart = latin.lastIndexOf('<<', match.index);
    const dictionary =
      dictionaryStart === -1 ? '' : latin.slice(dictionaryStart, match.index);

    const raw = buffer.subarray(start, end);

    if (/\/FlateDecode/.test(dictionary)) {
      const inflated = tryInflate(raw);
      if (inflated) streams.push({ dictionary, data: inflated });
      continue;
    }

    // Stream sem filtro: o conteúdo já está em claro.
    if (!/\/Filter/.test(dictionary)) {
      streams.push({ dictionary, data: raw });
    }
  }

  return streams;
}

function tryInflate(raw: Buffer): Buffer | null {
  // Streams costumam vir com um `\r\n` sobrando na borda; tentamos algumas janelas antes
  // de desistir, em vez de descartar o stream inteiro por um byte de diferença.
  const candidates = [raw, raw.subarray(1), raw.subarray(0, raw.length - 1), raw.subarray(1, raw.length - 1)];

  for (const candidate of candidates) {
    if (candidate.length === 0) continue;
    try {
      return inflateSync(candidate);
    } catch {
      try {
        return unzipSync(candidate);
      } catch {
        // Segue para a próxima janela.
      }
    }
  }

  return null;
}

/** Converte uma string PDF com escapes (`\(`, `\n`, `\251`) em texto. */
function decodePdfString(raw: string): string {
  let result = '';

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];

    if (char !== '\\') {
      result += char;
      continue;
    }

    const next = raw[index + 1];
    index += 1;

    switch (next) {
      case 'n':
        result += '\n';
        break;
      case 'r':
        result += '\r';
        break;
      case 't':
        result += '\t';
        break;
      case 'b':
      case 'f':
        result += ' ';
        break;
      case '(':
      case ')':
      case '\\':
        result += next;
        break;
      default:
        if (next >= '0' && next <= '7') {
          // Escape octal: até três dígitos.
          const octal = raw.slice(index, index + 3).match(/^[0-7]{1,3}/)?.[0] ?? next;
          index += octal.length - 1;
          result += String.fromCharCode(parseInt(octal, 8));
        } else {
          result += next ?? '';
        }
    }
  }

  return result;
}

/** Extrai o texto dos operadores `Tj`, `TJ`, `'` e `"` de um stream de conteúdo. */
function textFromContentStream(content: string): string {
  const pieces: string[] = [];

  // Strings entre parênteses, respeitando escapes.
  const stringPattern = /\((?:[^()\\]|\\.)*\)/g;
  // Arrays do operador TJ, que intercalam strings e deslocamentos.
  const arrayPattern = /\[((?:[^[\]\\]|\\.)*)\]\s*TJ/g;

  let match: RegExpExecArray | null;
  while ((match = arrayPattern.exec(content)) !== null) {
    const inner = match[1];
    const parts = inner.match(stringPattern) ?? [];
    pieces.push(parts.map((part) => decodePdfString(part.slice(1, -1))).join(''));
  }

  // Operadores que recebem uma única string.
  const singlePattern = /(\((?:[^()\\]|\\.)*\))\s*(Tj|'|")/g;
  while ((match = singlePattern.exec(content)) !== null) {
    pieces.push(decodePdfString(match[1].slice(1, -1)));
  }

  // Hexadecimal: `<0041>Tj`.
  const hexPattern = /<([0-9A-Fa-f\s]+)>\s*(Tj|TJ)/g;
  while ((match = hexPattern.exec(content)) !== null) {
    const hex = match[1].replace(/\s+/g, '');
    let decoded = '';
    // Pares de bytes = Latin-1; quartetos = UTF-16BE. Tentamos o mais comum.
    const step = hex.length % 4 === 0 && hex.length > 2 ? 4 : 2;
    for (let index = 0; index + step <= hex.length; index += step) {
      const code = parseInt(hex.slice(index, index + step), 16);
      if (code > 0) decoded += String.fromCharCode(code);
    }
    pieces.push(decoded);
  }

  return pieces.join(' ');
}

export interface PdfTextResult {
  text: string;
  /** Quantidade de streams de conteúdo que puderam ser lidos. */
  streamsRead: number;
  /** Caracteres não brancos extraídos — deixa o pipeline decidir com número, não com booleano. */
  characterCount: number;
  /** `true` quando há texto suficiente para uma primeira tentativa sem OCR. */
  hasUsefulText: boolean;
}

/** Extrai todo o texto legível de um PDF. Nunca lança: PDF ilegível devolve texto vazio. */
export function extractPdfText(buffer: Buffer): PdfTextResult {
  let streamsRead = 0;
  const pieces: string[] = [];

  try {
    for (const stream of extractStreams(buffer)) {
      // Imagens e fontes também são streams; só nos interessam os de conteúdo.
      if (/\/Subtype\s*\/Image|\/Type\s*\/Font|\/FontFile/.test(stream.dictionary)) continue;

      const content = stream.data.toString('latin1');
      if (!/(Tj|TJ)\b/.test(content)) continue;

      streamsRead += 1;
      const text = textFromContentStream(content);
      if (text.trim().length > 0) pieces.push(text);
    }
  } catch {
    // Um PDF malformado não deve derrubar o pipeline: segue como "sem texto".
    return { text: '', streamsRead, characterCount: 0, hasUsefulText: false };
  }

  const text = normalizeWhitespace(pieces.join('\n'));
  const characterCount = text.replace(/\s/g, '').length;

  return {
    text,
    streamsRead,
    characterCount,
    hasUsefulText: characterCount >= MINIMUM_USEFUL_CHARACTERS,
  };
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
