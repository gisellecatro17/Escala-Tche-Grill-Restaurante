import { ConfigService } from '@nestjs/config';

import { FileValidationService } from './file-validation.service';
import { AntivirusScanner } from './providers/antivirus.provider';
import {
  detectFileSignature,
  isEncryptedPdf,
  isTruncatedPdf,
  countPdfPages,
  normalizeFileName,
} from './utils/file-signature.util';

/** Constrói um PDF mínimo, válido e com o número de páginas pedido. */
function buildPdf(
  options: { pages?: number; encrypted?: boolean; truncated?: boolean } = {},
) {
  const pages = options.pages ?? 1;
  const pageObjects = Array.from(
    { length: pages },
    (_, index) =>
      `${index + 3} 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\n`,
  ).join('');

  const body =
    '%PDF-1.4\n' +
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
    `2 0 obj\n<< /Type /Pages /Count ${pages} >>\nendobj\n` +
    pageObjects +
    `trailer\n<< /Size ${pages + 2}${options.encrypted ? ' /Encrypt 9 0 R' : ''} >>\n`;

  return Buffer.from(options.truncated ? body : `${body}%%EOF\n`);
}

const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108020000009077' +
    '3dcc0000000c4944415408d763f8ffff3f0005fe02fea735f8d80000000049454e44ae426082',
  'hex',
);

const LIMITS = {
  maximumFileSize: 20 * 1024 * 1024,
  allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png', 'xml', 'xlsx', 'xls', 'csv'],
};

describe('Detecção de assinatura de arquivo (seção 10)', () => {
  it('reconhece PDF, PNG e XML pelo conteúdo', () => {
    expect(detectFileSignature(buildPdf()).kind).toBe('pdf');
    expect(detectFileSignature(PNG).kind).toBe('png');
    expect(
      detectFileSignature(Buffer.from('<?xml version="1.0"?><nfe/>')).kind,
    ).toBe('xml');
  });

  it('reconhece XML sem declaração inicial', () => {
    expect(
      detectFileSignature(Buffer.from('<nfeProc><NFe/></nfeProc>')).kind,
    ).toBe('xml');
  });

  it('marca executável como perigoso, mesmo com extensão de PDF', () => {
    const disguised = Buffer.concat([
      Buffer.from([0x4d, 0x5a]),
      Buffer.alloc(200),
    ]);
    const signature = detectFileSignature(disguised);

    expect(signature.kind).toBe('executable');
    expect(signature.isDangerous).toBe(true);
  });

  it('marca ELF e shell script como perigosos', () => {
    expect(
      detectFileSignature(Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x00]))
        .isDangerous,
    ).toBe(true);
    expect(
      detectFileSignature(Buffer.from('#!/bin/sh\nrm -rf /')).isDangerous,
    ).toBe(true);
  });

  it('distingue arquivo vazio de conteúdo desconhecido', () => {
    expect(detectFileSignature(Buffer.alloc(0)).kind).toBe('empty');
    expect(detectFileSignature(Buffer.from([0x00, 0xff, 0x12])).kind).toBe(
      'unknown',
    );
  });

  it('detecta PDF protegido por senha e PDF truncado', () => {
    expect(isEncryptedPdf(buildPdf({ encrypted: true }))).toBe(true);
    expect(isEncryptedPdf(buildPdf())).toBe(false);
    expect(isTruncatedPdf(buildPdf({ truncated: true }))).toBe(true);
    expect(isTruncatedPdf(buildPdf())).toBe(false);
  });

  it('conta as páginas do PDF', () => {
    expect(countPdfPages(buildPdf({ pages: 3 }))).toBe(3);
  });
});

describe('Normalização do nome do arquivo (seção 11)', () => {
  it('neutraliza travessia de diretório', () => {
    expect(normalizeFileName('../../etc/passwd')).toBe('etc_passwd');
    expect(normalizeFileName('..\\..\\windows\\cmd.exe')).toBe(
      'windows_cmd.exe',
    );
  });

  it('não deixa o nome começar com ponto', () => {
    expect(normalizeFileName('   .hidden')).toBe('hidden');
  });

  it('devolve um nome utilizável quando não sobra nada', () => {
    expect(normalizeFileName('')).toBe('documento');
    expect(normalizeFileName('///')).toBe('documento');
  });

  it('preserva a extensão ao limpar caracteres especiais', () => {
    expect(normalizeFileName('nota—fiscal✓.xml')).toMatch(/\.xml$/);
  });
});

describe('FileValidationService', () => {
  function buildService(antivirusProvider = 'none') {
    const config = new ConfigService({ ANTIVIRUS_PROVIDER: antivirusProvider });
    return new FileValidationService(new AntivirusScanner(config));
  }

  it('aceita um PDF válido e calcula o hash', async () => {
    const service = buildService();
    const result = await service.validate(
      {
        fileName: 'boleto.pdf',
        declaredMimeType: 'application/pdf',
        buffer: buildPdf(),
      },
      LIMITS,
    );

    expect(result.accepted).toBe(true);
    expect(result.detectedKind).toBe('pdf');
    expect(result.fileHash).toHaveLength(64);
    expect(result.errors).toHaveLength(0);
  });

  it('produz o mesmo hash para o mesmo conteúdo — base da detecção de duplicidade', async () => {
    const service = buildService();
    const first = await service.validate(
      { fileName: 'a.pdf', buffer: buildPdf() },
      LIMITS,
    );
    const second = await service.validate(
      { fileName: 'b.pdf', buffer: buildPdf() },
      LIMITS,
    );

    expect(first.fileHash).toBe(second.fileHash);
  });

  it('recusa arquivo vazio', async () => {
    const service = buildService();
    const result = await service.validate(
      { fileName: 'vazio.pdf', buffer: Buffer.alloc(0) },
      LIMITS,
    );

    expect(result.accepted).toBe(false);
    expect(result.errors.join(' ')).toContain('vazio');
  });

  it('recusa arquivo acima do limite configurado', async () => {
    const service = buildService();
    const result = await service.validate(
      { fileName: 'grande.pdf', buffer: buildPdf() },
      { ...LIMITS, maximumFileSize: 10 },
    );

    expect(result.accepted).toBe(false);
    expect(result.errors.join(' ')).toContain('tamanho máximo');
  });

  it('recusa executável disfarçado de PDF, pelo conteúdo', async () => {
    const service = buildService();
    const result = await service.validate(
      {
        fileName: 'boleto.pdf',
        declaredMimeType: 'application/pdf',
        buffer: Buffer.concat([Buffer.from([0x4d, 0x5a]), Buffer.alloc(500)]),
      },
      LIMITS,
    );

    expect(result.accepted).toBe(false);
    expect(result.errors.join(' ')).toContain('executável');
  });

  it('recusa quando a extensão não corresponde ao conteúdo', async () => {
    const service = buildService();
    const result = await service.validate(
      {
        fileName: 'imagem.pdf',
        declaredMimeType: 'application/pdf',
        buffer: PNG,
      },
      LIMITS,
    );

    expect(result.accepted).toBe(false);
    expect(result.errors.join(' ')).toContain(
      'não corresponde ao seu conteúdo',
    );
  });

  it('recusa formato que não está na lista permitida da empresa', async () => {
    const service = buildService();
    const result = await service.validate(
      { fileName: 'planilha.csv', buffer: Buffer.from('a;b\n1;2\n') },
      { ...LIMITS, allowedExtensions: ['pdf', 'xml'] },
    );

    expect(result.accepted).toBe(false);
    expect(result.errors.join(' ')).toContain('não é permitido');
  });

  it('recusa PDF protegido por senha', async () => {
    const service = buildService();
    const result = await service.validate(
      { fileName: 'protegido.pdf', buffer: buildPdf({ encrypted: true }) },
      LIMITS,
    );

    expect(result.accepted).toBe(false);
    expect(result.errors.join(' ')).toContain('protegido por senha');
  });

  it('recusa PDF corrompido ou incompleto', async () => {
    const service = buildService();
    const result = await service.validate(
      { fileName: 'truncado.pdf', buffer: buildPdf({ truncated: true }) },
      LIMITS,
    );

    expect(result.accepted).toBe(false);
    expect(result.errors.join(' ')).toContain('corrompido');
  });

  it('recusa XML mal formado', async () => {
    const service = buildService();
    const result = await service.validate(
      { fileName: 'nota.xml', buffer: Buffer.from('<nfeProc><NFe></nfeProc>') },
      LIMITS,
    );

    expect(result.accepted).toBe(false);
    expect(result.errors.join(' ')).toContain('bem formado');
  });

  it('recusa PDF com mais páginas que o limite', async () => {
    const service = buildService();
    const result = await service.validate(
      { fileName: 'longo.pdf', buffer: buildPdf({ pages: 5 }) },
      { ...LIMITS, maximumPageCount: 2 },
    );

    expect(result.accepted).toBe(false);
    expect(result.errors.join(' ')).toContain('páginas');
  });

  it('avisa quando o MIME declarado difere do conteúdo, sem bloquear', async () => {
    const service = buildService();
    const result = await service.validate(
      {
        fileName: 'boleto.pdf',
        declaredMimeType: 'application/octet-stream',
        buffer: buildPdf(),
      },
      LIMITS,
    );

    expect(result.accepted).toBe(true);
    expect(result.warnings.join(' ')).toContain('difere do conteúdo');
  });

  describe('antivírus por abstração', () => {
    it('sem provedor configurado, declara que não analisou — nunca que está limpo', async () => {
      const service = buildService('none');
      const result = await service.validate(
        { fileName: 'a.pdf', buffer: buildPdf() },
        LIMITS,
      );

      expect(result.antivirus.verdict).toBe('NOT_SCANNED');
      expect(result.antivirus.scanned).toBe(false);
      expect(result.warnings.join(' ')).toContain(
        'Nenhum antivírus está configurado',
      );
    });

    it('bloqueia arquivo infectado quando há provedor', async () => {
      const service = buildService('eicar');
      const eicar = Buffer.from(
        'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
      );
      // O conteúdo precisa passar pelas checagens estruturais para chegar à varredura.
      const withSignature = Buffer.concat([
        Buffer.from('<?xml version="1.0"?><a>'),
        eicar,
        Buffer.from('</a>'),
      ]);

      const result = await service.validate(
        { fileName: 'virus.xml', buffer: withSignature },
        LIMITS,
      );

      expect(result.antivirus.verdict).toBe('INFECTED');
      expect(result.accepted).toBe(false);
      expect(result.errors.join(' ')).toContain('varredura de segurança');
    });

    it('declara limpo quando o provedor analisou e não achou nada', async () => {
      const service = buildService('eicar');
      const result = await service.validate(
        { fileName: 'a.pdf', buffer: buildPdf() },
        LIMITS,
      );

      expect(result.antivirus.verdict).toBe('CLEAN');
      expect(result.antivirus.scanned).toBe(true);
    });

    it('não gasta varredura em arquivo que já foi recusado', async () => {
      const service = buildService('eicar');
      const result = await service.validate(
        { fileName: 'a.pdf', buffer: Buffer.alloc(0) },
        LIMITS,
      );

      expect(result.antivirus.provider).toBe('skipped');
    });
  });
});
