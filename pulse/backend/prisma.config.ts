import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Endereço usado pelos comandos do Prisma (migrate, seed, studio).
 *
 * `DIRECT_URL` vence quando existe. Provedores gerenciados — Supabase, Neon — servem o
 * mesmo banco por dois endereços: um **pooler**, que reaproveita conexões e é o certo para
 * o dia a dia da API, e um **direto**, que sustenta transação longa.
 *
 * Uma migration é exatamente uma transação longa: pelo pooler ela falha no meio, deixando
 * metade das tabelas criadas. Por isso o CLI usa a direta enquanto o runtime
 * (`PrismaService`, via adapter) continua no pooler.
 *
 * Quem roda um Postgres local define só `DATABASE_URL` e nada muda.
 */
const migrationUrl = process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'];

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node --transpile-only prisma/seed.ts',
  },
  datasource: {
    url: migrationUrl,
  },
});
