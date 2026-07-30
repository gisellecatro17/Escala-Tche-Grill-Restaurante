import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { extractPdfText } from '../utils/pdf-text.util';
import { parseFiscalXml, type FiscalXmlResult } from '../utils/fiscal-xml.util';
import { detectFileSignature, type DetectedKind } from '../utils/file-signature.util';

/**
 * Abstração da extração de dados de documentos (seção 19).
 *
 * A regra do prompt é não acoplar o sistema a um fornecedor externo. Aqui a interface é
 * o contrato; a implementação local resolve o que dá para resolver sem custo e sem rede
 * (texto nativo de PDF, XML fiscal, código de barras no texto), e um provedor externo
 * pode ser plugado depois por configuração, sem tocar em quem consome.
 */

export interface ExtractionInput {
  buffer: Buffer;
  fileName: string;
  mimeType?: string | null;
}

/** Um campo extraído com sua procedência — a confiança depende de **como** foi obtido. */
export interface ExtractedFieldValue {
  fieldName: string;
  originalValue: string | null;
  normalizedValue: string | null;
  dataType: 'string' | 'number' | 'date' | 'document' | 'barcode';
  sourceMethod:
    | 'XML_PARSE'
    | 'PDF_TEXT'
    | 'OCR'
    | 'BARCODE'
    | 'DIGITABLE_LINE'
    | 'SPREADSHEET_PARSE'
    | 'FILE_NAME';
  confidence: number;
  pageNumber?: number | null;
}

export interface ExtractionResult {
  /** Texto completo obtido, qualquer que tenha sido o método. */
  text: string;
  /** Método predominante — o que o documento registra em `extraction_method`. */
  method: ExtractedFieldValue['sourceMethod'] | null;
  /** `true` quando o OCR foi acionado (para a auditoria e para o custo). */
  usedOcr: boolean;
  /** Confiança global da extração, de 0 a 100. */
  confidence: number;
  fields: ExtractedFieldValue[];
  /** Resultado bruto do XML, quando o documento era XML fiscal. */
  fiscalXml: FiscalXmlResult | null;
  barcodeCandidates: string[];
  pageCount: number | null;
  warnings: string[];
}

export abstract class DocumentExtractionProvider {
  abstract readonly name: string;

  abstract extractText(input: ExtractionInput): Promise<{ text: string; usedOcr: boolean; confidence: number }>;
  abstract extractFields(input: ExtractionInput): Promise<ExtractionResult>;
  abstract detectDocumentType(input: ExtractionInput): Promise<{ kind: DetectedKind }>;
  abstract extractBarcode(input: ExtractionInput): Promise<string[]>;
  abstract extractQrCode(input: ExtractionInput): Promise<string[]>;
  abstract extractXmlData(input: ExtractionInput): Promise<FiscalXmlResult | null>;
  abstract getConfidence(result: ExtractionResult): number;
}

/**
 * Confiança por método de extração.
 *
 * XML é dado estruturado: se o campo existe, o valor está certo. OCR é palpite educado.
 * Fixar isso em um só lugar impede que uma leitura de OCR seja tratada como se fosse tão
 * confiável quanto um XML — é essa diferença que governa o preenchimento automático.
 */
const CONFIDENCE_BY_METHOD: Record<ExtractedFieldValue['sourceMethod'], number> = {
  XML_PARSE: 100,
  BARCODE: 99,
  DIGITABLE_LINE: 98,
  PDF_TEXT: 90,
  SPREADSHEET_PARSE: 85,
  OCR: 62,
  FILE_NAME: 40,
};

@Injectable()
export class LocalDocumentExtractionProvider extends DocumentExtractionProvider {
  private readonly logger = new Logger(LocalDocumentExtractionProvider.name);
  readonly name = 'local';
  /** Provedor de OCR configurado. `none` significa: não há OCR neste ambiente. */
  private readonly ocrProvider: string;

  constructor(private readonly config: ConfigService) {
    super();
    this.ocrProvider = this.config.get<string>('OCR_PROVIDER') ?? 'none';
  }

  async detectDocumentType(input: ExtractionInput): Promise<{ kind: DetectedKind }> {
    await Promise.resolve();
    return { kind: detectFileSignature(input.buffer).kind };
  }

  /**
   * Obtém o texto do documento seguindo a ordem da seção 20: XML direto, texto nativo do
   * PDF, e só então OCR.
   */
  async extractText(
    input: ExtractionInput,
  ): Promise<{ text: string; usedOcr: boolean; confidence: number }> {
    const kind = detectFileSignature(input.buffer).kind;

    if (kind === 'xml') {
      // XML é lido como estrutura; o texto serve só para busca e classificação.
      return {
        text: input.buffer.toString('utf8'),
        usedOcr: false,
        confidence: CONFIDENCE_BY_METHOD.XML_PARSE,
      };
    }

    if (kind === 'csv') {
      return {
        text: input.buffer.toString('utf8'),
        usedOcr: false,
        confidence: CONFIDENCE_BY_METHOD.SPREADSHEET_PARSE,
      };
    }

    if (kind === 'pdf') {
      const native = extractPdfText(input.buffer);
      if (native.hasUsefulText) {
        return { text: native.text, usedOcr: false, confidence: CONFIDENCE_BY_METHOD.PDF_TEXT };
      }

      // Sem texto nativo suficiente: é aqui que o OCR entraria.
      const ocr = await this.runOcr(input);
      if (ocr.text.length > 0) {
        return { text: ocr.text, usedOcr: ocr.attempted, confidence: ocr.confidence };
      }

      // O OCR não trouxe nada. Se havia **algum** texto nativo, ele é melhor que vazio —
      // descartar dado que já temos na mão seria perda pura. A confiança cai para
      // sinalizar que o texto é parcial.
      if (native.characterCount > 0) {
        return {
          text: native.text,
          usedOcr: ocr.attempted,
          confidence: Math.round(CONFIDENCE_BY_METHOD.PDF_TEXT * 0.6),
        };
      }

      return { text: '', usedOcr: ocr.attempted, confidence: 0 };
    }

    if (kind === 'jpg' || kind === 'png') {
      const ocr = await this.runOcr(input);
      return { text: ocr.text, usedOcr: ocr.attempted, confidence: ocr.confidence };
    }

    return { text: '', usedOcr: false, confidence: 0 };
  }

  /**
   * OCR por configuração de ambiente.
   *
   * Sem provedor configurado devolvemos texto vazio e confiança zero — **nunca** um texto
   * inventado. O documento então cai em "aguardando revisão" com pendência de documento
   * ilegível, que é a verdade: o sistema não conseguiu ler.
   */
  private async runOcr(
    input: ExtractionInput,
  ): Promise<{ text: string; attempted: boolean; confidence: number }> {
    await Promise.resolve();

    if (this.ocrProvider === 'none') {
      this.logger.debug(
        `OCR não configurado; ${input.fileName} seguirá para revisão manual.`,
      );
      return { text: '', attempted: false, confidence: 0 };
    }

    // Um provedor externo (Textract, Document AI, Tesseract em serviço) entra aqui.
    this.logger.warn(
      `Provedor de OCR "${this.ocrProvider}" declarado mas não implementado nesta etapa.`,
    );
    return { text: '', attempted: false, confidence: 0 };
  }

  async extractXmlData(input: ExtractionInput): Promise<FiscalXmlResult | null> {
    await Promise.resolve();
    if (detectFileSignature(input.buffer).kind !== 'xml') return null;
    return parseFiscalXml(input.buffer);
  }

  /**
   * Procura códigos de barras **no texto** do documento.
   *
   * Leitura óptica de código de barras a partir da imagem exige biblioteca de visão
   * computacional e não é feita nesta etapa. O que funciona sem isso — e resolve a maioria
   * dos boletos, que são PDFs com texto — é achar a sequência de 44 a 48 dígitos impressa
   * junto ao código. A leitura por câmera acontece no dispositivo, no front-end.
   */
  async extractBarcode(input: ExtractionInput): Promise<string[]> {
    const { text } = await this.extractText(input);
    return findBarcodeCandidates(text);
  }

  async extractQrCode(input: ExtractionInput): Promise<string[]> {
    const { text } = await this.extractText(input);
    // QR Code de NFC-e/PIX aparece como URL no texto quando o PDF é digital.
    const matches = text.match(/https?:\/\/[^\s"'<>]{20,}/g) ?? [];
    return matches.filter(
      (url) => /qrcode|nfce|nfe|pix|qr/i.test(url) || url.includes('chNFe'),
    );
  }

  /** Extrai todos os campos que o documento permitir, com procedência campo a campo. */
  async extractFields(input: ExtractionInput): Promise<ExtractionResult> {
    const warnings: string[] = [];
    const fields: ExtractedFieldValue[] = [];

    const signature = detectFileSignature(input.buffer);
    const { text, usedOcr, confidence } = await this.extractText(input);

    let fiscalXml: FiscalXmlResult | null = null;

    if (signature.kind === 'xml') {
      fiscalXml = parseFiscalXml(input.buffer);
      warnings.push(...fiscalXml.warnings);
      fields.push(...fieldsFromFiscalXml(fiscalXml));
    }

    // Em XML a chave de acesso tem 44 dígitos e passaria por código de barras de boleto.
    // Ela já foi capturada como `accessKey`; procurar código de barras aqui só criaria um
    // campo errado.
    const barcodeCandidates =
      signature.kind === 'xml' ? [] : findBarcodeCandidates(text);
    for (const candidate of barcodeCandidates.slice(0, 1)) {
      fields.push({
        fieldName: candidate.length === 47 || candidate.length === 48 ? 'digitableLine' : 'barcode',
        originalValue: candidate,
        normalizedValue: candidate,
        dataType: 'barcode',
        sourceMethod: candidate.length === 44 ? 'BARCODE' : 'DIGITABLE_LINE',
        confidence: candidate.length === 44 ? CONFIDENCE_BY_METHOD.BARCODE : CONFIDENCE_BY_METHOD.DIGITABLE_LINE,
      });
    }

    // Campos que dá para tirar do texto corrido, quando o XML não os trouxe.
    if (text.length > 0 && signature.kind !== 'xml') {
      const method = usedOcr ? 'OCR' : signature.kind === 'csv' ? 'SPREADSHEET_PARSE' : 'PDF_TEXT';
      fields.push(...fieldsFromPlainText(text, method));
    }

    if (text.length === 0 && signature.kind !== 'xlsx' && signature.kind !== 'xls') {
      warnings.push(
        this.ocrProvider === 'none'
          ? 'Não foi possível extrair texto deste documento e nenhum provedor de OCR está configurado neste ambiente.'
          : 'Não foi possível extrair texto deste documento.',
      );
    }

    const result: ExtractionResult = {
      text,
      // O método é registrado mesmo quando nenhum campo foi reconhecido: a seção 20 exige
      // saber **como** o documento foi lido, e "extraí o texto mas não achei campos" é uma
      // informação diferente de "não consegui ler".
      method: resolvePredominantMethod(fields, usedOcr, text, signature.kind),
      usedOcr,
      confidence,
      fields: dedupeFields(fields),
      fiscalXml,
      barcodeCandidates,
      pageCount: null,
      warnings,
    };

    result.confidence = this.getConfidence(result);
    return result;
  }

  /**
   * Confiança global: a média dos campos encontrados, limitada pela do método usado.
   *
   * Sem nenhum campo, a confiança é zero — não "média de lista vazia". Um documento do
   * qual nada foi extraído não pode aparecer como parcialmente confiável.
   */
  getConfidence(result: ExtractionResult): number {
    if (result.fields.length === 0) return 0;

    const sum = result.fields.reduce((total, field) => total + field.confidence, 0);
    const average = sum / result.fields.length;

    return Math.round(Math.min(average, result.confidence || average) * 100) / 100;
  }
}

/** Provedor de mentira, para testes: devolve exatamente o que foi programado. */
@Injectable()
export class MockDocumentExtractionProvider extends DocumentExtractionProvider {
  readonly name = 'mock';
  private scripted: Partial<ExtractionResult> = {};

  /** Define o que a próxima extração vai devolver. */
  script(result: Partial<ExtractionResult>): void {
    this.scripted = result;
  }

  async extractText(): Promise<{ text: string; usedOcr: boolean; confidence: number }> {
    await Promise.resolve();
    return {
      text: this.scripted.text ?? '',
      usedOcr: this.scripted.usedOcr ?? false,
      confidence: this.scripted.confidence ?? 0,
    };
  }

  async extractFields(): Promise<ExtractionResult> {
    await Promise.resolve();
    return {
      text: '',
      method: null,
      usedOcr: false,
      confidence: 0,
      fields: [],
      fiscalXml: null,
      barcodeCandidates: [],
      pageCount: null,
      warnings: [],
      ...this.scripted,
    };
  }

  async detectDocumentType(input: ExtractionInput): Promise<{ kind: DetectedKind }> {
    await Promise.resolve();
    return { kind: detectFileSignature(input.buffer).kind };
  }

  async extractBarcode(): Promise<string[]> {
    await Promise.resolve();
    return this.scripted.barcodeCandidates ?? [];
  }

  async extractQrCode(): Promise<string[]> {
    await Promise.resolve();
    return [];
  }

  async extractXmlData(): Promise<FiscalXmlResult | null> {
    await Promise.resolve();
    return this.scripted.fiscalXml ?? null;
  }

  getConfidence(result: ExtractionResult): number {
    return result.confidence;
  }
}

// ── Auxiliares de extração ──────────────────────────────────────────────────

/**
 * Encontra sequências que podem ser código de barras ou linha digitável.
 *
 * Junta os grupos separados por espaço e ponto antes de medir o tamanho: impressa, a
 * linha digitável vem quebrada em `00190.00009 03372.377000 ...`.
 */
export function findBarcodeCandidates(text: string): string[] {
  const candidates = new Set<string>();
  const validLengths = [44, 47, 48];

  // Linha por linha: uma busca que atravessa quebras de linha junta os dígitos de campos
  // vizinhos ("Nosso número: 000123456" + a linha digitável) e o total nunca fecha.
  for (const line of text.split(/\n+/)) {
    // Blocos de dígitos com os separadores da linha digitável impressa (ponto e espaço).
    for (const group of line.match(/\d[\d.\t ]{40,70}\d/g) ?? []) {
      const digits = group.replace(/\D/g, '');
      if (validLengths.includes(digits.length)) candidates.add(digits);
    }

    // A linha inteira, quando é só o código com separadores.
    const lineDigits = line.replace(/\D/g, '');
    if (validLengths.includes(lineDigits.length) && /^[\d.\s]+$/.test(line.trim())) {
      candidates.add(lineDigits);
    }

    // Sequências corridas, sem separador nenhum.
    for (const run of line.match(/(?<!\d)\d{44,48}(?!\d)/g) ?? []) {
      if (validLengths.includes(run.length)) candidates.add(run);
    }
  }

  return [...candidates];
}

function fieldsFromFiscalXml(xml: FiscalXmlResult): ExtractedFieldValue[] {
  const fields: ExtractedFieldValue[] = [];
  const add = (
    fieldName: string,
    value: string | number | Date | null,
    dataType: ExtractedFieldValue['dataType'],
  ) => {
    if (value === null || value === undefined || value === '') return;
    const original =
      value instanceof Date ? value.toISOString() : String(value);
    fields.push({
      fieldName,
      originalValue: original,
      normalizedValue: original,
      dataType,
      sourceMethod: 'XML_PARSE',
      confidence: CONFIDENCE_BY_METHOD.XML_PARSE,
    });
  };

  add('accessKey', xml.accessKey, 'string');
  add('documentNumber', xml.documentNumber, 'string');
  add('documentSeries', xml.documentSeries, 'string');
  add('issueDate', xml.issueDate, 'date');
  add('competenceDate', xml.competenceDate, 'date');
  add('issuerDocument', xml.issuer.document, 'document');
  add('issuerName', xml.issuer.name, 'string');
  add('recipientDocument', xml.recipient.document, 'document');
  add('recipientName', xml.recipient.name, 'string');
  add('grossAmount', xml.totalAmount, 'number');
  add('discountAmount', xml.discountAmount, 'number');
  add('netAmount', xml.netAmount, 'number');
  add('description', xml.additionalInformation, 'string');

  const totalWithholding = Object.values(xml.withholdings).reduce((sum, value) => sum + value, 0);
  if (totalWithholding > 0) add('withholdingAmount', totalWithholding, 'number');

  return fields;
}

/** Padrões que valem a pena tentar em texto corrido de boleto, fatura ou conta. */
function fieldsFromPlainText(
  text: string,
  method: ExtractedFieldValue['sourceMethod'],
): ExtractedFieldValue[] {
  const fields: ExtractedFieldValue[] = [];
  const confidence = CONFIDENCE_BY_METHOD[method];

  const push = (
    fieldName: string,
    original: string,
    normalized: string,
    dataType: ExtractedFieldValue['dataType'],
    // Achado por rótulo explícito vale mais que achado por formato solto.
    confidenceOverride?: number,
  ) => {
    fields.push({
      fieldName,
      originalValue: original,
      normalizedValue: normalized,
      dataType,
      sourceMethod: method,
      confidence: confidenceOverride ?? confidence,
    });
  };

  // CNPJ / CPF formatados.
  const cnpj = /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/.exec(text);
  if (cnpj) push('issuerDocument', cnpj[1], cnpj[1].replace(/\D/g, ''), 'document');

  const cpf = /(?<!\d)(\d{3}\.\d{3}\.\d{3}-\d{2})(?!\d)/.exec(text);
  if (cpf && !cnpj) push('issuerDocument', cpf[1], cpf[1].replace(/\D/g, ''), 'document');

  // Valor com rótulo tem prioridade sobre qualquer número solto na página.
  const labelledAmount =
    /(?:valor\s*(?:do\s*)?(?:documento|total|a\s*pagar|cobran[çc]a)?|total)\s*:?\s*R?\$?\s*([\d.]+,\d{2})/i.exec(text);
  if (labelledAmount) {
    push('grossAmount', labelledAmount[1], normalizeBrazilianAmount(labelledAmount[1]), 'number');
  }

  const labelledDueDate =
    /(?:vencimento|vence\s*em|data\s*de\s*vencimento)\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i.exec(text);
  if (labelledDueDate) {
    push('dueDate', labelledDueDate[1], toIsoDate(labelledDueDate[1]), 'date');
  }

  const labelledIssueDate =
    /(?:emiss[ãa]o|data\s*(?:de\s*)?emiss[ãa]o|processamento)\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i.exec(text);
  if (labelledIssueDate) {
    push('issueDate', labelledIssueDate[1], toIsoDate(labelledIssueDate[1]), 'date');
  }

  const documentNumber = /(?:n[uú]mero\s*(?:do\s*)?documento|nosso\s*n[uú]mero|n[.º°]?\s*documento)\s*:?\s*([\w./-]{3,25})/i.exec(text);
  if (documentNumber) push('documentNumber', documentNumber[1], documentNumber[1], 'string');

  // Chave PIX no formato de e-mail, útil para identificar o favorecido.
  const pixEmail = /\b[\w.+-]+@[\w-]+\.[\w.-]{2,}\b/.exec(text);
  if (pixEmail) push('pixKey', pixEmail[0], pixEmail[0].toLowerCase(), 'string', confidence - 15);

  return fields;
}

/** `2.450,00` → `2450.00`. O separador brasileiro é o oposto do que `Number` espera. */
function normalizeBrazilianAmount(value: string): string {
  return value.replace(/\./g, '').replace(',', '.');
}

function toIsoDate(value: string): string {
  const [day, month, year] = value.split('/');
  return `${year}-${month}-${day}`;
}

function resolvePredominantMethod(
  fields: ExtractedFieldValue[],
  usedOcr: boolean,
  text: string,
  kind: DetectedKind,
): ExtractedFieldValue['sourceMethod'] | null {
  if (fields.some((field) => field.sourceMethod === 'XML_PARSE')) return 'XML_PARSE';
  if (usedOcr) return 'OCR';

  if (fields.length === 0) {
    // Nenhum campo reconhecido, mas houve leitura: registra o método da leitura.
    if (text.length === 0) return null;
    if (kind === 'xml') return 'XML_PARSE';
    if (kind === 'csv' || kind === 'xlsx' || kind === 'xls') return 'SPREADSHEET_PARSE';
    if (kind === 'pdf') return 'PDF_TEXT';
    return null;
  }

  // O método mais frequente entre os campos encontrados.
  const counts = new Map<ExtractedFieldValue['sourceMethod'], number>();
  for (const field of fields) {
    counts.set(field.sourceMethod, (counts.get(field.sourceMethod) ?? 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/** Mantém o campo de maior confiança quando o mesmo nome aparece mais de uma vez. */
function dedupeFields(fields: ExtractedFieldValue[]): ExtractedFieldValue[] {
  const best = new Map<string, ExtractedFieldValue>();

  for (const field of fields) {
    const current = best.get(field.fieldName);
    if (!current || field.confidence > current.confidence) {
      best.set(field.fieldName, field);
    }
  }

  return [...best.values()];
}
