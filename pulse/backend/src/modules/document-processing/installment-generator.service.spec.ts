import { InstallmentGeneratorService } from './installment-generator.service';

describe('Geração de parcelas', () => {
  const service = new InstallmentGeneratorService();

  it('gera uma parcela única para lançamento à vista', () => {
    const plan = service.plan({
      netAmount: 2450,
      firstDueDate: new Date(Date.UTC(2026, 7, 10)),
      count: 1,
    });

    expect(plan).toHaveLength(1);
    expect(plan[0].installmentNumber).toBe(1);
    expect(plan[0].totalInstallments).toBe(1);
    expect(plan[0].netAmount).toBe(2450);
  });

  it('soma das parcelas fecha exatamente com o total mesmo quando não divide', () => {
    const plan = service.plan({
      netAmount: 100,
      firstDueDate: new Date(Date.UTC(2026, 0, 10)),
      count: 3,
    });

    const sum = plan.reduce((total, item) => total + item.netAmount, 0);

    expect(sum).toBe(100);
    expect(plan.map((item) => item.netAmount)).toEqual([33.33, 33.33, 33.34]);
  });

  it('joga a sobra de arredondamento na última parcela', () => {
    const plan = service.plan({
      netAmount: 1000,
      firstDueDate: new Date(Date.UTC(2026, 0, 10)),
      count: 7,
    });

    const sum = plan.reduce((total, item) => total + item.netAmount, 0);

    expect(sum).toBeCloseTo(1000, 2);
    expect(plan[6].netAmount).toBeGreaterThan(plan[0].netAmount);
  });

  it('avança 30 dias entre parcelas quando não há dia fixo', () => {
    const plan = service.plan({
      netAmount: 300,
      firstDueDate: new Date(Date.UTC(2026, 0, 10)),
      count: 3,
    });

    expect(plan[0].dueDate.toISOString().slice(0, 10)).toBe('2026-01-10');
    expect(plan[1].dueDate.toISOString().slice(0, 10)).toBe('2026-02-09');
    expect(plan[2].dueDate.toISOString().slice(0, 10)).toBe('2026-03-11');
  });

  it('respeita o intervalo informado pelo vínculo do fornecedor', () => {
    const plan = service.plan({
      netAmount: 300,
      firstDueDate: new Date(Date.UTC(2026, 0, 1)),
      count: 3,
      intervalDays: 15,
    });

    expect(plan[1].dueDate.toISOString().slice(0, 10)).toBe('2026-01-16');
    expect(plan[2].dueDate.toISOString().slice(0, 10)).toBe('2026-01-31');
  });

  it('mantém o dia fixo mês a mês', () => {
    const plan = service.plan({
      netAmount: 300,
      firstDueDate: new Date(Date.UTC(2026, 0, 5)),
      count: 3,
      fixedDueDay: 5,
    });

    expect(plan.map((item) => item.dueDate.toISOString().slice(0, 10))).toEqual(
      ['2026-01-05', '2026-02-05', '2026-03-05'],
    );
  });

  it('limita o dia fixo ao último dia do mês em vez de vazar para o mês seguinte', () => {
    const plan = service.plan({
      netAmount: 300,
      firstDueDate: new Date(Date.UTC(2026, 0, 31)),
      count: 3,
      fixedDueDay: 31,
    });

    // Fevereiro de 2026 tem 28 dias: a parcela cai em 28, não em 3 de março.
    expect(plan[1].dueDate.toISOString().slice(0, 10)).toBe('2026-02-28');
    expect(plan[2].dueDate.toISOString().slice(0, 10)).toBe('2026-03-31');
  });

  it('atravessa a virada de ano com dia fixo', () => {
    const plan = service.plan({
      netAmount: 400,
      firstDueDate: new Date(Date.UTC(2026, 10, 15)),
      count: 4,
      fixedDueDay: 15,
    });

    expect(plan.map((item) => item.dueDate.toISOString().slice(0, 10))).toEqual(
      ['2026-11-15', '2026-12-15', '2027-01-15', '2027-02-15'],
    );
  });

  it('copia o código de cobrança quando é parcela única', () => {
    const plan = service.plan({
      netAmount: 100,
      firstDueDate: new Date(Date.UTC(2026, 0, 10)),
      count: 1,
      codes: [{ barcode: '001999', digitableLine: '00190000090' }],
    });

    expect(plan[0].digitableLine).toBe('00190000090');
  });

  it('deixa a parcela sem código quando o documento não traz um por parcela', () => {
    const plan = service.plan({
      netAmount: 300,
      firstDueDate: new Date(Date.UTC(2026, 0, 10)),
      count: 3,
    });

    expect(plan.every((item) => item.digitableLine === null)).toBe(true);
  });
});
