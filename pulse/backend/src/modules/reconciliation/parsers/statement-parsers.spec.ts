import { BankTransactionDirection } from '@prisma/client';

import { parseAmount, parseDate } from './parsed-statement';
import { OfxImportService } from './ofx-import.service';
import { TabularImportService } from './tabular-import.service';

/**
 * OFX de banco brasileiro: SGML, sem tags de fechamento, datas com fuso colado.
 *
 * Escrito assim de propósito. Um XML bem-formado passaria em qualquer parser e não provaria
 * nada — é justamente o arquivo torto que o Pulse precisa conseguir ler.
 */
const OFX = `OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM>
<BANKID>001
<BRANCHID>1234
<ACCTID>56789-0
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260701000000[-3:BRT]
<DTEND>20260731000000[-3:BRT]
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260703120000[-3:BRT]
<TRNAMT>-1250.75
<FITID>202607030001
<MEMO>PAGAMENTO FORNECEDOR NF 8842
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260705120000[-3:BRT]
<TRNAMT>3000.00
<FITID>202607050002
<MEMO>PIX RECEBIDO CLIENTE
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>10749.25
<DTASOF>20260731120000[-3:BRT]
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

describe('parseAmount', () => {
  it('lê o formato brasileiro sem confundir milhar com decimal', () => {
    expect(parseAmount('1.234,56', ',', '.')).toBe(1234.56);
  });

  it('lê o formato americano quando o modelo diz que é ele', () => {
    expect(parseAmount('1,234.56', '.', ',')).toBe(1234.56);
  });

  it('preserva o sinal negativo', () => {
    expect(parseAmount('-89,90', ',', '.')).toBe(-89.9);
  });

  it('devolve nulo para texto que não é valor', () => {
    expect(parseAmount('SALDO ANTERIOR', ',', '.')).toBeNull();
  });
});

describe('parseDate', () => {
  it('lê DD/MM/YYYY', () => {
    const date = parseDate('05/07/2026', 'DD/MM/YYYY');
    expect(date?.toISOString().slice(0, 10)).toBe('2026-07-05');
  });

  it('lê YYYY-MM-DD', () => {
    const date = parseDate('2026-07-05', 'YYYY-MM-DD');
    expect(date?.toISOString().slice(0, 10)).toBe('2026-07-05');
  });

  /**
   * 31/02 não existe. Sem a checagem de estouro o `Date` vira 03/03 sem reclamar, e o
   * extrato importa uma data que nunca aconteceu.
   */
  it('recusa data inexistente em vez de deixar o mês virar', () => {
    expect(parseDate('31/02/2026', 'DD/MM/YYYY')).toBeNull();
  });
});

describe('OfxImportService', () => {
  const service = new OfxImportService();

  it('reconhece o arquivo pelo cabeçalho', () => {
    expect(service.detects(OFX)).toBe(true);
    expect(service.detects('data;valor;historico')).toBe(false);
  });

  it('lê o cabeçalho da conta', () => {
    const statement = service.parse(Buffer.from(OFX, 'utf8'));

    expect(statement.header.bankCode).toBe('001');
    expect(statement.header.agencyNumber).toBe('1234');
    expect(statement.header.accountNumber).toBe('56789-0');
    expect(statement.header.currencyCode).toBe('BRL');
  });

  it('lê as transações com valor sempre positivo e o sentido separado', () => {
    const statement = service.parse(Buffer.from(OFX, 'utf8'));

    expect(statement.transactions).toHaveLength(2);

    const [debit, credit] = statement.transactions;

    expect(debit.amount).toBe(1250.75);
    expect(debit.direction).toBe(BankTransactionDirection.OUT);
    expect(debit.fitId).toBe('202607030001');
    expect(debit.transactionDate?.toISOString().slice(0, 10)).toBe(
      '2026-07-03',
    );

    expect(credit.amount).toBe(3000);
    expect(credit.direction).toBe(BankTransactionDirection.IN);
  });

  /** Saldo inicial reconstruído do final menos a movimentação — o OFX não traz os dois. */
  it('reconstrói o saldo inicial a partir do final', () => {
    const statement = service.parse(Buffer.from(OFX, 'utf8'));

    expect(statement.header.closingBalance).toBe(10749.25);
    expect(statement.header.openingBalance).toBe(9000);
  });

  it('lê arquivo em Latin-1 sem quebrar os acentos', () => {
    const latin = OFX.replace('PAGAMENTO FORNECEDOR', 'PAGAMENTO FRIGORÍFICO');
    const statement = service.parse(Buffer.from(latin, 'latin1'));

    expect(statement.transactions[0].originalDescription).toContain(
      'FRIGORÍFICO',
    );
  });
});

describe('TabularImportService', () => {
  const service = new TabularImportService();

  const csv = [
    'Data;Historico;Documento;Credito;Debito',
    '03/07/2026;PAGAMENTO FORNECEDOR;8842;;1.250,75',
    '05/07/2026;"RECEBIMENTO; CLIENTE";9001;3.000,00;',
  ].join('\n');

  it('respeita aspas ao separar as colunas', () => {
    const grid = service.parseCsvGrid(Buffer.from(csv, 'utf8'), ';');

    expect(grid[2][1]).toBe('RECEBIMENTO; CLIENTE');
  });

  it('usa colunas separadas de crédito e débito para decidir o sentido', () => {
    const grid = service.parseCsvGrid(Buffer.from(csv, 'utf8'), ';');

    const statement = service.toStatement(grid, {
      columnMapping: {
        transactionDate: 'Data',
        description: 'Historico',
        documentNumber: 'Documento',
        credit: 'Credito',
        debit: 'Debito',
      },
      signRule: { kind: 'CREDIT_DEBIT_COLUMNS' },
      headerRow: 1,
      dataStartRow: 2,
    });

    expect(statement.transactions).toHaveLength(2);
    expect(statement.transactions[0].direction).toBe(
      BankTransactionDirection.OUT,
    );
    expect(statement.transactions[0].amount).toBe(1250.75);
    expect(statement.transactions[1].direction).toBe(
      BankTransactionDirection.IN,
    );
    expect(statement.transactions[1].amount).toBe(3000);
  });

  it('usa o sinal do próprio número quando o modelo diz que é assim', () => {
    const single = [
      'Data;Historico;Valor',
      '03/07/2026;PAGAMENTO FORNECEDOR;-1.250,75',
      '05/07/2026;RECEBIMENTO CLIENTE;3.000,00',
    ].join('\n');

    const statement = service.toStatement(
      service.parseCsvGrid(Buffer.from(single, 'utf8'), ';'),
      {
        columnMapping: {
          transactionDate: 'Data',
          description: 'Historico',
          amount: 'Valor',
        },
        signRule: { kind: 'SIGNED_AMOUNT' },
        headerRow: 1,
        dataStartRow: 2,
      },
    );

    expect(statement.transactions[0].direction).toBe(
      BankTransactionDirection.OUT,
    );
    expect(statement.transactions[1].direction).toBe(
      BankTransactionDirection.IN,
    );
  });

  it('usa a coluna de tipo quando o valor vem sempre positivo', () => {
    const typed = [
      'Data;Historico;Tipo;Valor',
      '03/07/2026;PAGAMENTO;D;1.250,75',
      '05/07/2026;RECEBIMENTO;C;3.000,00',
    ].join('\n');

    const statement = service.toStatement(
      service.parseCsvGrid(Buffer.from(typed, 'utf8'), ';'),
      {
        columnMapping: {
          transactionDate: 'Data',
          description: 'Historico',
          type: 'Tipo',
          amount: 'Valor',
        },
        signRule: {
          kind: 'TYPE_COLUMN',
          creditValues: ['C'],
          debitValues: ['D'],
        },
        headerRow: 1,
        dataStartRow: 2,
      },
    );

    expect(statement.transactions[0].direction).toBe(
      BankTransactionDirection.OUT,
    );
    expect(statement.transactions[1].direction).toBe(
      BankTransactionDirection.IN,
    );
  });

  /**
   * O sinal nunca é assumido (seção 21). Uma linha sem como decidir vira erro, não um
   * palpite — importar um débito como crédito inverte o caixa inteiro em silêncio.
   */
  it('recusa a linha quando não há como determinar o sentido', () => {
    const ambiguous = [
      'Data;Historico;Tipo;Valor',
      '03/07/2026;PAGAMENTO;X;100,00',
    ].join('\n');

    const statement = service.toStatement(
      service.parseCsvGrid(Buffer.from(ambiguous, 'utf8'), ';'),
      {
        columnMapping: {
          transactionDate: 'Data',
          description: 'Historico',
          type: 'Tipo',
          amount: 'Valor',
        },
        signRule: {
          kind: 'TYPE_COLUMN',
          creditValues: ['C'],
          debitValues: ['D'],
        },
        headerRow: 1,
        dataStartRow: 2,
      },
    );

    expect(statement.transactions[0].errors.length).toBeGreaterThan(0);
    expect(statement.transactions[0].direction).toBeNull();
  });

  it('aceita índice de coluna quando o arquivo não tem cabeçalho', () => {
    const headerless = ['03/07/2026;PAGAMENTO FORNECEDOR;-100,00'].join('\n');

    const statement = service.toStatement(
      service.parseCsvGrid(Buffer.from(headerless, 'utf8'), ';'),
      {
        columnMapping: { transactionDate: 0, description: 1, amount: 2 },
        signRule: { kind: 'SIGNED_AMOUNT' },
        headerRow: null,
        dataStartRow: 1,
      },
    );

    expect(statement.transactions).toHaveLength(1);
    expect(statement.transactions[0].amount).toBe(100);
  });
});
