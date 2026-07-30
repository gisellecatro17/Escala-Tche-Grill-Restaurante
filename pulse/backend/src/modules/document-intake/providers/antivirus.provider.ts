import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Varredura de malware por **abstração de provedor** (seções 10 e 11).
 *
 * Nesta etapa não há antivírus real contratado, e fingir que há seria pior do que não
 * ter: o resultado diria "limpo" sem ter verificado nada. O provedor `none` é honesto —
 * devolve `scanned: false`, e quem consome registra isso no documento.
 *
 * O provedor `eicar` reconhece a string de teste padrão da indústria, o que permite
 * verificar de ponta a ponta que o caminho de bloqueio funciona sem precisar de um
 * arquivo malicioso de verdade.
 */
export type AntivirusVerdict = 'CLEAN' | 'INFECTED' | 'NOT_SCANNED';

export interface AntivirusResult {
  verdict: AntivirusVerdict;
  /** `false` quando nenhum antivírus estava configurado — o arquivo não foi analisado. */
  scanned: boolean;
  provider: string;
  threatName?: string;
}

/** Assinatura de teste EICAR, usada mundialmente para validar antivírus. */
const EICAR_SIGNATURE =
  'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

export abstract class AntivirusProvider {
  abstract readonly name: string;
  abstract scan(buffer: Buffer, fileName: string): Promise<AntivirusResult>;
}

@Injectable()
export class AntivirusScanner extends AntivirusProvider {
  private readonly logger = new Logger(AntivirusScanner.name);
  readonly name: string;

  constructor(private readonly config: ConfigService) {
    super();
    this.name = this.config.get<string>('ANTIVIRUS_PROVIDER') ?? 'none';
  }

  async scan(buffer: Buffer, fileName: string): Promise<AntivirusResult> {
    // Mantém a assinatura assíncrona da abstração: um provedor real fará I/O aqui.
    await Promise.resolve();

    if (this.name === 'eicar') {
      const head = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('latin1');
      if (head.includes(EICAR_SIGNATURE)) {
        this.logger.warn(`Arquivo bloqueado pela varredura: ${fileName}`);
        return {
          verdict: 'INFECTED',
          scanned: true,
          provider: this.name,
          threatName: 'EICAR-Test-File',
        };
      }
      return { verdict: 'CLEAN', scanned: true, provider: this.name };
    }

    // Sem antivírus configurado, dizemos que não foi analisado — nunca que está limpo.
    return { verdict: 'NOT_SCANNED', scanned: false, provider: 'none' };
  }
}
