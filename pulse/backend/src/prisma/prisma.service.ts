import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * O Prisma 7 não abre mais conexão sozinho: o client exige um **driver adapter**
 * explícito. Sem ele, qualquer consulta falha com
 * `PrismaClientInitializationError: PrismaClient was instantiated without any options`.
 * Por isso o adapter `PrismaPg` é montado aqui a partir de `DATABASE_URL`.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
      }),
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Conectado ao PostgreSQL via Prisma.');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
