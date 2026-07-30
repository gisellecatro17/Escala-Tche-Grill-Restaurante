import { XMLParser, XMLValidator } from 'fast-xml-parser';

/**
 * Leitura direta de XML fiscal (seção 26).
 *
 * XML é dado estruturado: ler o campo certo é exato. Por isso a regra do prompt é
 * explícita — **não depender de OCR para XML**. Um CNPJ lido de `<emit><CNPJ>` tem
 * confiança 100; o mesmo CNPJ vindo de OCR de uma imagem, não.
 *
 * Cobre NF-e, NFS-e e CT-e. Os layouts de NFS-e variam por município (não há padrão
 * nacional consolidado), então a busca é por nome de campo em profundidade, e não por
 * caminho fixo: assim um layout municipal diferente ainda entrega emitente, valor e data.
 */

export type FiscalDocumentKind = 'NFE' | 'NFSE' | 'CTE' | 'UNKNOWN';

export interface FiscalXmlParty {
  document: string | null;
  name: string | null;
  tradeName: string | null;
  stateRegistration: string | null;
  municipalRegistration: string | null;
}

export interface FiscalXmlItem {
  description: string | null;
  quantity: number | null;
  unitAmount: number | null;
  totalAmount: number | null;
  code: string | null;
}

export interface FiscalXmlResult {
  wellFormed: boolean;
  kind: FiscalDocumentKind;
  rootName: string | null;
  namespace: string | null;

  accessKey: string | null;
  documentNumber: string | null;
  documentSeries: string | null;
  issueDate: Date | null;
  competenceDate: Date | null;

  issuer: FiscalXmlParty;
  recipient: FiscalXmlParty;

  totalAmount: number | null;
  productsAmount: number | null;
  serviceAmount: number | null;
  discountAmount: number | null;
  freightAmount: number | null;
  netAmount: number | null;

  /** Retenções encontradas no XML, por tributo. */
  withholdings: Record<string, number>;
  taxes: Record<string, number>;

  items: FiscalXmlItem[];
  additionalInformation: string | null;
  hasSignature: boolean;

  errors: string[];
  warnings: string[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

/** Busca em profundidade pelo primeiro nó cujo nome case com um dos nomes informados. */
function findNode(node: unknown, names: string[], depth = 0): unknown {
  if (depth > 30 || node === null || typeof node !== 'object') return undefined;

  const target = names.map((name) => name.toLowerCase());
  const record = node as Record<string, unknown>;

  for (const [key, value] of Object.entries(record)) {
    if (target.includes(key.toLowerCase())) return value;
  }

  for (const value of Object.values(record)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        const found = findNode(entry, names, depth + 1);
        if (found !== undefined) return found;
      }
      continue;
    }
    const found = findNode(value, names, depth + 1);
    if (found !== undefined) return found;
  }

  return undefined;
}

/** Valor de texto de um nó, resolvendo o caso de nó com atributos (`#text`). */
function textOf(node: unknown): string | null {
  if (node === null || node === undefined) return null;
  if (typeof node === 'string') return node.trim() || null;
  if (typeof node === 'number' || typeof node === 'boolean') return String(node);
  if (Array.isArray(node)) return node.length > 0 ? textOf(node[0]) : null;

  const record = node as Record<string, unknown>;
  if ('#text' in record) return textOf(record['#text']);
  return null;
}

function findText(node: unknown, names: string[]): string | null {
  return textOf(findNode(node, names));
}

/** Converte o valor monetário do XML (sempre com ponto decimal) em número. */
function findAmount(node: unknown, names: string[]): number | null {
  const raw = findText(node, names);
  if (raw === null) return null;
  const value = Number(raw.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

/** Datas fiscais vêm em ISO (`2026-08-10` ou `2026-08-10T09:00:00-03:00`). */
function findDate(node: unknown, names: string[]): Date | null {
  const raw = findText(node, names);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function onlyDigits(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  return digits.length > 0 ? digits : null;
}

function readParty(node: unknown): FiscalXmlParty {
  return {
    // Somente nomes de **folha**. Incluir contêineres como `CpfCnpj` ou
    // `IdentificacaoPrestador` na mesma lista os faria ganhar da folha que os contém, e o
    // documento voltaria nulo — a NFS-e aninha o CNPJ dois níveis abaixo.
    document: onlyDigits(findText(node, ['CNPJ', 'Cnpj', 'CPF', 'Cpf'])),
    name: findText(node, ['xNome', 'RazaoSocial', 'Nome', 'nome']),
    tradeName: findText(node, ['xFant', 'NomeFantasia']),
    stateRegistration: findText(node, ['IE', 'InscricaoEstadual']),
    municipalRegistration: findText(node, ['IM', 'InscricaoMunicipal']),
  };
}

function detectKind(rootName: string, text: string): FiscalDocumentKind {
  const root = rootName.toLowerCase();
  if (root.includes('cte') || text.includes('infCte')) return 'CTE';
  if (root.includes('nfse') || /<(Rps|InfNfse|CompNfse|ListaNfse)/i.test(text)) return 'NFSE';
  if (root.includes('nfe') || text.includes('infNFe')) return 'NFE';
  return 'UNKNOWN';
}

/** Lê o XML e devolve os campos fiscais. Nunca lança: XML inválido volta com erro. */
export function parseFiscalXml(buffer: Buffer): FiscalXmlResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const empty = (): FiscalXmlResult => ({
    wellFormed: false,
    kind: 'UNKNOWN',
    rootName: null,
    namespace: null,
    accessKey: null,
    documentNumber: null,
    documentSeries: null,
    issueDate: null,
    competenceDate: null,
    issuer: emptyParty(),
    recipient: emptyParty(),
    totalAmount: null,
    productsAmount: null,
    serviceAmount: null,
    discountAmount: null,
    freightAmount: null,
    netAmount: null,
    withholdings: {},
    taxes: {},
    items: [],
    additionalInformation: null,
    hasSignature: false,
    errors,
    warnings,
  });

  const text = buffer.toString('utf8');

  const validation = XMLValidator.validate(text, { allowBooleanAttributes: true });
  if (validation !== true) {
    errors.push(
      `O XML enviado não está bem formado: ${validation.err.msg} (linha ${validation.err.line}).`,
    );
    return empty();
  }

  let document: Record<string, unknown>;
  try {
    document = parser.parse(text) as Record<string, unknown>;
  } catch (caught) {
    errors.push(
      `Não foi possível interpretar o XML: ${caught instanceof Error ? caught.message : 'erro desconhecido'}.`,
    );
    return empty();
  }

  const rootName =
    Object.keys(document).find((key) => !key.startsWith('?')) ?? null;
  const root = rootName ? document[rootName] : document;
  const kind = detectKind(rootName ?? '', text);

  if (kind === 'UNKNOWN') {
    warnings.push(
      'O XML não foi reconhecido como NF-e, NFS-e ou CT-e — os campos podem sair incompletos.',
    );
  }

  const namespaceMatch = /xmlns="([^"]+)"/.exec(text);

  // A chave de acesso pode estar em `<chNFe>` ou no atributo `Id` de `<infNFe>`.
  const accessKeyFromField = onlyDigits(findText(root, ['chNFe', 'chCTe', 'ChaveAcesso', 'CodigoVerificacao']));
  const accessKeyFromId = onlyDigits(
    /Id="[A-Za-z]*(\d{44})"/.exec(text)?.[1] ?? null,
  );
  const accessKey = accessKeyFromField ?? accessKeyFromId;

  if (accessKey && accessKey.length !== 44 && kind !== 'NFSE') {
    // NFS-e usa código de verificação curto, então a exigência de 44 só vale para NF-e/CT-e.
    warnings.push(
      `A chave de acesso encontrada tem ${accessKey.length} dígitos, e o esperado são 44.`,
    );
  }

  const issuerNode = findNode(root, ['emit', 'Prestador', 'PrestadorServico', 'rem']);
  const recipientNode = findNode(root, ['dest', 'Tomador', 'TomadorServico', 'Destinatario']);

  const issuer = issuerNode ? readParty(issuerNode) : emptyParty();
  const recipient = recipientNode ? readParty(recipientNode) : emptyParty();

  if (!issuer.document) {
    warnings.push('O XML não traz o documento do emitente.');
  }

  const totalNode = findNode(root, ['ICMSTot', 'total', 'Valores', 'valores', 'vPrest']);
  const totalAmount =
    findAmount(totalNode, ['vNF', 'vTPrest', 'ValorLiquidoNfse', 'ValorServicos']) ??
    findAmount(root, ['vNF', 'vTPrest', 'ValorLiquidoNfse', 'ValorTotal']);

  const withholdings: Record<string, number> = {};
  const withholdingFields: [string, string[]][] = [
    ['INSS', ['vRetPrev', 'ValorInss', 'RetencaoInss']],
    ['IRRF', ['vIR', 'vRetIR', 'ValorIr', 'RetencaoIr']],
    ['ISS', ['vISSRet', 'ValorIssRetido', 'IssRetido']],
    ['PIS', ['vRetPIS', 'ValorPis']],
    ['COFINS', ['vRetCOFINS', 'ValorCofins']],
    ['CSLL', ['vRetCSLL', 'ValorCsll']],
  ];
  for (const [label, names] of withholdingFields) {
    const value = findAmount(totalNode ?? root, names) ?? findAmount(root, names);
    if (value !== null && value > 0) withholdings[label] = value;
  }

  const taxes: Record<string, number> = {};
  for (const [label, names] of [
    ['ICMS', ['vICMS']],
    ['IPI', ['vIPI']],
    ['PIS', ['vPIS']],
    ['COFINS', ['vCOFINS']],
    ['ISS', ['vISS', 'ValorIss']],
  ] as [string, string[]][]) {
    const value = findAmount(totalNode ?? root, names);
    if (value !== null && value > 0) taxes[label] = value;
  }

  const items = readItems(root);

  return {
    wellFormed: true,
    kind,
    rootName,
    namespace: namespaceMatch?.[1] ?? null,
    accessKey,
    documentNumber: findText(root, ['nNF', 'nCT', 'Numero', 'NumeroNfse', 'numero']),
    documentSeries: findText(root, ['serie', 'Serie']),
    issueDate: findDate(root, ['dhEmi', 'dEmi', 'DataEmissao', 'dhSaiEnt']),
    competenceDate: findDate(root, ['Competencia', 'dCompet']),
    issuer,
    recipient,
    totalAmount,
    productsAmount: findAmount(totalNode ?? root, ['vProd']),
    serviceAmount: findAmount(totalNode ?? root, ['vServ', 'ValorServicos']),
    discountAmount: findAmount(totalNode ?? root, ['vDesc', 'ValorDesconto', 'DescontoIncondicionado']),
    freightAmount: findAmount(totalNode ?? root, ['vFrete']),
    netAmount: findAmount(totalNode ?? root, ['ValorLiquidoNfse', 'vLiq']) ?? totalAmount,
    withholdings,
    taxes,
    items,
    additionalInformation: findText(root, ['infCpl', 'Discriminacao', 'OutrasInformacoes']),
    hasSignature: /<Signature[\s>]/i.test(text),
    errors,
    warnings,
  };
}

function readItems(root: unknown): FiscalXmlItem[] {
  const detached = findNode(root, ['det', 'Itens', 'ListaItens']);
  if (detached === undefined) return [];

  const entries = Array.isArray(detached) ? detached : [detached];

  return entries
    .map((entry) => {
      const product = findNode(entry, ['prod', 'Item', 'Servico']) ?? entry;
      return {
        description: findText(product, ['xProd', 'Descricao', 'descricao']),
        quantity: findAmount(product, ['qCom', 'Quantidade']),
        unitAmount: findAmount(product, ['vUnCom', 'ValorUnitario']),
        totalAmount: findAmount(product, ['vProd', 'ValorTotal', 'ValorItem']),
        code: findText(product, ['cProd', 'Codigo']),
      };
    })
    .filter((item) => item.description !== null || item.totalAmount !== null);
}

function emptyParty(): FiscalXmlParty {
  return {
    document: null,
    name: null,
    tradeName: null,
    stateRegistration: null,
    municipalRegistration: null,
  };
}
