/**
 * Detecção do tipo **real** do arquivo pelos primeiros bytes (seção 10).
 *
 * A extensão e o `Content-Type` enviados pelo cliente são declarações, não fatos: quem
 * quer subir um executável renomeia para `.pdf` e informa `application/pdf`. Aqui o
 * conteúdo é que decide.
 *
 * Não usamos a biblioteca `file-type`: a versão disponível é ESM-only e quebraria os
 * testes em CommonJS — e para o punhado de formatos que este módulo aceita, reconhecer
 * as assinaturas à mão é mais previsível e permite detectar explicitamente os formatos
 * que devem ser **bloqueados**.
 */

export type DetectedKind =
  | 'pdf'
  | 'jpg'
  | 'png'
  | 'xml'
  | 'xlsx'
  | 'xls'
  | 'csv'
  | 'zip'
  | 'executable'
  | 'script'
  | 'unknown'
  | 'empty';

export interface FileSignature {
  kind: DetectedKind;
  /** MIME correspondente ao conteúdo, não ao que o cliente declarou. */
  mimeType: string | null;
  /** Extensões que combinam com este conteúdo. */
  extensions: string[];
  /** Formatos que nunca podem ser aceitos, por mais que a extensão diga o contrário. */
  isDangerous: boolean;
}

const SIGNATURES: {
  kind: DetectedKind;
  mimeType: string;
  extensions: string[];
  bytes: number[];
  offset?: number;
  dangerous?: boolean;
}[] = [
  {
    kind: 'pdf',
    mimeType: 'application/pdf',
    extensions: ['pdf'],
    bytes: [0x25, 0x50, 0x44, 0x46],
  }, // %PDF
  {
    kind: 'jpg',
    mimeType: 'image/jpeg',
    extensions: ['jpg', 'jpeg'],
    bytes: [0xff, 0xd8, 0xff],
  },
  {
    kind: 'png',
    mimeType: 'image/png',
    extensions: ['png'],
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  {
    // XLS antigo (OLE2 Compound File).
    kind: 'xls',
    mimeType: 'application/vnd.ms-excel',
    extensions: ['xls'],
    bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
  },
  // Executáveis: reconhecidos para poder recusar com uma mensagem honesta.
  {
    kind: 'executable',
    mimeType: 'application/x-msdownload',
    extensions: ['exe', 'dll'],
    bytes: [0x4d, 0x5a],
    dangerous: true,
  }, // MZ
  {
    kind: 'executable',
    mimeType: 'application/x-elf',
    extensions: ['elf', 'so'],
    bytes: [0x7f, 0x45, 0x4c, 0x46],
    dangerous: true,
  }, // \x7fELF
  {
    kind: 'executable',
    mimeType: 'application/x-mach-binary',
    extensions: ['macho'],
    bytes: [0xcf, 0xfa, 0xed, 0xfe],
    dangerous: true,
  },
  {
    kind: 'script',
    mimeType: 'text/x-shellscript',
    extensions: ['sh'],
    bytes: [0x23, 0x21],
    dangerous: true,
  }, // #!
];

/** ZIP e derivados (XLSX, DOCX, JAR…) compartilham a mesma assinatura `PK\x03\x04`. */
const ZIP_BYTES = [0x50, 0x4b, 0x03, 0x04];

function startsWith(buffer: Buffer, bytes: number[], offset = 0): boolean {
  if (buffer.length < offset + bytes.length) return false;
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

/**
 * Distingue um XLSX de um ZIP comum: o pacote OOXML sempre traz `[Content_Types].xml` e
 * a pasta `xl/`. Procuramos essas marcas no cabeçalho do zip, sem descomprimir nada.
 */
function looksLikeXlsx(buffer: Buffer): boolean {
  const head = buffer
    .subarray(0, Math.min(buffer.length, 8192))
    .toString('latin1');
  return (
    head.includes('[Content_Types].xml') &&
    (head.includes('xl/') || head.includes('workbook'))
  );
}

/**
 * XML: o arquivo pode ou não começar com a declaração `<?xml`. Aceitamos também um
 * documento que abre direto na primeira tag, ignorando BOM e espaços iniciais.
 */
function looksLikeXml(buffer: Buffer): boolean {
  const head = stripBom(
    buffer.subarray(0, Math.min(buffer.length, 1024)).toString('utf8'),
  ).trimStart();
  return head.startsWith('<?xml') || /^<[A-Za-z_]/.test(head);
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * CSV é texto puro: não tem assinatura. Só afirmamos "csv" quando o conteúdo é
 * imprimível e tem separador — nunca por eliminação, para não deixar binário passar
 * disfarçado de texto.
 */
function looksLikeText(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  if (sample.length === 0) return false;

  let suspicious = 0;
  for (const byte of sample) {
    // Byte nulo não aparece em texto; é o sinal mais confiável de binário.
    if (byte === 0) return false;
    const isPrintable =
      byte >= 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d;
    if (!isPrintable) suspicious += 1;
  }

  return suspicious / sample.length < 0.05;
}

/** Identifica o conteúdo do arquivo. Nunca lança: quem decide o que fazer é o chamador. */
export function detectFileSignature(buffer: Buffer): FileSignature {
  if (buffer.length === 0) {
    return {
      kind: 'empty',
      mimeType: null,
      extensions: [],
      isDangerous: false,
    };
  }

  for (const signature of SIGNATURES) {
    if (startsWith(buffer, signature.bytes, signature.offset)) {
      return {
        kind: signature.kind,
        mimeType: signature.mimeType,
        extensions: signature.extensions,
        isDangerous: signature.dangerous === true,
      };
    }
  }

  if (startsWith(buffer, ZIP_BYTES)) {
    return looksLikeXlsx(buffer)
      ? {
          kind: 'xlsx',
          mimeType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          extensions: ['xlsx'],
          isDangerous: false,
        }
      : // ZIP genérico é tratado como perigoso nesta etapa: o prompt exige regras de
        // segurança próprias antes de aceitar arquivos compactados (seção 9).
        {
          kind: 'zip',
          mimeType: 'application/zip',
          extensions: ['zip'],
          isDangerous: true,
        };
  }

  if (looksLikeXml(buffer)) {
    return {
      kind: 'xml',
      mimeType: 'application/xml',
      extensions: ['xml'],
      isDangerous: false,
    };
  }

  if (looksLikeText(buffer)) {
    return {
      kind: 'csv',
      mimeType: 'text/csv',
      extensions: ['csv', 'txt'],
      isDangerous: false,
    };
  }

  return {
    kind: 'unknown',
    mimeType: null,
    extensions: [],
    isDangerous: false,
  };
}

/** Extensão declarada no nome do arquivo, em minúsculas e sem o ponto. */
export function extensionOf(fileName: string): string {
  const match = /\.([A-Za-z0-9]+)$/.exec(fileName.trim());
  return match ? match[1].toLowerCase() : '';
}

/**
 * Normaliza o nome do arquivo antes de qualquer uso em caminho de storage (seção 11).
 *
 * Remove diretórios (`../`, `/`, `\`), caracteres de controle e reduz o resto a um
 * conjunto seguro. Um nome como `../../etc/passwd` vira `etc_passwd`.
 */
export function normalizeFileName(fileName: string): string {
  const withoutPath = fileName
    .split(/[/\\]/)
    .filter((part) => part !== '..' && part !== '.')
    .join('_');

  const cleaned = withoutPath
    // eslint-disable-next-line no-control-regex -- caracteres de controle são exatamente o que precisa sair
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[._]+/, '')
    .slice(0, 180)
    .trim();

  return cleaned.length > 0 ? cleaned : 'documento';
}

/** PDF protegido por senha traz um dicionário `/Encrypt` no trailer. */
export function isEncryptedPdf(buffer: Buffer): boolean {
  const tail = buffer
    .subarray(Math.max(0, buffer.length - 4096))
    .toString('latin1');
  const head = buffer
    .subarray(0, Math.min(buffer.length, 4096))
    .toString('latin1');
  return /\/Encrypt\b/.test(tail) || /\/Encrypt\b/.test(head);
}

/**
 * PDF íntegro termina com `%%EOF`. Um upload interrompido no meio costuma perder
 * justamente essa marca — é o teste mais direto de arquivo truncado.
 */
export function isTruncatedPdf(buffer: Buffer): boolean {
  const tail = buffer
    .subarray(Math.max(0, buffer.length - 2048))
    .toString('latin1');
  return !tail.includes('%%EOF');
}

/** Conta as páginas de um PDF pelos objetos `/Type /Page`. */
export function countPdfPages(buffer: Buffer): number | null {
  const text = buffer.toString('latin1');
  const matches = text.match(/\/Type\s*\/Page[^s]/g);
  if (matches && matches.length > 0) return matches.length;

  // Alguns geradores só declaram a contagem em `/Count` no nó raiz de páginas.
  const count = /\/Type\s*\/Pages[\s\S]{0,200}?\/Count\s+(\d+)/.exec(text);
  return count ? Number(count[1]) : null;
}
