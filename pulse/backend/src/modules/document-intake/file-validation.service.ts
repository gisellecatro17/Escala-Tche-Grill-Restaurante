import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

import {
  AntivirusScanner,
  type AntivirusResult,
} from './providers/antivirus.provider';
import {
  countPdfPages,
  detectFileSignature,
  extensionOf,
  isEncryptedPdf,
  isTruncatedPdf,
  normalizeFileName,
  type DetectedKind,
} from './utils/file-signature.util';

/** Limites de um envio, resolvidos a partir dos parâmetros da empresa (seção 66). */
export interface FileValidationLimits {
  maximumFileSize: number;
  allowedExtensions: string[];
  maximumPageCount?: number;
}

export interface FileValidationInput {
  fileName: string;
  /** MIME **declarado** pelo cliente. Serve para comparação, nunca como verdade. */
  declaredMimeType?: string;
  buffer: Buffer;
}

export interface FileValidationResult {
  accepted: boolean;
  /** Motivos do bloqueio, já em português e prontos para exibição. */
  errors: string[];
  /** Observações que não impedem o envio, mas ficam registradas no documento. */
  warnings: string[];

  normalizedFileName: string;
  detectedKind: DetectedKind;
  /** MIME derivado do conteúdo. É este que vai para o banco e para o storage. */
  effectiveMimeType: string | null;
  declaredMimeType: string | null;
  extension: string;
  fileSize: number;
  fileHash: string;
  pageCount: number | null;
  antivirus: AntivirusResult;
}

/** Extensões que o conteúdo detectado justifica. Divergência é bloqueio, não aviso. */
const KIND_EXTENSIONS: Record<DetectedKind, string[]> = {
  pdf: ['pdf'],
  jpg: ['jpg', 'jpeg'],
  png: ['png'],
  xml: ['xml'],
  xlsx: ['xlsx'],
  xls: ['xls'],
  csv: ['csv', 'txt'],
  zip: ['zip'],
  executable: [],
  script: [],
  unknown: [],
  empty: [],
};

/**
 * Valida um arquivo recebido antes de qualquer armazenamento (seção 10).
 *
 * A ordem importa: primeiro o que é barato e decisivo (vazio, tamanho, assinatura),
 * depois o que custa (varredura, contagem de páginas). Um executável disfarçado é
 * recusado antes de o antivírus ser chamado.
 */
@Injectable()
export class FileValidationService {
  constructor(private readonly antivirus: AntivirusScanner) {}

  async validate(
    input: FileValidationInput,
    limits: FileValidationLimits,
  ): Promise<FileValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const buffer = input.buffer;
    const fileSize = buffer.length;
    const normalizedFileName = normalizeFileName(input.fileName);
    const extension = extensionOf(normalizedFileName);
    const fileHash = createHash('sha256').update(buffer).digest('hex');

    const signature = detectFileSignature(buffer);
    let pageCount: number | null = null;

    if (fileSize === 0) {
      errors.push('O arquivo está vazio.');
    }

    if (fileSize > limits.maximumFileSize) {
      errors.push(
        `O arquivo excede o tamanho máximo permitido (${formatBytes(limits.maximumFileSize)}).`,
      );
    }

    if (signature.isDangerous) {
      // Mensagem específica: o usuário precisa saber que foi o conteúdo, não a extensão.
      errors.push(
        signature.kind === 'zip'
          ? 'Arquivos compactados ainda não são aceitos neste módulo.'
          : 'O conteúdo deste arquivo é executável e não pode ser enviado.',
      );
    }

    if (signature.kind === 'unknown' && fileSize > 0) {
      errors.push('Não foi possível reconhecer o formato deste arquivo.');
    }

    // Extensão declarada precisa combinar com o conteúdo. Um `.pdf` que na verdade é PNG
    // não é um erro do usuário a ser corrigido silenciosamente: é sinal de problema.
    const expectedExtensions = KIND_EXTENSIONS[signature.kind];
    if (
      expectedExtensions.length > 0 &&
      extension.length > 0 &&
      !expectedExtensions.includes(extension)
    ) {
      errors.push(
        `A extensão do arquivo (.${extension}) não corresponde ao seu conteúdo (${describeKind(signature.kind)}).`,
      );
    }

    const allowed = limits.allowedExtensions.map((value) =>
      value.toLowerCase(),
    );
    const contentExtension = expectedExtensions[0];
    if (contentExtension && !allowed.includes(contentExtension)) {
      errors.push('O formato deste arquivo não é permitido.');
    }

    if (
      input.declaredMimeType &&
      signature.mimeType &&
      input.declaredMimeType !== signature.mimeType
    ) {
      // Divergência de MIME é comum e inofensiva quando a extensão bate (navegadores
      // mandam `application/octet-stream`), então fica como observação.
      warnings.push(
        `O tipo informado pelo navegador (${input.declaredMimeType}) difere do conteúdo (${signature.mimeType}).`,
      );
    }

    if (signature.kind === 'pdf') {
      if (isEncryptedPdf(buffer)) {
        errors.push('O documento está protegido por senha.');
      }
      if (isTruncatedPdf(buffer)) {
        errors.push('O arquivo parece estar corrompido ou incompleto.');
      }
      pageCount = countPdfPages(buffer);
      if (
        limits.maximumPageCount &&
        pageCount !== null &&
        pageCount > limits.maximumPageCount
      ) {
        errors.push(
          `O documento tem ${pageCount} páginas e o limite é ${limits.maximumPageCount}.`,
        );
      }
    }

    if (signature.kind === 'xml' && !isWellFormedXml(buffer)) {
      errors.push('O XML enviado não está bem formado.');
    }

    if (
      (signature.kind === 'png' || signature.kind === 'jpg') &&
      fileSize < 1024
    ) {
      warnings.push(
        'A imagem é muito pequena e pode não ter resolução suficiente para leitura.',
      );
    }

    // A varredura só roda no que já passou pelas checagens estruturais.
    const antivirus =
      errors.length === 0
        ? await this.antivirus.scan(buffer, normalizedFileName)
        : {
            verdict: 'NOT_SCANNED' as const,
            scanned: false,
            provider: 'skipped',
          };

    if (antivirus.verdict === 'INFECTED') {
      errors.push('O arquivo foi bloqueado pela varredura de segurança.');
    }
    if (!antivirus.scanned && antivirus.provider === 'none') {
      warnings.push(
        'Nenhum antivírus está configurado neste ambiente — o arquivo não foi analisado.',
      );
    }

    return {
      accepted: errors.length === 0,
      errors,
      warnings,
      normalizedFileName,
      detectedKind: signature.kind,
      effectiveMimeType: signature.mimeType,
      declaredMimeType: input.declaredMimeType ?? null,
      extension: contentExtension ?? extension,
      fileSize,
      fileHash,
      pageCount,
      antivirus,
    };
  }
}

/**
 * Checagem estrutural de XML sem montar a árvore inteira: confere se as tags abrem e
 * fecham na ordem certa. Suficiente para recusar arquivo truncado ou colado errado;
 * a leitura fiscal de verdade acontece no provedor de extração.
 */
function isWellFormedXml(buffer: Buffer): boolean {
  const text = buffer.toString('utf8');
  const stack: string[] = [];
  const tagPattern = /<\/?([A-Za-z_][\w.:-]*)([^>]*)>/g;

  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(text)) !== null) {
    const [raw, name, rest] = match;
    if (raw.startsWith('</')) {
      if (stack.pop() !== name) return false;
    } else if (!rest.trimEnd().endsWith('/')) {
      stack.push(name);
    }
  }

  return stack.length === 0 && /<[A-Za-z_]/.test(text);
}

function describeKind(kind: DetectedKind): string {
  const labels: Record<DetectedKind, string> = {
    pdf: 'PDF',
    jpg: 'imagem JPEG',
    png: 'imagem PNG',
    xml: 'XML',
    xlsx: 'planilha XLSX',
    xls: 'planilha XLS',
    csv: 'texto/CSV',
    zip: 'arquivo compactado',
    executable: 'executável',
    script: 'script',
    unknown: 'desconhecido',
    empty: 'vazio',
  };
  return labels[kind];
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}
