import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PermissionSeed {
  slug: string;
  module: string;
  description: string;
}

const PERMISSIONS: PermissionSeed[] = [
  // Cadastros — Empresas
  { slug: 'company.view', module: 'cadastros', description: 'Visualizar empresas' },
  { slug: 'company.create', module: 'cadastros', description: 'Incluir novas empresas' },
  { slug: 'company.update', module: 'cadastros', description: 'Editar empresas' },
  { slug: 'company.activate', module: 'cadastros', description: 'Ativar/reativar empresas' },
  { slug: 'company.deactivate', module: 'cadastros', description: 'Inativar empresas' },
  { slug: 'company.suspend', module: 'cadastros', description: 'Suspender empresas' },
  { slug: 'company.delete', module: 'cadastros', description: 'Excluir empresas (quando permitido)' },
  { slug: 'company.manage_users', module: 'cadastros', description: 'Gerenciar usuários da empresa' },
  { slug: 'company.manage_settings', module: 'cadastros', description: 'Gerenciar configurações financeiras da empresa' },
  { slug: 'company.view_audit', module: 'cadastros', description: 'Consultar histórico/auditoria da empresa' },
  { slug: 'company.query_document', module: 'cadastros', description: 'Consultar CNPJ/CPF em provider externo' },
  { slug: 'company.duplicate_settings', module: 'cadastros', description: 'Duplicar configurações entre empresas' },
  { slug: 'company.manage_logo', module: 'cadastros', description: 'Enviar/remover a logo da empresa' },
  // Cadastros — Fornecedores
  { slug: 'supplier.view', module: 'cadastros', description: 'Visualizar fornecedores' },
  { slug: 'supplier.create', module: 'cadastros', description: 'Incluir novos fornecedores' },
  { slug: 'supplier.update', module: 'cadastros', description: 'Editar dados cadastrais do fornecedor' },
  { slug: 'supplier.activate', module: 'cadastros', description: 'Ativar fornecedores/vínculos' },
  { slug: 'supplier.deactivate', module: 'cadastros', description: 'Inativar vínculos de fornecedor' },
  { slug: 'supplier.suspend', module: 'cadastros', description: 'Suspender vínculos de fornecedor' },
  { slug: 'supplier.block', module: 'cadastros', description: 'Bloquear fornecedor para a empresa' },
  { slug: 'supplier.unblock', module: 'cadastros', description: 'Desbloquear fornecedor para a empresa' },
  { slug: 'supplier.delete', module: 'cadastros', description: 'Excluir fornecedores/vínculos (quando permitido)' },
  { slug: 'supplier.query_document', module: 'cadastros', description: 'Consultar CPF/CNPJ de fornecedor em provider externo' },
  { slug: 'supplier.manage_company_link', module: 'cadastros', description: 'Vincular fornecedores a empresas' },
  { slug: 'supplier.manage_bank_data', module: 'cadastros', description: 'Gerenciar contas bancárias do fornecedor' },
  { slug: 'supplier.manage_pix_keys', module: 'cadastros', description: 'Gerenciar chaves PIX do fornecedor' },
  { slug: 'supplier.manage_classification', module: 'cadastros', description: 'Gerenciar classificação financeira do vínculo' },
  { slug: 'supplier.manage_rules', module: 'cadastros', description: 'Gerenciar regras automáticas do vínculo' },
  { slug: 'supplier.manage_allocations', module: 'cadastros', description: 'Gerenciar rateios padrão do vínculo' },
  { slug: 'supplier.manage_withholdings', module: 'cadastros', description: 'Gerenciar retenções tributárias do vínculo' },
  { slug: 'supplier.manage_contracts', module: 'cadastros', description: 'Gerenciar contratos do vínculo' },
  { slug: 'supplier.manage_documents', module: 'cadastros', description: 'Anexar/gerenciar documentos do fornecedor' },
  { slug: 'supplier.view_movements', module: 'cadastros', description: 'Visualizar movimentações do fornecedor' },
  { slug: 'supplier.view_audit', module: 'cadastros', description: 'Consultar histórico/auditoria do fornecedor' },
  { slug: 'supplier.duplicate_link', module: 'cadastros', description: 'Duplicar vínculo de fornecedor para outra empresa' },
  { slug: 'supplier.allow_third_party_bank_account', module: 'cadastros', description: 'Cadastrar contas/chaves PIX de terceiro para fornecedores' },
  { slug: 'supplier.view_bank_data', module: 'cadastros', description: 'Visualizar dados bancários completos (sem mascaramento)' },
  { slug: 'customers.view', module: 'cadastros', description: 'Visualizar clientes' },
  { slug: 'customers.manage', module: 'cadastros', description: 'Incluir/editar clientes' },
  { slug: 'categories.view', module: 'cadastros', description: 'Visualizar categorias financeiras' },
  { slug: 'categories.manage', module: 'cadastros', description: 'Incluir/editar categorias financeiras' },
  { slug: 'cost-centers.view', module: 'cadastros', description: 'Visualizar centros de custo' },
  { slug: 'cost-centers.manage', module: 'cadastros', description: 'Incluir/editar centros de custo' },
  { slug: 'bank-accounts.view', module: 'cadastros', description: 'Visualizar contas bancárias' },
  { slug: 'bank-accounts.manage', module: 'cadastros', description: 'Incluir/editar contas bancárias' },
  { slug: 'payment-methods.view', module: 'cadastros', description: 'Visualizar formas de pagamento' },
  { slug: 'payment-methods.manage', module: 'cadastros', description: 'Incluir/editar formas de pagamento' },
  { slug: 'acquirers.view', module: 'cadastros', description: 'Visualizar cartões e adquirentes' },
  { slug: 'acquirers.manage', module: 'cadastros', description: 'Incluir/editar cartões e adquirentes' },

  // Financeiro
  { slug: 'financial.view', module: 'financeiro', description: 'Visualizar visão financeira' },
  { slug: 'financial.documents', module: 'financeiro', description: 'Enviar documentos' },
  { slug: 'financial.process', module: 'financeiro', description: 'Processar lançamentos' },
  { slug: 'financial.approve', module: 'financeiro', description: 'Autorizar pagamentos' },
  { slug: 'payables.view', module: 'financeiro', description: 'Visualizar contas a pagar' },
  { slug: 'receivables.view', module: 'financeiro', description: 'Visualizar contas a receber' },
  { slug: 'financial.scheduled', module: 'financeiro', description: 'Visualizar agendados' },
  { slug: 'financial.paid', module: 'financeiro', description: 'Visualizar contas pagas' },
  { slug: 'financial.movements', module: 'financeiro', description: 'Visualizar movimentações' },
  { slug: 'bank-import.view', module: 'financeiro', description: 'Importação bancária' },
  { slug: 'reconciliation.view', module: 'financeiro', description: 'Conciliação bancária' },
  { slug: 'transfers.view', module: 'financeiro', description: 'Transferências' },
  { slug: 'financial.closing', module: 'financeiro', description: 'Fechamento financeiro' },

  // Inteligência Financeira
  { slug: 'bi.view', module: 'inteligencia-financeira', description: 'Dashboard gerencial' },
  { slug: 'bi.cash-flow', module: 'inteligencia-financeira', description: 'Fluxo de caixa' },
  { slug: 'bi.dre', module: 'inteligencia-financeira', description: 'DRE gerencial' },
  { slug: 'bi.revenue-expenses', module: 'inteligencia-financeira', description: 'Receitas e despesas' },
  { slug: 'bi.categories', module: 'inteligencia-financeira', description: 'Categorias (BI)' },
  { slug: 'bi.cost-centers', module: 'inteligencia-financeira', description: 'Centros de custo (BI)' },
  { slug: 'bi.suppliers', module: 'inteligencia-financeira', description: 'Fornecedores (BI)' },
  { slug: 'bi.customers', module: 'inteligencia-financeira', description: 'Clientes (BI)' },
  { slug: 'bi.indicators', module: 'inteligencia-financeira', description: 'Indicadores' },
  { slug: 'bi.reports', module: 'inteligencia-financeira', description: 'Relatórios' },

  // Configurações
  { slug: 'settings.organization', module: 'configuracoes', description: 'Dados da organização' },
  { slug: 'settings.users', module: 'configuracoes', description: 'Usuários' },
  { slug: 'settings.roles', module: 'configuracoes', description: 'Perfis' },
  { slug: 'settings.permissions', module: 'configuracoes', description: 'Permissões' },
  { slug: 'settings.financial-params', module: 'configuracoes', description: 'Parâmetros financeiros' },
  { slug: 'settings.approval-rules', module: 'configuracoes', description: 'Regras de aprovação' },
  { slug: 'settings.reconciliation-rules', module: 'configuracoes', description: 'Regras de conciliação' },
  { slug: 'settings.integrations', module: 'configuracoes', description: 'Integrações' },
  { slug: 'settings.notifications', module: 'configuracoes', description: 'Notificações' },
  { slug: 'settings.audit', module: 'configuracoes', description: 'Auditoria' },
];

const ALL_SLUGS = PERMISSIONS.map((p) => p.slug);
const CADASTROS_SLUGS = PERMISSIONS.filter((p) => p.module === 'cadastros').map((p) => p.slug);
const BI_SLUGS = PERMISSIONS.filter((p) => p.module === 'inteligencia-financeira').map((p) => p.slug);

/**
 * Ações de empresa do dia a dia, liberadas também para perfis financeiros/operacionais.
 * As ações reservadas a administradores (company.activate/deactivate/suspend/delete) ficam
 * de fora — permanecem restritas a organization_admin/company_admin/platform_admin.
 */
const COMPANY_OPERATIONAL_SLUGS = [
  'company.view',
  'company.create',
  'company.update',
  'company.manage_users',
  'company.manage_settings',
  'company.view_audit',
  'company.query_document',
  'company.duplicate_settings',
  'company.manage_logo',
];

const ROLES: {
  slug: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: string[];
}[] = [
  {
    slug: 'platform_admin',
    name: 'Administrador da plataforma',
    description: 'Acesso global à plataforma Pulse (equipe Pulse).',
    isSystem: true,
    permissions: ALL_SLUGS,
  },
  {
    slug: 'organization_admin',
    name: 'Administrador da organização',
    description: 'Gerencia organizações, empresas, usuários e configurações.',
    isSystem: true,
    permissions: ALL_SLUGS,
  },
  {
    slug: 'company_admin',
    name: 'Administrador da empresa',
    description: 'Gerencia os dados da empresa.',
    isSystem: true,
    permissions: ALL_SLUGS.filter((s) => s !== 'settings.organization'),
  },
  {
    slug: 'financial',
    name: 'Financeiro',
    description: 'Opera rotinas financeiras completas.',
    isSystem: true,
    permissions: [
      ...CADASTROS_SLUGS.filter((s) => !s.startsWith('company.')),
      ...COMPANY_OPERATIONAL_SLUGS,
      'financial.view',
      'financial.documents',
      'financial.process',
      'financial.approve',
      'payables.view',
      'receivables.view',
      'financial.scheduled',
      'financial.paid',
      'financial.movements',
      'bank-import.view',
      'reconciliation.view',
      'transfers.view',
      'financial.closing',
      ...BI_SLUGS,
    ],
  },
  {
    slug: 'financial_operator',
    name: 'Operador financeiro',
    description: 'Inclui e processa informações, com restrições.',
    isSystem: true,
    permissions: [
      'company.view',
      'supplier.view',
      'supplier.create',
      'supplier.update',
      'supplier.manage_company_link',
      'supplier.manage_classification',
      'supplier.query_document',
      'supplier.manage_documents',
      'supplier.view_movements',
      'customers.view',
      'customers.manage',
      'categories.view',
      'cost-centers.view',
      'bank-accounts.view',
      'payment-methods.view',
      'financial.view',
      'financial.documents',
      'financial.process',
      'payables.view',
      'receivables.view',
      'financial.scheduled',
      'financial.movements',
      'bank-import.view',
    ],
  },
  {
    slug: 'approver',
    name: 'Aprovador',
    description: 'Aprova ou rejeita pagamentos.',
    isSystem: true,
    permissions: ['financial.view', 'financial.approve', 'payables.view', 'receivables.view', 'bi.view'],
  },
  {
    slug: 'manager',
    name: 'Gestor',
    description: 'Consulta dashboards, relatórios e indicadores.',
    isSystem: true,
    permissions: ['financial.view', ...BI_SLUGS],
  },
  {
    slug: 'accountant',
    name: 'Contador',
    description: 'Consulta dados contábeis, relatórios e exportações.',
    isSystem: true,
    permissions: ['financial.view', 'financial.paid', ...BI_SLUGS],
  },
];

async function main() {
  console.log('Aplicando seed de permissões...');
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { slug: permission.slug },
      update: { module: permission.module, description: permission.description },
      create: permission,
    });
  }

  console.log('Aplicando seed de perfis...');
  for (const role of ROLES) {
    const created = await prisma.role.upsert({
      where: { slug: role.slug },
      update: { name: role.name, description: role.description, isSystem: role.isSystem },
      create: {
        slug: role.slug,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
      },
    });

    const permissions = await prisma.permission.findMany({
      where: { slug: { in: role.permissions } },
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: created.id } });
    await prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({ roleId: created.id, permissionId: permission.id })),
      skipDuplicates: true,
    });
  }

  console.log('Aplicando seed de organização/empresa de demonstração...');
  const organization = await prisma.organization.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Tchê Grill',
    },
  });

  const company = await prisma.company.upsert({
    where: { normalizedDocumentNumber: '11222333000181' },
    update: {},
    create: {
      organizationId: organization.id,
      internalCode: 'EMP-0001',
      personType: 'LEGAL_ENTITY',
      documentNumber: '11222333000181',
      normalizedDocumentNumber: '11222333000181',
      legalName: 'Tchê Grill Restaurante Ltda.',
      tradeName: 'Tchê Grill',
      displayName: 'Tchê Grill — Governador Mangabeira',
      establishmentType: 'HEADQUARTERS',
      externalRegistrationStatus: 'ATIVA',
      systemStatus: 'ACTIVE',
      taxRegime: 'SIMPLES_NACIONAL',
      taxAssessmentMethod: 'ACCRUAL',
      financialMethod: 'ACCRUAL',
      timezone: 'America/Bahia',
      addresses: {
        create: [
          {
            addressType: 'FISCAL',
            postalCode: '44350-000',
            normalizedPostalCode: '44350000',
            street: 'Avenida Governador Mangabeira',
            number: '100',
            district: 'Centro',
            city: 'Governador Mangabeira',
            state: 'BA',
            isPrimary: true,
          },
        ],
      },
    },
  });

  console.log('Aplicando seed do catálogo de instituições financeiras...');
  const FINANCIAL_INSTITUTIONS = [
    { compeCode: '001', ispb: '00000000', legalName: 'Banco do Brasil S.A.', shortName: 'Banco do Brasil' },
    { compeCode: '033', ispb: '90400888', legalName: 'Banco Santander (Brasil) S.A.', shortName: 'Santander' },
    { compeCode: '104', ispb: '00360305', legalName: 'Caixa Econômica Federal', shortName: 'Caixa' },
    { compeCode: '237', ispb: '60746948', legalName: 'Banco Bradesco S.A.', shortName: 'Bradesco' },
    { compeCode: '341', ispb: '60701190', legalName: 'Itaú Unibanco S.A.', shortName: 'Itaú' },
    { compeCode: '260', ispb: '18236120', legalName: 'Nu Pagamentos S.A.', shortName: 'Nubank' },
    { compeCode: '748', ispb: '01181521', legalName: 'Banco Cooperativo Sicredi S.A.', shortName: 'Sicredi' },
    { compeCode: '077', ispb: '16501555', legalName: 'Banco Inter S.A.', shortName: 'Inter' },
  ];
  for (const institution of FINANCIAL_INSTITUTIONS) {
    await prisma.financialInstitution.upsert({
      where: { compeCode: institution.compeCode },
      update: { legalName: institution.legalName, shortName: institution.shortName, ispb: institution.ispb },
      create: institution,
    });
  }

  console.log('Aplicando seed de fornecedor de demonstração...');
  const demoSupplier = await prisma.supplier.upsert({
    where: { normalizedDocumentNumber: '22333444000155' },
    update: {},
    create: {
      organizationId: organization.id,
      personType: 'LEGAL_ENTITY',
      documentNumber: '22333444000155',
      normalizedDocumentNumber: '22333444000155',
      legalName: 'Frigorífico Boi Forte Ltda.',
      tradeName: 'Boi Forte',
      displayName: 'Frigorífico Boi Forte',
      externalRegistrationStatus: 'ATIVA',
      systemStatus: 'ACTIVE',
      segment: 'Carnes e derivados',
      phone: '(75) 3333-4444',
      email: 'contato@boiforte.example.com',
      addresses: {
        create: [
          {
            addressType: 'FISCAL',
            postalCode: '44350-100',
            normalizedPostalCode: '44350100',
            street: 'Rodovia BA-052',
            number: 'km 5',
            district: 'Distrito Industrial',
            city: 'Governador Mangabeira',
            state: 'BA',
            isPrimary: true,
          },
        ],
      },
      alternativeNames: {
        create: [
          { name: 'Boi Forte', normalizedName: 'BOI FORTE' },
          { name: 'Frig Boi Forte', normalizedName: 'FRIG BOI FORTE' },
        ],
      },
    },
  });

  const carnesCategory = await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000101' },
    update: {},
    create: { id: '00000000-0000-0000-0000-000000000101', companyId: company.id, name: 'Carnes e proteínas' },
  });
  const churrasqueiraCostCenter = await prisma.costCenter.upsert({
    where: { id: '00000000-0000-0000-0000-000000000201' },
    update: {},
    create: { id: '00000000-0000-0000-0000-000000000201', companyId: company.id, name: 'Churrasqueira' },
  });

  await prisma.supplierCompanyLink.upsert({
    where: { supplierId_companyId: { supplierId: demoSupplier.id, companyId: company.id } },
    update: {},
    create: {
      supplierId: demoSupplier.id,
      companyId: company.id,
      supplierTypes: ['MERCHANDISE'],
      defaultCategoryId: carnesCategory.id,
      defaultCostCenterId: churrasqueiraCostCenter.id,
      financialNature: 'COST',
      defaultDescription: 'Compra de carnes para churrasco',
      preferredPaymentMethod: 'PIX',
      status: 'ACTIVE',
      autoIdentificationEnabled: true,
      autoClassificationEnabled: true,
      reconciliationSuggestionEnabled: true,
      autoReconciliationEnabled: false,
      confirmationThreshold: 95,
    },
  });

  console.log('Seed concluído com sucesso.');
  console.log(
    'Para vincular seu usuário Supabase como Administrador da organização, veja as instruções no README (seção "Primeiro acesso").',
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
