import { Injectable } from '@nestjs/common';
import {
  RecordStatus,
  type SupplierTaxWithholding,
  type TaxWithholdingType,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

export interface CalculatedWithholding {
  supplierTaxWithholdingId: string;
  taxType: TaxWithholdingType;
  calculationBase: number;
  rate: number;
  amount: number;
  minimumAmount: number | null;
}

/**
 * Calcula as retenções do lançamento a partir do que está cadastrado no vínculo do
 * fornecedor com a empresa.
 *
 * Três coisas que este serviço **não** faz, de propósito:
 *
 * - Não decide a alíquota. A alíquota vem do cadastro; o sistema não tem tabela fiscal
 *   embutida e inventar uma daria um número com cara de oficial e sem lastro.
 * - Não aplica a retenção sozinho. O resultado nasce como sugestão e só entra no valor
 *   líquido depois que alguém confirma — mesmo quando o cadastro diz `automatic`.
 * - Não gera guia, não recolhe e não informa nada a nenhum órgão.
 */
@Injectable()
export class WithholdingCalculatorService {
  constructor(private readonly prisma: PrismaService) {}

  async calculate(
    supplierCompanyLinkId: string | null,
    grossAmount: number,
  ): Promise<CalculatedWithholding[]> {
    if (!supplierCompanyLinkId) return [];

    const registered = await this.prisma.supplierTaxWithholding.findMany({
      where: {
        supplierCompanyLinkId,
        deletedAt: null,
        status: RecordStatus.ACTIVE,
      },
      orderBy: { taxType: 'asc' },
    });

    return registered
      .map((withholding) => this.apply(withholding, grossAmount))
      .filter((result): result is CalculatedWithholding => result !== null);
  }

  /**
   * Aplica uma retenção cadastrada sobre o valor bruto.
   *
   * A base de cálculo é o valor bruto. Bases diferentes por tributo (ISS sobre parte do
   * serviço, INSS sobre a mão de obra) dependem de informação que o documento não traz —
   * o campo `calculationBase` do cadastro é texto livre, descritivo, e usá-lo como
   * fórmula seria interpretar o que alguém escreveu à mão.
   */
  private apply(
    withholding: SupplierTaxWithholding,
    grossAmount: number,
  ): CalculatedWithholding | null {
    if (withholding.rate === null) return null;

    const rate = Number(withholding.rate);
    const minimum =
      withholding.minimumAmount === null
        ? null
        : Number(withholding.minimumAmount);

    const amount = round(grossAmount * (rate / 100));

    // O mínimo é do **valor retido**, não do valor do documento: é o piso abaixo do qual
    // não se retém.
    if (minimum !== null && amount < minimum) return null;
    if (amount <= 0) return null;

    return {
      supplierTaxWithholdingId: withholding.id,
      taxType: withholding.taxType,
      calculationBase: round(grossAmount),
      rate,
      amount,
      minimumAmount: minimum,
    };
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
