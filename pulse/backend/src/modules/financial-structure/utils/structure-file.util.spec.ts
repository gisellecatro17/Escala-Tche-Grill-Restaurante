import { BadRequestException } from '@nestjs/common';
import { StructureImportFormat } from '@prisma/client';
import ExcelJS from 'exceljs';

import {
  detectFormat,
  normalizeHeader,
  parseStructureFile,
  suggestMapping,
} from './structure-file.util';

const csv = (text: string) => Buffer.from(text, 'utf-8');

describe('normalizeHeader', () => {
  it('remove acentos, maiúsculas e pontuação', () => {
    expect(normalizeHeader('  Código da Conta ')).toBe('codigo_da_conta');
    expect(normalizeHeader('Descrição')).toBe('descricao');
    expect(normalizeHeader('D/C')).toBe('d_c');
  });
});

describe('detectFormat', () => {
  it('deduz o formato pela extensão', () => {
    expect(detectFormat('plano.xlsx')).toBe(StructureImportFormat.XLSX);
    expect(detectFormat('plano.XLS')).toBe(StructureImportFormat.EXCEL);
    expect(detectFormat('plano.json')).toBe(StructureImportFormat.JSON);
    expect(detectFormat('plano.csv')).toBe(StructureImportFormat.CSV);
    // Sem nome de arquivo, assume o formato mais comum.
    expect(detectFormat(undefined)).toBe(StructureImportFormat.CSV);
  });
});

describe('suggestMapping', () => {
  it('reconhece cabeçalhos em português e inglês', () => {
    expect(suggestMapping(['Código', 'Descrição', 'Conta Pai'])).toEqual({
      code: 'Código',
      name: 'Descrição',
      parentCode: 'Conta Pai',
    });
    expect(suggestMapping(['code', 'name'])).toEqual({
      code: 'code',
      name: 'name',
    });
  });

  it('não sugere nada para cabeçalhos desconhecidos', () => {
    expect(suggestMapping(['coluna_a', 'coluna_b'])).toEqual({});
  });

  it('não usa a mesma coluna para dois campos', () => {
    // "conta" casa com `code`; "descricao" com `name`. Nenhuma repetição.
    const mapping = suggestMapping(['conta', 'descricao', 'cod']);
    const used = Object.values(mapping);
    expect(new Set(used).size).toBe(used.length);
  });
});

describe('parseStructureFile — CSV', () => {
  it('detecta ponto e vírgula como separador', async () => {
    const result = await parseStructureFile(
      csv('codigo;nome\n1;Ativo'),
      StructureImportFormat.CSV,
    );

    expect(result.headers).toEqual(['codigo', 'nome']);
    expect(result.rows).toEqual([{ codigo: '1', nome: 'Ativo' }]);
  });

  it('não confunde vírgula dentro de aspas com separador', async () => {
    const result = await parseStructureFile(
      csv('codigo,nome\n5.01,"Aluguel, água e luz"'),
      StructureImportFormat.CSV,
    );

    expect(result.rows[0].nome).toBe('Aluguel, água e luz');
  });

  it('interpreta aspas duplicadas como aspa literal', async () => {
    const result = await parseStructureFile(
      csv('codigo;nome\n1;"Ativo ""Total"""'),
      StructureImportFormat.CSV,
    );

    expect(result.rows[0].nome).toBe('Ativo "Total"');
  });

  it('preserva quebras de linha dentro de campos entre aspas', async () => {
    const result = await parseStructureFile(
      csv('codigo;nome\n1;"Primeira\nSegunda"'),
      StructureImportFormat.CSV,
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].nome).toBe('Primeira\nSegunda');
  });

  it('aceita TSV', async () => {
    const result = await parseStructureFile(
      csv('codigo\tnome\n1\tAtivo'),
      StructureImportFormat.CSV,
    );

    expect(result.rows[0]).toEqual({ codigo: '1', nome: 'Ativo' });
  });

  it('remove o BOM do início do arquivo', async () => {
    const result = await parseStructureFile(
      Buffer.from('﻿codigo;nome\n1;Ativo', 'utf-8'),
      StructureImportFormat.CSV,
    );

    expect(result.headers[0]).toBe('codigo');
  });

  it('nomeia colunas sem cabeçalho', async () => {
    const result = await parseStructureFile(
      csv('codigo;;nome\n1;x;Ativo'),
      StructureImportFormat.CSV,
    );

    expect(result.headers).toEqual(['codigo', 'Coluna 2', 'nome']);
  });

  it('exige cabeçalho e ao menos uma linha de dados', async () => {
    await expect(
      parseStructureFile(csv('codigo;nome'), StructureImportFormat.CSV),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('parseStructureFile — JSON', () => {
  it('aceita uma lista de objetos', async () => {
    const result = await parseStructureFile(
      csv(JSON.stringify([{ codigo: '1', nome: 'Ativo' }])),
      StructureImportFormat.JSON,
    );

    expect(result.rows).toEqual([{ codigo: '1', nome: 'Ativo' }]);
  });

  it('aceita um objeto com a propriedade rows', async () => {
    const result = await parseStructureFile(
      csv(JSON.stringify({ rows: [{ codigo: '1', nome: 'Ativo' }] })),
      StructureImportFormat.JSON,
    );

    expect(result.rows).toHaveLength(1);
  });

  it('une as chaves de objetos que omitem campos', async () => {
    const result = await parseStructureFile(
      csv(
        JSON.stringify([
          { codigo: '1', nome: 'Ativo' },
          { codigo: '1.1', nome: 'Circulante', pai: '1' },
        ]),
      ),
      StructureImportFormat.JSON,
    );

    expect(result.headers).toEqual(['codigo', 'nome', 'pai']);
    // O primeiro objeto não tem "pai": vira string vazia, não `undefined`.
    expect(result.rows[0].pai).toBe('');
  });

  it('recusa JSON inválido', async () => {
    await expect(
      parseStructureFile(csv('{não é json'), StructureImportFormat.JSON),
    ).rejects.toThrow(/não é válido/i);
  });

  it('recusa JSON que não seja uma lista', async () => {
    await expect(
      parseStructureFile(csv('{"a":1}'), StructureImportFormat.JSON),
    ).rejects.toThrow(/lista de objetos/i);
  });
});

describe('parseStructureFile — XLSX', () => {
  async function workbookBuffer(rows: (string | number)[][]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Plano');
    for (const row of rows) sheet.addRow(row);
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  it('lê a primeira aba da planilha', async () => {
    const buffer = await workbookBuffer([
      ['codigo', 'nome'],
      ['1', 'Ativo'],
      ['1.1', 'Ativo Circulante'],
    ]);

    const result = await parseStructureFile(buffer, StructureImportFormat.XLSX);

    expect(result.headers).toEqual(['codigo', 'nome']);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[1]).toEqual({ codigo: '1.1', nome: 'Ativo Circulante' });
  });

  it('converte números em texto sem perder o valor', async () => {
    const buffer = await workbookBuffer([
      ['codigo', 'nome'],
      [101, 'Caixa'],
    ]);

    const result = await parseStructureFile(buffer, StructureImportFormat.XLSX);

    expect(result.rows[0].codigo).toBe('101');
  });

  it('ignora linhas totalmente vazias', async () => {
    const buffer = await workbookBuffer([
      ['codigo', 'nome'],
      ['1', 'Ativo'],
      ['', ''],
      ['2', 'Passivo'],
    ]);

    const result = await parseStructureFile(buffer, StructureImportFormat.XLSX);

    expect(result.rows).toHaveLength(2);
  });

  it('recusa um arquivo que não é uma planilha válida', async () => {
    await expect(
      parseStructureFile(csv('não sou um xlsx'), StructureImportFormat.XLSX),
    ).rejects.toThrow(/planilha/i);
  });
});
