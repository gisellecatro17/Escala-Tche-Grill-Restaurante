import { IntakeDocumentDirection, IntakeDocumentType } from '@prisma/client';

/**
 * Classificação automática do tipo de documento (seção 16).
 *
 * Combina os sinais que o prompt lista — extensão, MIME, texto, estrutura XML, código de
 * barras, palavras-chave e nome do arquivo — e devolve o tipo com uma confiança. A
 * classificação é sempre **sugestão**: o usuário corrige na revisão, e a correção é o que
 * ensina o sistema.
 *
 * Os pesos refletem quanto cada sinal realmente prova. Um XML de NF-e com `<infNFe>` é
 * praticamente certeza; a palavra "boleto" no nome do arquivo é palpite.
 */

export interface ClassificationInput {
  fileName?: string | null;
  extension?: string | null;
  mimeType?: string | null;
  text?: string | null;
  hasBarcode?: boolean;
  hasAccessKey?: boolean;
}

export interface ClassificationSuggestion {
  documentType: IntakeDocumentType;
  direction: IntakeDocumentDirection;
  confidence: number;
  /** Sinais que levaram à conclusão, para a tela poder explicar a sugestão. */
  signals: string[];
}

interface Rule {
  documentType: IntakeDocumentType;
  direction: IntakeDocumentDirection;
  /** Confiança quando a regra casa. */
  confidence: number;
  signal: string;
  matches: (input: NormalizedInput) => boolean;
}

interface NormalizedInput {
  fileName: string;
  extension: string;
  mimeType: string;
  text: string;
  hasBarcode: boolean;
  hasAccessKey: boolean;
}

/** Palavras-chave por tipo, já sem acento e em minúsculas. */
const KEYWORDS: Partial<Record<IntakeDocumentType, string[]>> = {
  BOLETO: [
    'boleto',
    'ficha de compensacao',
    'linha digitavel',
    'cedente',
    'sacado',
    'nosso numero',
  ],
  UTILITY_BILL: [
    'conta de energia',
    'fatura de energia',
    'consumo de agua',
    'kwh',
    'leitura anterior',
    'telefonia',
    'internet banda larga',
  ],
  // `inss` e `iss retido` ficaram **fora** de propósito: aparecem normalmente em nota
  // fiscal de serviço com retenção, e classificariam a nota como guia tributária.
  TAX_GUIDE: [
    'darf',
    'guia de recolhimento',
    'guia da previdencia',
    'fgts',
    'codigo de receita',
    'simples nacional',
  ],
  PAYMENT_RECEIPT: [
    'comprovante de pagamento',
    'comprovante de transferencia',
    'autenticacao',
    'pix enviado',
    'comprovante de pix',
  ],
  RECEIPT: ['recibo', 'recebi de', 'quitacao'],
  CONTRACT: ['contrato', 'clausula', 'contratante', 'contratada', 'aditivo'],
  PURCHASE_ORDER: ['ordem de compra', 'pedido de compra', 'purchase order'],
  BANK_STATEMENT: [
    'extrato',
    'saldo anterior',
    'saldo final',
    'lancamentos do periodo',
  ],
  PAYROLL_DOCUMENT: [
    'folha de pagamento',
    'holerite',
    'contracheque',
    'rescisao',
  ],
  EXPENSE_REPORT: [
    'relatorio de despesa',
    'prestacao de contas',
    'despesas de viagem',
  ],
  REIMBURSEMENT: ['reembolso', 'ressarcimento'],
  ADVANCE: ['adiantamento', 'antecipacao salarial'],
  SERVICE_INVOICE: ['nota fiscal de servico', 'prestacao de servico', 'iss'],
  PRODUCT_INVOICE: [
    'danfe',
    'nota fiscal eletronica',
    'icms',
    'quantidade comercial',
  ],
  INVOICE: ['fatura', 'invoice'],
};

/**
 * Ordem importa: a primeira regra que casar com a maior confiança ganha. As regras
 * estruturais (XML, código de barras) vêm antes das textuais.
 */
const RULES: Rule[] = [
  // ── Estrutura: quase certeza ──
  {
    documentType: IntakeDocumentType.NFE,
    direction: IntakeDocumentDirection.PAYABLE,
    confidence: 99,
    signal: 'XML com infNFe',
    matches: (input) =>
      input.extension === 'xml' && /infnfe|<nfe[\s>]/i.test(input.text),
  },
  {
    documentType: IntakeDocumentType.NFSE,
    direction: IntakeDocumentDirection.PAYABLE,
    confidence: 98,
    signal: 'XML de NFS-e',
    matches: (input) =>
      input.extension === 'xml' &&
      /infnfse|compnfse|listanfse|<rps[\s>]/i.test(input.text),
  },
  {
    documentType: IntakeDocumentType.CTE,
    direction: IntakeDocumentDirection.PAYABLE,
    confidence: 98,
    signal: 'XML de CT-e',
    matches: (input) => input.extension === 'xml' && /infcte/i.test(input.text),
  },
  {
    documentType: IntakeDocumentType.XML_DOCUMENT,
    direction: IntakeDocumentDirection.UNKNOWN,
    confidence: 70,
    signal: 'XML sem layout fiscal reconhecido',
    matches: (input) => input.extension === 'xml',
  },
  {
    documentType: IntakeDocumentType.SPREADSHEET,
    direction: IntakeDocumentDirection.UNKNOWN,
    confidence: 92,
    signal: 'planilha',
    matches: (input) => ['xlsx', 'xls', 'csv'].includes(input.extension),
  },

  // ── Código de barras: forte para boleto e guia ──
  {
    documentType: IntakeDocumentType.UTILITY_BILL,
    direction: IntakeDocumentDirection.PAYABLE,
    confidence: 94,
    signal:
      'código de concessionária (inicia com 8) com palavra-chave de consumo',
    matches: (input) =>
      input.hasBarcode && hasKeyword(input.text, KEYWORDS.UTILITY_BILL!),
  },
  {
    documentType: IntakeDocumentType.TAX_GUIDE,
    direction: IntakeDocumentDirection.PAYABLE,
    confidence: 93,
    signal: 'código de barras com palavra-chave tributária',
    matches: (input) =>
      input.hasBarcode && hasKeyword(input.text, KEYWORDS.TAX_GUIDE!),
  },
  {
    documentType: IntakeDocumentType.BOLETO,
    direction: IntakeDocumentDirection.PAYABLE,
    confidence: 95,
    signal: 'código de barras com palavra-chave de boleto',
    matches: (input) =>
      input.hasBarcode && hasKeyword(input.text, KEYWORDS.BOLETO!),
  },
  {
    documentType: IntakeDocumentType.BOLETO,
    direction: IntakeDocumentDirection.PAYABLE,
    confidence: 82,
    signal: 'código de barras encontrado',
    matches: (input) => input.hasBarcode,
  },

  // ── Texto: sugestão ──
  ...textRules(),

  // ── Nome do arquivo: último recurso ──
  {
    documentType: IntakeDocumentType.BOLETO,
    direction: IntakeDocumentDirection.PAYABLE,
    confidence: 45,
    signal: 'nome do arquivo sugere boleto',
    matches: (input) => /boleto|cobranca/.test(input.fileName),
  },
  {
    documentType: IntakeDocumentType.PRODUCT_INVOICE,
    direction: IntakeDocumentDirection.PAYABLE,
    confidence: 45,
    signal: 'nome do arquivo sugere nota fiscal',
    matches: (input) => /nota|nf[-_ ]?e|danfe/.test(input.fileName),
  },
  {
    documentType: IntakeDocumentType.PAYMENT_RECEIPT,
    direction: IntakeDocumentDirection.NEUTRAL,
    confidence: 45,
    signal: 'nome do arquivo sugere comprovante',
    matches: (input) => /comprovante|recibo/.test(input.fileName),
  },
];

/** Regras textuais geradas a partir das palavras-chave, com confiança uniforme. */
function textRules(): Rule[] {
  const directions: Partial<
    Record<IntakeDocumentType, IntakeDocumentDirection>
  > = {
    BOLETO: IntakeDocumentDirection.PAYABLE,
    UTILITY_BILL: IntakeDocumentDirection.PAYABLE,
    TAX_GUIDE: IntakeDocumentDirection.PAYABLE,
    PAYMENT_RECEIPT: IntakeDocumentDirection.NEUTRAL,
    RECEIPT: IntakeDocumentDirection.NEUTRAL,
    CONTRACT: IntakeDocumentDirection.NEUTRAL,
    PURCHASE_ORDER: IntakeDocumentDirection.PAYABLE,
    BANK_STATEMENT: IntakeDocumentDirection.NEUTRAL,
    PAYROLL_DOCUMENT: IntakeDocumentDirection.PAYABLE,
    EXPENSE_REPORT: IntakeDocumentDirection.PAYABLE,
    REIMBURSEMENT: IntakeDocumentDirection.PAYABLE,
    ADVANCE: IntakeDocumentDirection.PAYABLE,
    SERVICE_INVOICE: IntakeDocumentDirection.PAYABLE,
    PRODUCT_INVOICE: IntakeDocumentDirection.PAYABLE,
    INVOICE: IntakeDocumentDirection.PAYABLE,
  };

  // Tipos mais específicos primeiro: "nota fiscal de serviço" antes de "fatura".
  const order: IntakeDocumentType[] = [
    IntakeDocumentType.UTILITY_BILL,
    IntakeDocumentType.TAX_GUIDE,
    IntakeDocumentType.PAYMENT_RECEIPT,
    IntakeDocumentType.PAYROLL_DOCUMENT,
    IntakeDocumentType.BANK_STATEMENT,
    IntakeDocumentType.SERVICE_INVOICE,
    IntakeDocumentType.PRODUCT_INVOICE,
    IntakeDocumentType.PURCHASE_ORDER,
    IntakeDocumentType.EXPENSE_REPORT,
    IntakeDocumentType.REIMBURSEMENT,
    IntakeDocumentType.ADVANCE,
    IntakeDocumentType.CONTRACT,
    IntakeDocumentType.BOLETO,
    IntakeDocumentType.RECEIPT,
    IntakeDocumentType.INVOICE,
  ];

  return order.map((documentType) => ({
    documentType,
    direction: directions[documentType] ?? IntakeDocumentDirection.UNKNOWN,
    confidence: 76,
    signal: `palavra-chave de ${documentType}`,
    matches: (input: NormalizedInput) =>
      hasKeyword(input.text, KEYWORDS[documentType] ?? []),
  }));
}

function hasKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function normalize(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Classifica o documento. Sempre devolve um resultado — na falta de sinais, `OTHER` com
 * confiança baixa, que é honesto: o sistema não sabe.
 */
export function classifyDocumentType(
  input: ClassificationInput,
): ClassificationSuggestion {
  const normalized: NormalizedInput = {
    fileName: normalize(input.fileName),
    extension: (input.extension ?? '').toLowerCase(),
    mimeType: (input.mimeType ?? '').toLowerCase(),
    text: normalize(input.text),
    hasBarcode: input.hasBarcode === true,
    hasAccessKey: input.hasAccessKey === true,
  };

  const matched = RULES.filter((rule) => rule.matches(normalized));

  if (matched.length === 0) {
    // Imagem sem texto legível é o caso mais comum aqui: foto de documento sem OCR.
    const isImage = ['jpg', 'jpeg', 'png'].includes(normalized.extension);
    return {
      documentType: IntakeDocumentType.OTHER,
      direction: IntakeDocumentDirection.UNKNOWN,
      confidence: isImage ? 20 : 10,
      signals: isImage
        ? ['imagem sem texto reconhecido']
        : ['nenhum sinal reconhecido'],
    };
  }

  const best = matched.reduce((highest, rule) =>
    rule.confidence > highest.confidence ? rule : highest,
  );

  // Quando mais de uma regra aponta para o **mesmo** tipo, a confiança sobe: dois sinais
  // independentes concordando valem mais que um.
  const agreeing = matched.filter(
    (rule) => rule.documentType === best.documentType,
  );
  const bonus = Math.min((agreeing.length - 1) * 3, 6);

  return {
    documentType: best.documentType,
    direction: best.direction,
    confidence: Math.min(best.confidence + bonus, 99),
    signals: agreeing.map((rule) => rule.signal),
  };
}
