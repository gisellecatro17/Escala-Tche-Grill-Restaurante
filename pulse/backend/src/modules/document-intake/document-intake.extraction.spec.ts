import { ConfigService } from '@nestjs/config';

import {
  LocalDocumentExtractionProvider,
  MockDocumentExtractionProvider,
  findBarcodeCandidates,
} from './providers/document-extraction.provider';
import { classifyDocumentType } from './utils/document-classifier.util';
import { parseFiscalXml } from './utils/fiscal-xml.util';
import {
  buildValidBoleto,
  formatDigitableLine,
} from './utils/boleto-fixture.util';
import {
  extractDocumentsFromText,
  normalizeText,
  similarity,
} from './party-identification.service';

const NFE = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe><infNFe Id="NFe29260812345678000199550010000012341234567890" versao="4.00">
    <ide><nNF>1234</nNF><serie>1</serie><dhEmi>2026-08-05T10:30:00-03:00</dhEmi></ide>
    <emit><CNPJ>12345678000199</CNPJ><xNome>Frigorifico Boi Forte Ltda</xNome><xFant>Boi Forte</xFant></emit>
    <dest><CNPJ>98765432000188</CNPJ><xNome>Tche Grill Restaurante Ltda</xNome></dest>
    <det nItem="1"><prod><cProd>CAR001</cProd><xProd>Costela bovina</xProd><qCom>120.0</qCom><vUnCom>45.00</vUnCom><vProd>5400.00</vProd></prod></det>
    <det nItem="2"><prod><cProd>CAR002</cProd><xProd>Linguica artesanal</xProd><qCom>80.0</qCom><vUnCom>43.75</vUnCom><vProd>3500.00</vProd></prod></det>
    <total><ICMSTot><vProd>8900.00</vProd><vDesc>0.00</vDesc><vICMS>1068.00</vICMS><vNF>8900.00</vNF></ICMSTot></total>
    <infAdic><infCpl>Pedido 4471</infCpl></infAdic>
  </infNFe></NFe>
  <Signature>assinatura</Signature>
</nfeProc>`;

const NFSE = `<?xml version="1.0"?>
<CompNfse><Nfse><InfNfse>
  <Numero>887</Numero><DataEmissao>2026-07-15</DataEmissao><Competencia>2026-07-01</Competencia>
  <PrestadorServico><IdentificacaoPrestador><Cnpj>11222333000181</Cnpj></IdentificacaoPrestador><RazaoSocial>Contabilidade Exemplo ME</RazaoSocial></PrestadorServico>
  <TomadorServico><IdentificacaoTomador><CpfCnpj><Cnpj>98765432000188</Cnpj></CpfCnpj></IdentificacaoTomador><RazaoSocial>Tche Grill</RazaoSocial></TomadorServico>
  <Servico><Valores><ValorServicos>1500.00</ValorServicos><ValorIss>75.00</ValorIss><ValorIr>22.50</ValorIr><ValorLiquidoNfse>1477.50</ValorLiquidoNfse></Valores><Discriminacao>Honorarios 07/2026</Discriminacao></Servico>
</InfNfse></Nfse></CompNfse>`;

describe('Leitura de XML fiscal (seção 26)', () => {
  it('lê NF-e sem depender de OCR', () => {
    const result = parseFiscalXml(Buffer.from(NFE));

    expect(result.wellFormed).toBe(true);
    expect(result.kind).toBe('NFE');
    expect(result.accessKey).toBe(
      '29260812345678000199550010000012341234567890',
    );
    expect(result.accessKey).toHaveLength(44);
    expect(result.documentNumber).toBe('1234');
    expect(result.issuer.document).toBe('12345678000199');
    expect(result.issuer.name).toBe('Frigorifico Boi Forte Ltda');
    expect(result.recipient.document).toBe('98765432000188');
    expect(result.totalAmount).toBe(8900);
    expect(result.taxes.ICMS).toBe(1068);
    expect(result.hasSignature).toBe(true);
  });

  it('lê os itens da nota', () => {
    const result = parseFiscalXml(Buffer.from(NFE));

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      description: 'Costela bovina',
      totalAmount: 5400,
    });
  });

  it('lê NFS-e com o CNPJ aninhado em contêineres municipais', () => {
    const result = parseFiscalXml(Buffer.from(NFSE));

    expect(result.kind).toBe('NFSE');
    // O CNPJ está dois níveis abaixo, dentro de IdentificacaoPrestador.
    expect(result.issuer.document).toBe('11222333000181');
    expect(result.recipient.document).toBe('98765432000188');
    expect(result.netAmount).toBe(1477.5);
    expect(result.withholdings.IRRF).toBe(22.5);
    expect(result.taxes.ISS).toBe(75);
  });

  it('recusa XML mal formado com mensagem em português', () => {
    const result = parseFiscalXml(
      Buffer.from('<nfeProc><NFe><emit></nfeProc>'),
    );

    expect(result.wellFormed).toBe(false);
    expect(result.errors[0]).toContain('não está bem formado');
  });

  it('avisa quando o XML não é um documento fiscal reconhecido', () => {
    const result = parseFiscalXml(
      Buffer.from('<config><item>1</item></config>'),
    );

    expect(result.kind).toBe('UNKNOWN');
    expect(result.warnings.join(' ')).toContain('não foi reconhecido');
  });
});

describe('Classificação do tipo de documento (seção 16)', () => {
  it('classifica NF-e, NFS-e e CT-e pela estrutura do XML', () => {
    expect(
      classifyDocumentType({ extension: 'xml', text: NFE }).documentType,
    ).toBe('NFE');
    expect(
      classifyDocumentType({ extension: 'xml', text: NFSE }).documentType,
    ).toBe('NFSE');
    expect(
      classifyDocumentType({
        extension: 'xml',
        text: '<cteProc><infCte/></cteProc>',
      }).documentType,
    ).toBe('CTE');
  });

  it('dá confiança alta a sinal estrutural e baixa a nome de arquivo', () => {
    const structural = classifyDocumentType({ extension: 'xml', text: NFE });
    const byFileName = classifyDocumentType({
      extension: 'pdf',
      fileName: 'boleto-coelba.pdf',
      text: '',
    });

    expect(structural.confidence).toBeGreaterThanOrEqual(95);
    expect(byFileName.confidence).toBeLessThan(50);
  });

  it('classifica conta de consumo em vez de boleto genérico', () => {
    const result = classifyDocumentType({
      extension: 'pdf',
      hasBarcode: true,
      text: 'FATURA DE ENERGIA ELETRICA consumo 450 kWh leitura anterior',
    });

    expect(result.documentType).toBe('UTILITY_BILL');
  });

  it('não confunde nota de serviço com guia tributária por causa da retenção', () => {
    // "ISS retido" e "INSS" aparecem normalmente em nota de serviço com retenção.
    const result = classifyDocumentType({
      extension: 'pdf',
      text: 'Nota Fiscal de Serviço ISS retido INSS 11%',
    });

    expect(result.documentType).toBe('SERVICE_INVOICE');
  });

  it('classifica guia tributária por termos específicos de guia', () => {
    expect(
      classifyDocumentType({
        extension: 'pdf',
        hasBarcode: true,
        text: 'DARF codigo de receita 0561',
      }).documentType,
    ).toBe('TAX_GUIDE');
  });

  it('define a direção do documento junto com o tipo', () => {
    expect(
      classifyDocumentType({ extension: 'xml', text: NFE }).direction,
    ).toBe('PAYABLE');
    expect(
      classifyDocumentType({
        extension: 'pdf',
        text: 'Comprovante de pagamento autenticacao',
      }).direction,
    ).toBe('NEUTRAL');
  });

  it('admite que não sabe, com confiança baixa, em vez de arriscar', () => {
    const result = classifyDocumentType({
      extension: 'jpg',
      fileName: 'foto.jpg',
      text: '',
    });

    expect(result.documentType).toBe('OTHER');
    expect(result.confidence).toBeLessThanOrEqual(20);
    expect(result.signals).toContain('imagem sem texto reconhecido');
  });

  it('aumenta a confiança quando sinais independentes concordam', () => {
    const single = classifyDocumentType({
      extension: 'pdf',
      hasBarcode: true,
      text: 'documento',
    });
    const multiple = classifyDocumentType({
      extension: 'pdf',
      hasBarcode: true,
      text: 'Ficha de Compensação cedente nosso numero linha digitavel',
    });

    expect(multiple.confidence).toBeGreaterThan(single.confidence);
    expect(multiple.signals.length).toBeGreaterThan(1);
  });
});

describe('Busca de código de barras no texto', () => {
  const boleto = buildValidBoleto({
    amount: 2450,
    dueDate: new Date('2026-08-10T00:00:00Z'),
    seed: '7',
  });

  it('encontra a linha digitável impressa com separadores', () => {
    const text = [
      'NEOENERGIA COELBA',
      'CNPJ: 15.139.629/0001-94',
      'Vencimento: 10/08/2026',
      'Nosso numero: 000123456',
      formatDigitableLine(boleto.digitableLine),
    ].join('\n');

    expect(findBarcodeCandidates(text)).toEqual([boleto.digitableLine]);
  });

  it('não junta dígitos de campos em linhas diferentes', () => {
    // Uma busca que atravessa quebras de linha somaria "000123456" com a linha digitável.
    const text = `Nosso numero: 000123456\n${formatDigitableLine(boleto.digitableLine)}`;

    expect(findBarcodeCandidates(text)).toHaveLength(1);
  });

  it('encontra o código corrido, sem separadores', () => {
    expect(findBarcodeCandidates(`codigo ${boleto.barcode} fim`)).toContain(
      boleto.barcode,
    );
  });

  it('não inventa candidato em texto sem código', () => {
    expect(
      findBarcodeCandidates('Valor total: 2.450,00 em 10/08/2026'),
    ).toHaveLength(0);
  });
});

describe('LocalDocumentExtractionProvider', () => {
  const provider = new LocalDocumentExtractionProvider(new ConfigService({}));

  it('extrai campos de XML com confiança 100 — dado estruturado é exato', async () => {
    const result = await provider.extractFields({
      buffer: Buffer.from(NFE),
      fileName: 'nota.xml',
    });

    expect(result.method).toBe('XML_PARSE');
    expect(result.usedOcr).toBe(false);

    const byName = new Map(
      result.fields.map((field) => [field.fieldName, field]),
    );
    expect(byName.get('issuerDocument')?.normalizedValue).toBe(
      '12345678000199',
    );
    expect(byName.get('issuerDocument')?.confidence).toBe(100);
    expect(byName.get('grossAmount')?.normalizedValue).toBe('8900');
  });

  it('não confunde a chave de acesso de 44 dígitos com código de barras de boleto', async () => {
    const result = await provider.extractFields({
      buffer: Buffer.from(NFE),
      fileName: 'nota.xml',
    });

    expect(result.fields.some((field) => field.fieldName === 'barcode')).toBe(
      false,
    );
    expect(result.fields.some((field) => field.fieldName === 'accessKey')).toBe(
      true,
    );
  });

  it('sem OCR configurado, devolve vazio e confiança zero — nunca texto inventado', async () => {
    const png = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108020000009077' +
        '3dcc0000000c4944415408d763f8ffff3f0005fe02fea735f8d80000000049454e44ae426082',
      'hex',
    );

    const result = await provider.extractFields({
      buffer: png,
      fileName: 'foto.png',
    });

    expect(result.text).toBe('');
    expect(result.confidence).toBe(0);
    expect(result.fields).toHaveLength(0);
    expect(result.warnings.join(' ')).toContain(
      'nenhum provedor de OCR está configurado',
    );
  });

  it('lê valor e vencimento rotulados em texto corrido', async () => {
    const text =
      'Valor do documento: 2.450,00\nVencimento: 10/08/2026\nCNPJ: 15.139.629/0001-94';
    const result = await provider.extractFields({
      buffer: Buffer.from(text),
      fileName: 'boleto.csv',
    });

    const byName = new Map(
      result.fields.map((field) => [field.fieldName, field]),
    );
    expect(byName.get('grossAmount')?.normalizedValue).toBe('2450.00');
    expect(byName.get('dueDate')?.normalizedValue).toBe('2026-08-10');
    expect(byName.get('issuerDocument')?.normalizedValue).toBe(
      '15139629000194',
    );
  });

  it('confiança global é zero quando nenhum campo foi reconhecido', async () => {
    const result = await provider.extractFields({
      buffer: Buffer.from('texto sem nada de util aqui'),
      fileName: 'a.csv',
    });

    expect(result.confidence).toBe(0);
  });

  it('o provedor de mentira devolve exatamente o que foi programado', async () => {
    const mock = new MockDocumentExtractionProvider();
    mock.script({ text: 'programado', confidence: 88, usedOcr: true });

    const result = await mock.extractFields();
    expect(result.text).toBe('programado');
    expect(result.confidence).toBe(88);
    expect(result.usedOcr).toBe(true);
  });
});

describe('Auxiliares de identificação', () => {
  it('remove acentos e pontuação para comparar nomes', () => {
    expect(normalizeText('Frigorífico Boi Forte Ltda — Matriz')).toBe(
      'frigorifico boi forte ltda matriz',
    );
  });

  it('mede semelhança por palavras em comum', () => {
    expect(similarity('boi forte', 'boi forte')).toBe(1);
    expect(
      similarity(
        normalizeText('Coelba'),
        normalizeText('Frigorifico Boi Forte'),
      ),
    ).toBe(0);
  });

  it('mantém nome parecido em faixa de baixa confiança', () => {
    // 0,33 × 60 pontos = 20, bem abaixo dos 75 da faixa média: nunca preenche sozinho.
    const score = similarity(
      normalizeText('Coelba'),
      normalizeText('Neoenergia Coelba S.A.'),
    );
    expect(score * 60).toBeLessThan(75);
  });

  it('extrai CNPJ e CPF do texto, sem repetição', () => {
    const found = extractDocumentsFromText(
      'Emitente 15.139.629/0001-94, pagador 123.456.789-09 e de novo 15.139.629/0001-94',
    );

    expect(found).toEqual(['15139629000194', '12345678909']);
  });
});
