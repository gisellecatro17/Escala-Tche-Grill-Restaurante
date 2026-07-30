import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  type AccountPlanType,
  type FinancialNatureKind,
} from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

interface PermissionSeed {
  slug: string;
  module: string;
  description: string;
}

const PERMISSIONS: PermissionSeed[] = [
  // Cadastros — Empresas
  {
    slug: 'company.view',
    module: 'cadastros',
    description: 'Visualizar empresas',
  },
  {
    slug: 'company.create',
    module: 'cadastros',
    description: 'Incluir novas empresas',
  },
  {
    slug: 'company.update',
    module: 'cadastros',
    description: 'Editar empresas',
  },
  {
    slug: 'company.activate',
    module: 'cadastros',
    description: 'Ativar/reativar empresas',
  },
  {
    slug: 'company.deactivate',
    module: 'cadastros',
    description: 'Inativar empresas',
  },
  {
    slug: 'company.suspend',
    module: 'cadastros',
    description: 'Suspender empresas',
  },
  {
    slug: 'company.delete',
    module: 'cadastros',
    description: 'Excluir empresas (quando permitido)',
  },
  {
    slug: 'company.manage_users',
    module: 'cadastros',
    description: 'Gerenciar usuários da empresa',
  },
  {
    slug: 'company.manage_settings',
    module: 'cadastros',
    description: 'Gerenciar configurações financeiras da empresa',
  },
  {
    slug: 'company.view_audit',
    module: 'cadastros',
    description: 'Consultar histórico/auditoria da empresa',
  },
  {
    slug: 'company.query_document',
    module: 'cadastros',
    description: 'Consultar CNPJ/CPF em provider externo',
  },
  {
    slug: 'company.duplicate_settings',
    module: 'cadastros',
    description: 'Duplicar configurações entre empresas',
  },
  {
    slug: 'company.manage_logo',
    module: 'cadastros',
    description: 'Enviar/remover a logo da empresa',
  },
  // Cadastros — Fornecedores
  {
    slug: 'supplier.view',
    module: 'cadastros',
    description: 'Visualizar fornecedores',
  },
  {
    slug: 'supplier.create',
    module: 'cadastros',
    description: 'Incluir novos fornecedores',
  },
  {
    slug: 'supplier.update',
    module: 'cadastros',
    description: 'Editar dados cadastrais do fornecedor',
  },
  {
    slug: 'supplier.activate',
    module: 'cadastros',
    description: 'Ativar fornecedores/vínculos',
  },
  {
    slug: 'supplier.deactivate',
    module: 'cadastros',
    description: 'Inativar vínculos de fornecedor',
  },
  {
    slug: 'supplier.suspend',
    module: 'cadastros',
    description: 'Suspender vínculos de fornecedor',
  },
  {
    slug: 'supplier.block',
    module: 'cadastros',
    description: 'Bloquear fornecedor para a empresa',
  },
  {
    slug: 'supplier.unblock',
    module: 'cadastros',
    description: 'Desbloquear fornecedor para a empresa',
  },
  {
    slug: 'supplier.delete',
    module: 'cadastros',
    description: 'Excluir fornecedores/vínculos (quando permitido)',
  },
  {
    slug: 'supplier.query_document',
    module: 'cadastros',
    description: 'Consultar CPF/CNPJ de fornecedor em provider externo',
  },
  {
    slug: 'supplier.manage_company_link',
    module: 'cadastros',
    description: 'Vincular fornecedores a empresas',
  },
  {
    slug: 'supplier.manage_bank_data',
    module: 'cadastros',
    description: 'Gerenciar contas bancárias do fornecedor',
  },
  {
    slug: 'supplier.manage_pix_keys',
    module: 'cadastros',
    description: 'Gerenciar chaves PIX do fornecedor',
  },
  {
    slug: 'supplier.manage_classification',
    module: 'cadastros',
    description: 'Gerenciar classificação financeira do vínculo',
  },
  {
    slug: 'supplier.manage_rules',
    module: 'cadastros',
    description: 'Gerenciar regras automáticas do vínculo',
  },
  {
    slug: 'supplier.manage_allocations',
    module: 'cadastros',
    description: 'Gerenciar rateios padrão do vínculo',
  },
  {
    slug: 'supplier.manage_withholdings',
    module: 'cadastros',
    description: 'Gerenciar retenções tributárias do vínculo',
  },
  {
    slug: 'supplier.manage_contracts',
    module: 'cadastros',
    description: 'Gerenciar contratos do vínculo',
  },
  {
    slug: 'supplier.manage_documents',
    module: 'cadastros',
    description: 'Anexar/gerenciar documentos do fornecedor',
  },
  {
    slug: 'supplier.view_movements',
    module: 'cadastros',
    description: 'Visualizar movimentações do fornecedor',
  },
  {
    slug: 'supplier.view_audit',
    module: 'cadastros',
    description: 'Consultar histórico/auditoria do fornecedor',
  },
  {
    slug: 'supplier.duplicate_link',
    module: 'cadastros',
    description: 'Duplicar vínculo de fornecedor para outra empresa',
  },
  {
    slug: 'supplier.allow_third_party_bank_account',
    module: 'cadastros',
    description: 'Cadastrar contas/chaves PIX de terceiro para fornecedores',
  },
  {
    slug: 'supplier.view_bank_data',
    module: 'cadastros',
    description: 'Visualizar dados bancários completos (sem mascaramento)',
  },
  // Cadastros — Clientes
  {
    slug: 'customer.view',
    module: 'cadastros',
    description: 'Visualizar clientes',
  },
  {
    slug: 'customer.create',
    module: 'cadastros',
    description: 'Incluir novos clientes/prospects',
  },
  {
    slug: 'customer.update',
    module: 'cadastros',
    description: 'Editar dados cadastrais do cliente',
  },
  {
    slug: 'customer.activate',
    module: 'cadastros',
    description: 'Ativar vínculos de cliente',
  },
  {
    slug: 'customer.deactivate',
    module: 'cadastros',
    description: 'Inativar vínculos de cliente',
  },
  {
    slug: 'customer.suspend',
    module: 'cadastros',
    description: 'Suspender vínculos de cliente',
  },
  {
    slug: 'customer.block',
    module: 'cadastros',
    description: 'Bloquear cliente para a empresa',
  },
  {
    slug: 'customer.unblock',
    module: 'cadastros',
    description: 'Desbloquear cliente para a empresa',
  },
  {
    slug: 'customer.delete',
    module: 'cadastros',
    description: 'Excluir clientes/vínculos (quando permitido)',
  },
  {
    slug: 'customer.query_document',
    module: 'cadastros',
    description: 'Consultar CPF/CNPJ de cliente em provider externo',
  },
  {
    slug: 'customer.manage_company_link',
    module: 'cadastros',
    description: 'Vincular clientes a empresas',
  },
  {
    slug: 'customer.manage_classification',
    module: 'cadastros',
    description: 'Gerenciar classificação comercial do vínculo',
  },
  {
    slug: 'customer.manage_payment_terms',
    module: 'cadastros',
    description: 'Gerenciar condições de recebimento',
  },
  {
    slug: 'customer.manage_credit',
    module: 'cadastros',
    description: 'Gerenciar configurações gerais de crédito',
  },
  {
    slug: 'customer.manage_risk',
    module: 'cadastros',
    description: 'Gerenciar nível de risco',
  },
  {
    slug: 'customer.manage_billing_rules',
    module: 'cadastros',
    description: 'Gerenciar regras de cobrança e histórico',
  },
  {
    slug: 'customer.manage_contracts',
    module: 'cadastros',
    description: 'Gerenciar contratos e aditivos',
  },
  {
    slug: 'customer.manage_recurring_rules',
    module: 'cadastros',
    description: 'Gerenciar recorrências financeiras',
  },
  {
    slug: 'customer.manage_documents',
    module: 'cadastros',
    description: 'Anexar/gerenciar documentos do cliente',
  },
  {
    slug: 'customer.manage_payment_promises',
    module: 'cadastros',
    description: 'Registrar/atualizar promessas de pagamento',
  },
  {
    slug: 'customer.view_financial_history',
    module: 'cadastros',
    description: 'Visualizar histórico financeiro do cliente',
  },
  {
    slug: 'customer.view_receivables',
    module: 'cadastros',
    description: 'Visualizar contas a receber do cliente',
  },
  {
    slug: 'customer.view_collections',
    module: 'cadastros',
    description: 'Visualizar histórico de cobrança',
  },
  {
    slug: 'customer.view_audit',
    module: 'cadastros',
    description: 'Consultar histórico/auditoria do cliente',
  },
  {
    slug: 'customer.duplicate_link',
    module: 'cadastros',
    description: 'Duplicar vínculo de cliente para outra empresa',
  },
  {
    slug: 'customer.convert_prospect',
    module: 'cadastros',
    description: 'Converter prospect em cliente ativo',
  },
  {
    slug: 'customer.view_credit_information',
    module: 'cadastros',
    description:
      'Visualizar limite de crédito e informações financeiras sensíveis',
  },
  {
    slug: 'customer.update_credit_limit',
    module: 'cadastros',
    description: 'Alterar limite de crédito',
  },
  {
    slug: 'customer.authorize_over_credit_limit',
    module: 'cadastros',
    description: 'Autorizar lançamentos acima do limite de crédito',
  },
  {
    slug: 'customer.view_sensitive_contacts',
    module: 'cadastros',
    description: 'Visualizar dados completos de contatos do cliente',
  },
  // Estrutura financeira — guarda-chuva do módulo
  {
    slug: 'financial_structure.view',
    module: 'cadastros',
    description: 'Visualizar a estrutura financeira',
  },
  {
    slug: 'financial_structure.manage',
    module: 'cadastros',
    description: 'Gerenciar a estrutura financeira',
  },

  // Estrutura financeira — plano de contas
  {
    slug: 'account_plan.view',
    module: 'cadastros',
    description: 'Visualizar o plano de contas',
  },
  {
    slug: 'account_plan.create',
    module: 'cadastros',
    description: 'Incluir contas no plano de contas',
  },
  {
    slug: 'account_plan.update',
    module: 'cadastros',
    description: 'Editar contas do plano de contas',
  },
  {
    slug: 'account_plan.move',
    module: 'cadastros',
    description: 'Mover/reorganizar a árvore do plano de contas',
  },
  {
    slug: 'account_plan.activate',
    module: 'cadastros',
    description: 'Ativar contas do plano de contas',
  },
  {
    slug: 'account_plan.deactivate',
    module: 'cadastros',
    description: 'Inativar contas do plano de contas',
  },
  {
    slug: 'account_plan.delete',
    module: 'cadastros',
    description: 'Excluir contas do plano de contas',
  },
  {
    slug: 'account_plan.import',
    module: 'cadastros',
    description: 'Importar plano de contas',
  },
  {
    slug: 'account_plan.export',
    module: 'cadastros',
    description: 'Exportar plano de contas',
  },
  {
    slug: 'account_plan.version',
    module: 'cadastros',
    description: 'Gerenciar versões do plano de contas',
  },

  // Estrutura financeira — categorias
  {
    slug: 'financial_category.view',
    module: 'cadastros',
    description: 'Visualizar categorias financeiras',
  },
  {
    slug: 'financial_category.create',
    module: 'cadastros',
    description: 'Incluir categorias financeiras',
  },
  {
    slug: 'financial_category.update',
    module: 'cadastros',
    description: 'Editar categorias financeiras',
  },
  {
    slug: 'financial_category.move',
    module: 'cadastros',
    description: 'Mover/reorganizar a árvore de categorias',
  },
  {
    slug: 'financial_category.activate',
    module: 'cadastros',
    description: 'Ativar categorias financeiras',
  },
  {
    slug: 'financial_category.deactivate',
    module: 'cadastros',
    description: 'Inativar categorias financeiras',
  },
  {
    slug: 'financial_category.delete',
    module: 'cadastros',
    description: 'Excluir categorias financeiras',
  },
  {
    slug: 'financial_category.import',
    module: 'cadastros',
    description: 'Importar categorias financeiras',
  },
  {
    slug: 'financial_category.export',
    module: 'cadastros',
    description: 'Exportar categorias financeiras',
  },
  {
    slug: 'financial_category.manage_rules',
    module: 'cadastros',
    description: 'Gerenciar regras automáticas das categorias',
  },

  // Estrutura financeira — centros de custo
  {
    slug: 'cost_center.view',
    module: 'cadastros',
    description: 'Visualizar centros de custo',
  },
  {
    slug: 'cost_center.create',
    module: 'cadastros',
    description: 'Incluir centros de custo',
  },
  {
    slug: 'cost_center.update',
    module: 'cadastros',
    description: 'Editar centros de custo',
  },
  {
    slug: 'cost_center.move',
    module: 'cadastros',
    description: 'Mover/reorganizar a árvore de centros de custo',
  },
  {
    slug: 'cost_center.activate',
    module: 'cadastros',
    description: 'Ativar centros de custo',
  },
  {
    slug: 'cost_center.deactivate',
    module: 'cadastros',
    description: 'Inativar centros de custo',
  },
  {
    slug: 'cost_center.delete',
    module: 'cadastros',
    description: 'Excluir centros de custo',
  },

  // Estrutura financeira — centros de resultado
  {
    slug: 'result_center.view',
    module: 'cadastros',
    description: 'Visualizar centros de resultado',
  },
  {
    slug: 'result_center.create',
    module: 'cadastros',
    description: 'Incluir centros de resultado',
  },
  {
    slug: 'result_center.update',
    module: 'cadastros',
    description: 'Editar centros de resultado',
  },
  {
    slug: 'result_center.move',
    module: 'cadastros',
    description: 'Mover/reorganizar a árvore de centros de resultado',
  },
  {
    slug: 'result_center.activate',
    module: 'cadastros',
    description: 'Ativar centros de resultado',
  },
  {
    slug: 'result_center.deactivate',
    module: 'cadastros',
    description: 'Inativar centros de resultado',
  },
  {
    slug: 'result_center.delete',
    module: 'cadastros',
    description: 'Excluir centros de resultado',
  },

  // Estrutura financeira — projetos
  {
    slug: 'project.view',
    module: 'cadastros',
    description: 'Visualizar projetos',
  },
  {
    slug: 'project.create',
    module: 'cadastros',
    description: 'Incluir projetos',
  },
  {
    slug: 'project.update',
    module: 'cadastros',
    description: 'Editar projetos',
  },
  {
    slug: 'project.activate',
    module: 'cadastros',
    description: 'Ativar projetos',
  },
  {
    slug: 'project.pause',
    module: 'cadastros',
    description: 'Pausar projetos',
  },
  {
    slug: 'project.complete',
    module: 'cadastros',
    description: 'Concluir projetos',
  },
  {
    slug: 'project.cancel',
    module: 'cadastros',
    description: 'Cancelar projetos',
  },
  {
    slug: 'project.archive',
    module: 'cadastros',
    description: 'Arquivar projetos',
  },
  {
    slug: 'project.delete',
    module: 'cadastros',
    description: 'Excluir projetos',
  },

  // Estrutura financeira — unidades de negócio
  {
    slug: 'business_unit.view',
    module: 'cadastros',
    description: 'Visualizar unidades de negócio',
  },
  {
    slug: 'business_unit.create',
    module: 'cadastros',
    description: 'Incluir unidades de negócio',
  },
  {
    slug: 'business_unit.update',
    module: 'cadastros',
    description: 'Editar unidades de negócio',
  },
  {
    slug: 'business_unit.move',
    module: 'cadastros',
    description: 'Mover/reorganizar unidades de negócio',
  },
  {
    slug: 'business_unit.activate',
    module: 'cadastros',
    description: 'Ativar unidades de negócio',
  },
  {
    slug: 'business_unit.deactivate',
    module: 'cadastros',
    description: 'Inativar unidades de negócio',
  },
  {
    slug: 'business_unit.delete',
    module: 'cadastros',
    description: 'Excluir unidades de negócio',
  },

  // Estrutura financeira — naturezas
  {
    slug: 'financial_nature.view',
    module: 'cadastros',
    description: 'Visualizar naturezas financeiras',
  },
  {
    slug: 'financial_nature.create',
    module: 'cadastros',
    description: 'Incluir naturezas financeiras',
  },
  {
    slug: 'financial_nature.update',
    module: 'cadastros',
    description: 'Editar naturezas financeiras',
  },
  {
    slug: 'financial_nature.activate',
    module: 'cadastros',
    description: 'Ativar naturezas financeiras',
  },
  {
    slug: 'financial_nature.deactivate',
    module: 'cadastros',
    description: 'Inativar naturezas financeiras',
  },
  {
    slug: 'financial_nature.delete',
    module: 'cadastros',
    description: 'Excluir naturezas financeiras',
  },

  // Estrutura financeira — tags
  {
    slug: 'financial_tag.view',
    module: 'cadastros',
    description: 'Visualizar tags financeiras',
  },
  {
    slug: 'financial_tag.create',
    module: 'cadastros',
    description: 'Incluir tags financeiras',
  },
  {
    slug: 'financial_tag.update',
    module: 'cadastros',
    description: 'Editar tags financeiras',
  },
  {
    slug: 'financial_tag.manage',
    module: 'cadastros',
    description: 'Vincular/desvincular tags financeiras',
  },
  {
    slug: 'financial_tag.delete',
    module: 'cadastros',
    description: 'Excluir tags financeiras',
  },

  // Estrutura financeira — rateios
  {
    slug: 'allocation_rule.view',
    module: 'cadastros',
    description: 'Visualizar modelos de rateio',
  },
  {
    slug: 'allocation_rule.create',
    module: 'cadastros',
    description: 'Incluir modelos de rateio',
  },
  {
    slug: 'allocation_rule.update',
    module: 'cadastros',
    description: 'Editar modelos de rateio',
  },
  {
    slug: 'allocation_rule.activate',
    module: 'cadastros',
    description: 'Ativar modelos de rateio',
  },
  {
    slug: 'allocation_rule.deactivate',
    module: 'cadastros',
    description: 'Inativar modelos de rateio',
  },
  {
    slug: 'allocation_rule.delete',
    module: 'cadastros',
    description: 'Excluir modelos de rateio',
  },

  // Estrutura financeira — regras de classificação
  {
    slug: 'classification_rule.view',
    module: 'cadastros',
    description: 'Visualizar regras de classificação',
  },
  {
    slug: 'classification_rule.create',
    module: 'cadastros',
    description: 'Incluir regras de classificação',
  },
  {
    slug: 'classification_rule.update',
    module: 'cadastros',
    description: 'Editar regras de classificação',
  },
  {
    slug: 'classification_rule.test',
    module: 'cadastros',
    description: 'Testar/simular regras de classificação',
  },
  {
    slug: 'classification_rule.activate',
    module: 'cadastros',
    description: 'Ativar regras de classificação',
  },
  {
    slug: 'classification_rule.deactivate',
    module: 'cadastros',
    description: 'Inativar regras de classificação',
  },
  {
    slug: 'classification_rule.delete',
    module: 'cadastros',
    description: 'Excluir regras de classificação',
  },

  // Estrutura financeira — operações transversais
  {
    slug: 'financial_structure.import',
    module: 'cadastros',
    description: 'Importar estrutura financeira (XLSX/CSV/JSON)',
  },
  {
    slug: 'financial_structure.export',
    module: 'cadastros',
    description: 'Exportar estrutura financeira',
  },
  {
    slug: 'financial_structure.duplicate',
    module: 'cadastros',
    description: 'Duplicar estrutura entre empresas',
  },
  {
    slug: 'financial_structure.manage_versions',
    module: 'cadastros',
    description: 'Versionar e restaurar estruturas financeiras',
  },
  {
    slug: 'financial_structure.view_audit',
    module: 'cadastros',
    description: 'Consultar auditoria da estrutura financeira',
  },

  {
    slug: 'bank-accounts.view',
    module: 'cadastros',
    description: 'Visualizar contas bancárias',
  },
  {
    slug: 'bank-accounts.manage',
    module: 'cadastros',
    description: 'Incluir/editar contas bancárias',
  },
  {
    slug: 'payment-methods.view',
    module: 'cadastros',
    description: 'Visualizar formas de pagamento',
  },
  {
    slug: 'payment-methods.manage',
    module: 'cadastros',
    description: 'Incluir/editar formas de pagamento',
  },
  {
    slug: 'acquirers.view',
    module: 'cadastros',
    description: 'Visualizar cartões e adquirentes',
  },
  {
    slug: 'acquirers.manage',
    module: 'cadastros',
    description: 'Incluir/editar cartões e adquirentes',
  },

  // Financeiro
  {
    slug: 'financial.view',
    module: 'financeiro',
    description: 'Visualizar visão financeira',
  },
  {
    slug: 'financial.documents',
    module: 'financeiro',
    description: 'Enviar documentos',
  },
  {
    slug: 'financial.process',
    module: 'financeiro',
    description: 'Processar lançamentos',
  },
  {
    slug: 'financial.approve',
    module: 'financeiro',
    description: 'Autorizar pagamentos',
  },
  {
    slug: 'payables.view',
    module: 'financeiro',
    description: 'Visualizar contas a pagar',
  },
  {
    slug: 'receivables.view',
    module: 'financeiro',
    description: 'Visualizar contas a receber',
  },
  {
    slug: 'financial.scheduled',
    module: 'financeiro',
    description: 'Visualizar agendados',
  },
  {
    slug: 'financial.paid',
    module: 'financeiro',
    description: 'Visualizar contas pagas',
  },
  {
    slug: 'financial.movements',
    module: 'financeiro',
    description: 'Visualizar movimentações',
  },
  {
    slug: 'bank-import.view',
    module: 'financeiro',
    description: 'Importação bancária',
  },
  {
    slug: 'reconciliation.view',
    module: 'financeiro',
    description: 'Conciliação bancária',
  },
  {
    slug: 'transfers.view',
    module: 'financeiro',
    description: 'Transferências',
  },
  {
    slug: 'financial.closing',
    module: 'financeiro',
    description: 'Fechamento financeiro',
  },

  // Inteligência Financeira
  {
    slug: 'bi.view',
    module: 'inteligencia-financeira',
    description: 'Dashboard gerencial',
  },
  {
    slug: 'bi.cash-flow',
    module: 'inteligencia-financeira',
    description: 'Fluxo de caixa',
  },
  {
    slug: 'bi.dre',
    module: 'inteligencia-financeira',
    description: 'DRE gerencial',
  },
  {
    slug: 'bi.revenue-expenses',
    module: 'inteligencia-financeira',
    description: 'Receitas e despesas',
  },
  {
    slug: 'bi.categories',
    module: 'inteligencia-financeira',
    description: 'Categorias (BI)',
  },
  {
    slug: 'bi.cost-centers',
    module: 'inteligencia-financeira',
    description: 'Centros de custo (BI)',
  },
  {
    slug: 'bi.suppliers',
    module: 'inteligencia-financeira',
    description: 'Fornecedores (BI)',
  },
  {
    slug: 'bi.customers',
    module: 'inteligencia-financeira',
    description: 'Clientes (BI)',
  },
  {
    slug: 'bi.indicators',
    module: 'inteligencia-financeira',
    description: 'Indicadores',
  },
  {
    slug: 'bi.reports',
    module: 'inteligencia-financeira',
    description: 'Relatórios',
  },

  // Configurações
  {
    slug: 'settings.organization',
    module: 'configuracoes',
    description: 'Dados da organização',
  },
  { slug: 'settings.users', module: 'configuracoes', description: 'Usuários' },
  { slug: 'settings.roles', module: 'configuracoes', description: 'Perfis' },
  {
    slug: 'settings.permissions',
    module: 'configuracoes',
    description: 'Permissões',
  },
  {
    slug: 'settings.financial-params',
    module: 'configuracoes',
    description: 'Parâmetros financeiros',
  },
  {
    slug: 'settings.approval-rules',
    module: 'configuracoes',
    description: 'Regras de aprovação',
  },
  {
    slug: 'settings.reconciliation-rules',
    module: 'configuracoes',
    description: 'Regras de conciliação',
  },
  {
    slug: 'settings.integrations',
    module: 'configuracoes',
    description: 'Integrações',
  },
  {
    slug: 'settings.notifications',
    module: 'configuracoes',
    description: 'Notificações',
  },
  { slug: 'settings.audit', module: 'configuracoes', description: 'Auditoria' },
];

const ALL_SLUGS = PERMISSIONS.map((p) => p.slug);
const CADASTROS_SLUGS = PERMISSIONS.filter((p) => p.module === 'cadastros').map(
  (p) => p.slug,
);
const BI_SLUGS = PERMISSIONS.filter(
  (p) => p.module === 'inteligencia-financeira',
).map((p) => p.slug);

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
      'customer.view',
      'customer.create',
      'customer.update',
      'customer.manage_company_link',
      'customer.manage_classification',
      'customer.query_document',
      'customer.manage_documents',
      'customer.manage_billing_rules',
      'customer.manage_payment_promises',
      'customer.convert_prospect',
      'financial_structure.view',
      'financial_category.view',
      'financial_category.create',
      'financial_category.update',
      'cost_center.view',
      'cost_center.create',
      'cost_center.update',
      'account_plan.view',
      'result_center.view',
      'project.view',
      'business_unit.view',
      'financial_nature.view',
      'financial_tag.view',
      'financial_tag.create',
      'financial_tag.manage',
      'allocation_rule.view',
      'classification_rule.view',
      'classification_rule.test',
      'financial_structure.export',
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
    permissions: [
      'financial.view',
      'financial.approve',
      'payables.view',
      'receivables.view',
      'bi.view',
    ],
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
      update: {
        module: permission.module,
        description: permission.description,
      },
      create: permission,
    });
  }

  console.log('Aplicando seed de perfis...');
  for (const role of ROLES) {
    const created = await prisma.role.upsert({
      where: { slug: role.slug },
      update: {
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
      },
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
      data: permissions.map((permission) => ({
        roleId: created.id,
        permissionId: permission.id,
      })),
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
    {
      compeCode: '001',
      ispb: '00000000',
      legalName: 'Banco do Brasil S.A.',
      shortName: 'Banco do Brasil',
    },
    {
      compeCode: '033',
      ispb: '90400888',
      legalName: 'Banco Santander (Brasil) S.A.',
      shortName: 'Santander',
    },
    {
      compeCode: '104',
      ispb: '00360305',
      legalName: 'Caixa Econômica Federal',
      shortName: 'Caixa',
    },
    {
      compeCode: '237',
      ispb: '60746948',
      legalName: 'Banco Bradesco S.A.',
      shortName: 'Bradesco',
    },
    {
      compeCode: '341',
      ispb: '60701190',
      legalName: 'Itaú Unibanco S.A.',
      shortName: 'Itaú',
    },
    {
      compeCode: '260',
      ispb: '18236120',
      legalName: 'Nu Pagamentos S.A.',
      shortName: 'Nubank',
    },
    {
      compeCode: '748',
      ispb: '01181521',
      legalName: 'Banco Cooperativo Sicredi S.A.',
      shortName: 'Sicredi',
    },
    {
      compeCode: '077',
      ispb: '16501555',
      legalName: 'Banco Inter S.A.',
      shortName: 'Inter',
    },
  ];
  for (const institution of FINANCIAL_INSTITUTIONS) {
    await prisma.financialInstitution.upsert({
      where: { compeCode: institution.compeCode },
      update: {
        legalName: institution.legalName,
        shortName: institution.shortName,
        ispb: institution.ispb,
      },
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

  const carnesCategory = await prisma.financialCategory.upsert({
    where: { id: '00000000-0000-0000-0000-000000000101' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000101',
      companyId: company.id,
      name: 'Carnes e proteínas',
    },
  });
  const churrasqueiraCostCenter = await prisma.costCenter.upsert({
    where: { id: '00000000-0000-0000-0000-000000000201' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000201',
      companyId: company.id,
      name: 'Churrasqueira',
    },
  });

  await prisma.supplierCompanyLink.upsert({
    where: {
      supplierId_companyId: {
        supplierId: demoSupplier.id,
        companyId: company.id,
      },
    },
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

  // ── Estrutura financeira de demonstração ────────────────────────────────────
  // Naturezas financeiras padrão (catálogo da organização).
  const NATURES: {
    id: string;
    name: string;
    kind: FinancialNatureKind;
    affectsResult: boolean;
    affectsCashFlow: boolean;
  }[] = [
    {
      id: '00000000-0000-0000-0000-000000000301',
      name: 'Receita',
      kind: 'REVENUE',
      affectsResult: true,
      affectsCashFlow: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000302',
      name: 'Despesa',
      kind: 'EXPENSE',
      affectsResult: true,
      affectsCashFlow: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000303',
      name: 'Custo',
      kind: 'COST',
      affectsResult: true,
      affectsCashFlow: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000304',
      name: 'Investimento',
      kind: 'INVESTMENT',
      affectsResult: false,
      affectsCashFlow: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000305',
      name: 'Tributo',
      kind: 'TAX',
      affectsResult: true,
      affectsCashFlow: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000306',
      name: 'Transferência',
      kind: 'TRANSFER',
      affectsResult: false,
      affectsCashFlow: false,
    },
    {
      id: '00000000-0000-0000-0000-000000000307',
      name: 'Reembolso',
      kind: 'REIMBURSEMENT',
      affectsResult: false,
      affectsCashFlow: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000308',
      name: 'Empréstimo',
      kind: 'LOAN',
      affectsResult: false,
      affectsCashFlow: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000309',
      name: 'Aplicação',
      kind: 'FINANCIAL_APPLICATION',
      affectsResult: false,
      affectsCashFlow: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000310',
      name: 'Retirada de sócios',
      kind: 'PARTNER_WITHDRAWAL',
      affectsResult: false,
      affectsCashFlow: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000311',
      name: 'Aporte',
      kind: 'CAPITAL_CONTRIBUTION',
      affectsResult: false,
      affectsCashFlow: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000312',
      name: 'Outros',
      kind: 'OTHER',
      affectsResult: true,
      affectsCashFlow: true,
    },
  ];

  for (const [index, nature] of NATURES.entries()) {
    await prisma.financialNatureCatalog.upsert({
      where: { id: nature.id },
      update: {},
      create: {
        id: nature.id,
        organizationId: organization.id,
        name: nature.name,
        kind: nature.kind,
        affectsResult: nature.affectsResult,
        affectsCashFlow: nature.affectsCashFlow,
        sortOrder: index,
        isSystem: true,
      },
    });
  }

  // Plano de contas raiz (1 Ativo, 2 Passivo, 3 Receitas, 4 Custos, 5 Despesas).
  const ACCOUNT_ROOTS: {
    id: string;
    code: string;
    name: string;
    type: AccountPlanType;
  }[] = [
    {
      id: '00000000-0000-0000-0000-000000000401',
      code: '1',
      name: 'Ativo',
      type: 'ASSET',
    },
    {
      id: '00000000-0000-0000-0000-000000000402',
      code: '2',
      name: 'Passivo',
      type: 'LIABILITY',
    },
    {
      id: '00000000-0000-0000-0000-000000000403',
      code: '3',
      name: 'Receitas',
      type: 'REVENUE',
    },
    {
      id: '00000000-0000-0000-0000-000000000404',
      code: '4',
      name: 'Custos',
      type: 'COST',
    },
    {
      id: '00000000-0000-0000-0000-000000000405',
      code: '5',
      name: 'Despesas',
      type: 'EXPENSE',
    },
  ];

  for (const [index, account] of ACCOUNT_ROOTS.entries()) {
    await prisma.financialAccountPlan.upsert({
      where: { id: account.id },
      update: {},
      create: {
        id: account.id,
        organizationId: organization.id,
        code: account.code,
        name: account.name,
        accountType: account.type,
        accountKind: 'SYNTHETIC',
        acceptsEntries: false,
        level: 0,
        path: account.name,
        sortOrder: index,
        isSystem: true,
      },
    });
  }

  // Contas analíticas de exemplo sob "1 Ativo" e "4 Custos".
  const ACCOUNT_CHILDREN: {
    id: string;
    parentId: string;
    code: string;
    name: string;
    type: AccountPlanType;
  }[] = [
    {
      id: '00000000-0000-0000-0000-000000000411',
      parentId: '00000000-0000-0000-0000-000000000401',
      code: '1.1',
      name: 'Ativo Circulante',
      type: 'ASSET',
    },
    {
      id: '00000000-0000-0000-0000-000000000412',
      parentId: '00000000-0000-0000-0000-000000000404',
      code: '4.1',
      name: 'Custo de Mercadoria Vendida',
      type: 'COST',
    },
  ];

  for (const child of ACCOUNT_CHILDREN) {
    await prisma.financialAccountPlan.upsert({
      where: { id: child.id },
      update: {},
      create: {
        id: child.id,
        organizationId: organization.id,
        parentAccountId: child.parentId,
        code: child.code,
        name: child.name,
        accountType: child.type,
        accountKind: 'ANALYTICAL',
        acceptsEntries: true,
        level: 1,
        path: `${ACCOUNT_ROOTS.find((r) => r.id === child.parentId)?.name} > ${child.name}`,
      },
    });
  }

  // Centro de resultado, unidade de negócio e tags de demonstração.
  await prisma.resultCenter.upsert({
    where: { id: '00000000-0000-0000-0000-000000000501' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000501',
      companyId: company.id,
      code: 'RES-REST',
      name: 'Receitas Restaurante',
      level: 0,
      path: 'Receitas Restaurante',
    },
  });

  await prisma.businessUnit.upsert({
    where: { id: '00000000-0000-0000-0000-000000000601' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000601',
      organizationId: organization.id,
      companyId: company.id,
      code: 'UN-REST',
      name: 'Restaurante',
      level: 0,
      path: 'Restaurante',
    },
  });

  for (const tag of [
    { id: '00000000-0000-0000-0000-000000000701', name: 'Recorrente' },
    { id: '00000000-0000-0000-0000-000000000702', name: 'Urgente' },
    { id: '00000000-0000-0000-0000-000000000703', name: 'Fiscal' },
  ]) {
    await prisma.financialTag.upsert({
      where: { id: tag.id },
      update: {},
      create: {
        id: tag.id,
        organizationId: organization.id,
        companyId: company.id,
        name: tag.name,
        slug: tag.name.toLowerCase(),
      },
    });
  }

  // Vincula a categoria de demonstração ao plano de contas/natureza correspondentes.
  await prisma.financialCategory.update({
    where: { id: carnesCategory.id },
    data: {
      code: 'CAT-CARNES',
      accountPlanId: '00000000-0000-0000-0000-000000000412',
      financialNatureId: '00000000-0000-0000-0000-000000000303',
      defaultCostCenterId: churrasqueiraCostCenter.id,
      level: 0,
      path: 'Carnes e proteínas',
    },
  });

  await prisma.costCenter.update({
    where: { id: churrasqueiraCostCenter.id },
    data: {
      code: 'CC-CHURRAS',
      normalizedCode: 'CC-CHURRAS',
      level: 0,
      path: 'Churrasqueira',
    },
  });

  await seedDemoStructure(organization.id, company.id);

  console.log('Seed concluído com sucesso.');
  console.log(
    'Para vincular seu usuário Supabase como Administrador da organização, veja as instruções no README (seção "Primeiro acesso").',
  );
}

/**
 * Estrutura financeira de demonstração de um restaurante (seção 77). Todos os dados são
 * fictícios: nenhum nome, documento ou valor real é usado. A função é idempotente —
 * roda com `upsert` em ids fixos, então pode ser reaplicada à vontade.
 */
async function seedDemoStructure(organizationId: string, companyId: string) {
  // Versão ativa do plano de contas: sem ela, o diagnóstico acusa "sem versão ativa".
  await prisma.financialAccountPlanVersion.upsert({
    where: { id: '00000000-0000-0000-0000-000000000801' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000801',
      organizationId,
      name: 'Plano gerencial vigente',
      description:
        'Versão inicial do plano gerencial do restaurante, criada pelo seed de demonstração.',
      planType: 'MANAGEMENT',
      versionNumber: 1,
      status: 'ACTIVE',
      activatedAt: new Date(),
      reason: 'Implantação',
    },
  });

  // Subárvore de despesas com três níveis, para exercitar a árvore e a tabela.
  const EXPENSE_TREE: {
    id: string;
    parentId: string;
    code: string;
    name: string;
    level: number;
    synthetic?: boolean;
  }[] = [
    {
      id: '00000000-0000-0000-0000-000000000421',
      parentId: '00000000-0000-0000-0000-000000000405',
      code: '5.01',
      name: 'Pessoal',
      level: 1,
      synthetic: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000422',
      parentId: '00000000-0000-0000-0000-000000000421',
      code: '5.01.001',
      name: 'Salários e encargos',
      level: 2,
    },
    {
      id: '00000000-0000-0000-0000-000000000423',
      parentId: '00000000-0000-0000-0000-000000000421',
      code: '5.01.002',
      name: 'Vale-transporte',
      level: 2,
    },
    {
      id: '00000000-0000-0000-0000-000000000424',
      parentId: '00000000-0000-0000-0000-000000000405',
      code: '5.02',
      name: 'Ocupação',
      level: 1,
      synthetic: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000425',
      parentId: '00000000-0000-0000-0000-000000000424',
      code: '5.02.001',
      name: 'Aluguel',
      level: 2,
    },
    {
      id: '00000000-0000-0000-0000-000000000426',
      parentId: '00000000-0000-0000-0000-000000000424',
      code: '5.02.002',
      name: 'Energia elétrica',
      level: 2,
    },
    {
      id: '00000000-0000-0000-0000-000000000427',
      parentId: '00000000-0000-0000-0000-000000000424',
      code: '5.02.003',
      name: 'Água e esgoto',
      level: 2,
    },
  ];

  for (const [index, account] of EXPENSE_TREE.entries()) {
    await prisma.financialAccountPlan.upsert({
      where: { id: account.id },
      update: {},
      create: {
        id: account.id,
        organizationId,
        parentAccountId: account.parentId,
        versionId: '00000000-0000-0000-0000-000000000801',
        code: account.code,
        normalizedCode: account.code,
        name: account.name,
        accountType: 'EXPENSE',
        accountKind: account.synthetic ? 'SYNTHETIC' : 'ANALYTICAL',
        acceptsEntries: !account.synthetic,
        level: account.level,
        path: `Despesas > ${account.name}`,
        sortOrder: index,
      },
    });
  }

  // Centros de custo do restaurante, ao lado da churrasqueira que já existia.
  const COST_CENTERS = [
    {
      id: '00000000-0000-0000-0000-000000000811',
      code: 'CC-SALAO',
      name: 'Salão',
    },
    {
      id: '00000000-0000-0000-0000-000000000812',
      code: 'CC-COZINHA',
      name: 'Cozinha',
    },
    {
      id: '00000000-0000-0000-0000-000000000813',
      code: 'CC-ADM',
      name: 'Administrativo',
    },
  ];

  for (const center of COST_CENTERS) {
    await prisma.costCenter.upsert({
      where: { id: center.id },
      update: {},
      create: {
        id: center.id,
        companyId,
        code: center.code,
        normalizedCode: center.code,
        name: center.name,
        level: 0,
        path: center.name,
      },
    });
  }

  // Categorias de despesa ligadas às contas analíticas correspondentes.
  const CATEGORIES = [
    {
      id: '00000000-0000-0000-0000-000000000821',
      code: 'CAT-ENERGIA',
      name: 'Energia elétrica',
      accountPlanId: '00000000-0000-0000-0000-000000000426',
    },
    {
      id: '00000000-0000-0000-0000-000000000822',
      code: 'CAT-ALUGUEL',
      name: 'Aluguel',
      accountPlanId: '00000000-0000-0000-0000-000000000425',
    },
    {
      id: '00000000-0000-0000-0000-000000000823',
      code: 'CAT-BEBIDAS',
      name: 'Bebidas',
      accountPlanId: '00000000-0000-0000-0000-000000000412',
    },
  ];

  for (const category of CATEGORIES) {
    await prisma.financialCategory.upsert({
      where: { id: category.id },
      update: {},
      create: {
        id: category.id,
        companyId,
        code: category.code,
        normalizedCode: category.code,
        name: category.name,
        categoryType: 'EXPENSE',
        accountPlanId: category.accountPlanId,
        level: 0,
        path: category.name,
      },
    });
  }

  // Rateio de energia entre salão e cozinha: fecha exatamente 100%.
  await prisma.allocationRule.upsert({
    where: { id: '00000000-0000-0000-0000-000000000831' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000831',
      companyId,
      name: 'Rateio de energia elétrica',
      description:
        'Divide a fatura de energia entre salão e cozinha conforme a área ocupada.',
      criterion: 'PERCENTAGE',
      allocationType: 'PERCENTAGE',
      categoryId: '00000000-0000-0000-0000-000000000821',
      items: {
        create: [
          {
            id: '00000000-0000-0000-0000-000000000832',
            targetType: 'COST_CENTER',
            costCenterId: '00000000-0000-0000-0000-000000000811',
            percentage: 60,
            sortOrder: 0,
          },
          {
            id: '00000000-0000-0000-0000-000000000833',
            targetType: 'COST_CENTER',
            costCenterId: '00000000-0000-0000-0000-000000000812',
            percentage: 40,
            sortOrder: 1,
          },
        ],
      },
    },
  });

  /*
   * Regra de classificação com condição e ação próprias. Nasce com `autoApply: false`:
   * nesta etapa nada é classificado automaticamente — a regra existe para ser testada.
   */
  await prisma.classificationRule.upsert({
    where: { id: '00000000-0000-0000-0000-000000000841' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000841',
      companyId,
      name: 'Fatura de energia → Energia elétrica',
      description:
        'Sugere a categoria Energia elétrica quando a descrição menciona a concessionária.',
      matchField: 'DESCRIPTION',
      matchType: 'CONTAINS',
      matchValue: 'COELBA',
      priority: 100,
      autoApply: false,
      categoryId: '00000000-0000-0000-0000-000000000821',
      conditions: {
        create: [
          {
            id: '00000000-0000-0000-0000-000000000842',
            field: 'DESCRIPTION',
            operator: 'CONTAINS',
            value: 'COELBA',
            normalizedValue: 'COELBA',
            sortOrder: 0,
          },
        ],
      },
      actions: {
        create: [
          {
            id: '00000000-0000-0000-0000-000000000843',
            categoryId: '00000000-0000-0000-0000-000000000821',
            allocationRuleId: '00000000-0000-0000-0000-000000000831',
            requiresApproval: true,
          },
        ],
      },
    },
  });

  console.log(
    'Estrutura de demonstração criada: versão do plano, subárvore de despesas, centros de custo, categorias, rateio de energia e regra de classificação.',
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
