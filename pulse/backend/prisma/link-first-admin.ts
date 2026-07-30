/**
 * Vincula um usuário já cadastrado no Supabase Auth (por e-mail) como
 * Administrador da organização de demonstração ("Tchê Grill").
 *
 * Uso: npm run seed:admin -- seu-email@empresa.com
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const DEMO_ORGANIZATION_ID = '00000000-0000-0000-0000-000000000001';

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error(
      'Informe o e-mail do usuário. Ex.: npm run seed:admin -- voce@empresa.com',
    );
    process.exit(1);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      'Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env antes de rodar este script.',
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const { data, error } = await supabase.auth.admin.listUsers();

    if (error) {
      throw error;
    }

    const authUser = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );

    if (!authUser) {
      console.error(
        `Nenhum usuário com o e-mail "${email}" foi encontrado no Supabase Auth. Crie a conta primeiro (tela de login > "Esqueci minha senha" ou convite).`,
      );
      process.exit(1);
    }

    await prisma.user.upsert({
      where: { id: authUser.id },
      update: { email },
      create: {
        id: authUser.id,
        email,
        name:
          (authUser.user_metadata?.full_name as string | undefined) ?? email,
      },
    });

    const role = await prisma.role.findUniqueOrThrow({
      where: { slug: 'organization_admin' },
    });

    await prisma.userOrganizationRole.upsert({
      where: {
        userId_organizationId: {
          userId: authUser.id,
          organizationId: DEMO_ORGANIZATION_ID,
        },
      },
      update: { roleId: role.id, status: 'ACTIVE' },
      create: {
        userId: authUser.id,
        organizationId: DEMO_ORGANIZATION_ID,
        roleId: role.id,
      },
    });

    console.log(
      `Usuário ${email} vinculado como Administrador da organização "Tchê Grill".`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
