import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  type AccountPlanType,
  type FinancialNatureKind,
  type IntakeExtractionMethod,
  type IntakeIssueSeverity,
  type IntakeIssueType,
  type IntakeProcessingStatus,
  type IntakeReviewStatus,
} from '@prisma/client';

// Gerador de boleto válido por construção. É a mesma função usada nos testes: os dígitos
// verificadores são calculados, então o boleto de demonstração passa na validação real.
import { buildValidBoleto } from '../src/modules/document-intake/utils/boleto-fixture.util';

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

  // Cadastros — Tesouraria
  {
    slug: 'treasury.view',
    module: 'cadastros',
    description: 'Visualizar a tesouraria',
  },
  {
    slug: 'treasury.manage',
    module: 'cadastros',
    description: 'Gerenciar a tesouraria',
  },
  {
    slug: 'treasury.view_dashboard',
    module: 'cadastros',
    description: 'Visualizar a visão geral da tesouraria',
  },
  {
    slug: 'treasury.manage_settings',
    module: 'cadastros',
    description: 'Configurar os parâmetros de tesouraria',
  },
  {
    slug: 'treasury.view_sensitive_data',
    module: 'cadastros',
    description: 'Visualizar dados sensíveis sem mascaramento',
  },
  {
    slug: 'treasury.allow_third_party_account',
    module: 'cadastros',
    description: 'Cadastrar contas de terceiro',
  },
  {
    slug: 'treasury.approve_bank_data_change',
    module: 'cadastros',
    description: 'Aprovar alterações de dados bancários',
  },
  {
    slug: 'treasury.export',
    module: 'cadastros',
    description: 'Exportar dados da tesouraria',
  },
  {
    slug: 'treasury.view_audit',
    module: 'cadastros',
    description: 'Consultar a auditoria da tesouraria',
  },
  {
    slug: 'financial_account.view',
    module: 'cadastros',
    description: 'Visualizar contas financeiras',
  },
  {
    slug: 'financial_account.create',
    module: 'cadastros',
    description: 'Incluir contas financeiras',
  },
  {
    slug: 'financial_account.update',
    module: 'cadastros',
    description: 'Editar contas financeiras',
  },
  {
    slug: 'financial_account.activate',
    module: 'cadastros',
    description: 'Ativar contas financeiras',
  },
  {
    slug: 'financial_account.block',
    module: 'cadastros',
    description: 'Bloquear contas financeiras',
  },
  {
    slug: 'financial_account.unblock',
    module: 'cadastros',
    description: 'Desbloquear contas financeiras',
  },
  {
    slug: 'financial_account.suspend',
    module: 'cadastros',
    description: 'Suspender contas financeiras',
  },
  {
    slug: 'financial_account.deactivate',
    module: 'cadastros',
    description: 'Inativar contas financeiras',
  },
  {
    slug: 'financial_account.close',
    module: 'cadastros',
    description: 'Encerrar contas financeiras',
  },
  {
    slug: 'financial_account.delete',
    module: 'cadastros',
    description: 'Excluir contas financeiras em rascunho',
  },
  {
    slug: 'financial_account.view_balance',
    module: 'cadastros',
    description: 'Visualizar saldos e limites da conta',
  },
  {
    slug: 'financial_account.view_bank_data',
    module: 'cadastros',
    description: 'Visualizar dados bancários completos',
  },
  {
    slug: 'financial_account.manage_initial_balance',
    module: 'cadastros',
    description: 'Registrar e alterar o saldo inicial',
  },
  {
    slug: 'financial_account.manage_limits',
    module: 'cadastros',
    description: 'Gerenciar limites bancários',
  },
  {
    slug: 'financial_account.manage_users',
    module: 'cadastros',
    description: 'Gerenciar usuários e alçadas da conta',
  },
  {
    slug: 'financial_account.manage_integration',
    module: 'cadastros',
    description: 'Configurar integrações bancárias',
  },
  {
    slug: 'financial_account.manage_pix',
    module: 'cadastros',
    description: 'Gerenciar chaves PIX da empresa',
  },
  {
    slug: 'financial_account.view_audit',
    module: 'cadastros',
    description: 'Consultar a auditoria da conta',
  },
  {
    slug: 'card.view',
    module: 'cadastros',
    description: 'Visualizar cartões corporativos',
  },
  {
    slug: 'card.create',
    module: 'cadastros',
    description: 'Incluir cartões corporativos',
  },
  {
    slug: 'card.update',
    module: 'cadastros',
    description: 'Editar cartões corporativos',
  },
  {
    slug: 'card.block',
    module: 'cadastros',
    description: 'Bloquear cartões',
  },
  {
    slug: 'card.unblock',
    module: 'cadastros',
    description: 'Desbloquear cartões',
  },
  {
    slug: 'card.deactivate',
    module: 'cadastros',
    description: 'Inativar cartões',
  },
  {
    slug: 'card.delete',
    module: 'cadastros',
    description: 'Excluir cartões em rascunho',
  },
  {
    slug: 'card.manage_limits',
    module: 'cadastros',
    description: 'Gerenciar limites de cartões',
  },
  {
    slug: 'card.manage_users',
    module: 'cadastros',
    description: 'Gerenciar portadores de cartões',
  },
  {
    slug: 'card.view_sensitive_data',
    module: 'cadastros',
    description: 'Visualizar dados sensíveis dos cartões',
  },
  {
    slug: 'payment_method.view',
    module: 'cadastros',
    description: 'Visualizar formas de pagamento',
  },
  {
    slug: 'payment_method.create',
    module: 'cadastros',
    description: 'Incluir formas de pagamento',
  },
  {
    slug: 'payment_method.update',
    module: 'cadastros',
    description: 'Editar formas de pagamento',
  },
  {
    slug: 'payment_method.activate',
    module: 'cadastros',
    description: 'Ativar formas de pagamento',
  },
  {
    slug: 'payment_method.deactivate',
    module: 'cadastros',
    description: 'Inativar formas de pagamento',
  },
  {
    slug: 'payment_method.delete',
    module: 'cadastros',
    description: 'Excluir formas de pagamento',
  },
  {
    slug: 'receipt_method.view',
    module: 'cadastros',
    description: 'Visualizar formas de recebimento',
  },
  {
    slug: 'receipt_method.create',
    module: 'cadastros',
    description: 'Incluir formas de recebimento',
  },
  {
    slug: 'receipt_method.update',
    module: 'cadastros',
    description: 'Editar formas de recebimento',
  },
  {
    slug: 'receipt_method.activate',
    module: 'cadastros',
    description: 'Ativar formas de recebimento',
  },
  {
    slug: 'receipt_method.deactivate',
    module: 'cadastros',
    description: 'Inativar formas de recebimento',
  },
  {
    slug: 'receipt_method.delete',
    module: 'cadastros',
    description: 'Excluir formas de recebimento',
  },

  // Financeiro — Entrada de documentos
  {
    slug: 'document_intake.view',
    module: 'financeiro',
    description: 'Visualizar a entrada de documentos',
  },
  {
    slug: 'document_intake.upload',
    module: 'financeiro',
    description: 'Enviar documentos',
  },
  {
    slug: 'document_intake.batch_upload',
    module: 'financeiro',
    description: 'Enviar documentos em lote',
  },
  {
    slug: 'document_intake.capture',
    module: 'financeiro',
    description: 'Capturar documentos pela câmera',
  },
  {
    slug: 'document_intake.manual_entry',
    module: 'financeiro',
    description: 'Digitar documentos manualmente',
  },
  {
    slug: 'document_intake.update',
    module: 'financeiro',
    description: 'Editar os dados do documento recebido',
  },
  {
    slug: 'document_intake.review',
    module: 'financeiro',
    description: 'Revisar documentos recebidos',
  },
  {
    slug: 'document_intake.classify',
    module: 'financeiro',
    description: 'Classificar documentos recebidos',
  },
  {
    slug: 'document_intake.forward',
    module: 'financeiro',
    description: 'Encaminhar documentos para processamento',
  },
  {
    slug: 'document_intake.reject',
    module: 'financeiro',
    description: 'Rejeitar documentos recebidos',
  },
  {
    slug: 'document_intake.reopen',
    module: 'financeiro',
    description: 'Reabrir documentos rejeitados ou arquivados',
  },
  {
    slug: 'document_intake.archive',
    module: 'financeiro',
    description: 'Arquivar documentos recebidos',
  },
  {
    slug: 'document_intake.assign',
    module: 'financeiro',
    description: 'Atribuir documentos a responsáveis',
  },
  {
    slug: 'document_intake.reprocess',
    module: 'financeiro',
    description: 'Reprocessar a leitura de documentos',
  },
  {
    slug: 'document_intake.change_company',
    module: 'financeiro',
    description: 'Alterar a empresa de destino do documento',
  },
  {
    slug: 'document_intake.manage_duplicates',
    module: 'financeiro',
    description: 'Tratar duplicidades de documentos',
  },
  {
    slug: 'document_intake.override_duplicate',
    module: 'financeiro',
    description: 'Liberar documento com alta semelhança, mediante justificativa',
  },
  {
    slug: 'document_intake.download',
    module: 'financeiro',
    description: 'Baixar o arquivo original do documento',
  },
  {
    slug: 'document_intake.view_sensitive_data',
    module: 'financeiro',
    description:
      'Visualizar linha digitável, código de barras e chave PIX sem mascaramento',
  },
  {
    slug: 'document_intake.delete',
    module: 'financeiro',
    description: 'Excluir documentos ainda não encaminhados',
  },
  {
    slug: 'document_intake.manage_settings',
    module: 'financeiro',
    description: 'Configurar os parâmetros da entrada de documentos',
  },

  // Financeiro — Processamento de documentos
  {
    slug: 'document_processing.view',
    module: 'financeiro',
    description: 'Visualizar o processamento e os lançamentos financeiros',
  },
  {
    slug: 'document_processing.process',
    module: 'financeiro',
    description: 'Processar documentos encaminhados e gerar lançamentos',
  },
  {
    slug: 'document_processing.update',
    module: 'financeiro',
    description: 'Editar lançamentos que ainda não estão em aberto',
  },
  {
    slug: 'document_processing.approve',
    module: 'financeiro',
    description:
      'Conferir lançamentos acima do limite (conferência dos dados, não autorização de pagamento)',
  },
  {
    slug: 'document_processing.open',
    module: 'financeiro',
    description: 'Abrir o título, tornando-o uma obrigação financeira',
  },
  {
    slug: 'document_processing.cancel',
    module: 'financeiro',
    description: 'Cancelar lançamentos com motivo',
  },
  {
    slug: 'document_processing.manage_withholdings',
    module: 'financeiro',
    description: 'Confirmar, descartar e incluir retenções',
  },
  {
    slug: 'document_processing.manage_settings',
    module: 'financeiro',
    description: 'Configurar os parâmetros do processamento',
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

const DOCUMENT_INTAKE_SLUGS = PERMISSIONS.filter((p) =>
  p.slug.startsWith('document_intake.'),
).map((p) => p.slug);

/**
 * Entrada de documentos liberada para o operador financeiro.
 *
 * Fica de fora o que muda o escopo ou afrouxa uma trava: trocar a empresa do documento,
 * liberar uma duplicidade de alta semelhança, ver linha digitável e chave PIX sem
 * mascaramento, excluir e configurar os parâmetros da empresa.
 */
const DOCUMENT_INTAKE_OPERATOR_SLUGS = DOCUMENT_INTAKE_SLUGS.filter(
  (slug) =>
    ![
      'document_intake.change_company',
      'document_intake.override_duplicate',
      'document_intake.view_sensitive_data',
      'document_intake.delete',
      'document_intake.manage_settings',
      'document_intake.reopen',
    ].includes(slug),
);

const DOCUMENT_PROCESSING_SLUGS = PERMISSIONS.filter((p) =>
  p.slug.startsWith('document_processing.'),
).map((p) => p.slug);

/**
 * Processamento liberado para o operador financeiro.
 *
 * Fica de fora o que decide sozinho: conferir um lançamento acima do limite, cancelar um
 * título já criado e configurar os parâmetros da empresa.
 */
const DOCUMENT_PROCESSING_OPERATOR_SLUGS = DOCUMENT_PROCESSING_SLUGS.filter(
  (slug) =>
    ![
      'document_processing.approve',
      'document_processing.cancel',
      'document_processing.manage_settings',
    ].includes(slug),
);

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
      ...DOCUMENT_INTAKE_SLUGS,
      ...DOCUMENT_PROCESSING_SLUGS,
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
      'treasury.view',
      'treasury.view_dashboard',
      'financial_account.view',
      'financial_account.view_balance',
      'card.view',
      'payment_method.view',
      'receipt_method.view',
      ...DOCUMENT_INTAKE_OPERATOR_SLUGS,
      ...DOCUMENT_PROCESSING_OPERATOR_SLUGS,
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
      'document_intake.view',
      'document_processing.view',
      'document_processing.approve',
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
    permissions: [
      'financial.view',
      'document_intake.view',
      'document_processing.view',
      ...BI_SLUGS,
    ],
  },
  {
    slug: 'accountant',
    name: 'Contador',
    description: 'Consulta dados contábeis, relatórios e exportações.',
    isSystem: true,
    permissions: [
      'financial.view',
      'financial.paid',
      'document_intake.view',
      'document_intake.download',
      'document_processing.view',
      ...BI_SLUGS,
    ],
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
  await seedDemoTreasury(organization.id, company.id);
  await seedDemoDocumentIntake(
    organization.id,
    company.id,
    demoSupplier.id,
    carnesCategory.id,
    churrasqueiraCostCenter.id,
  );
  await seedDemoDocumentProcessing(
    organization.id,
    company.id,
    carnesCategory.id,
    churrasqueiraCostCenter.id,
  );

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


/**
 * Tesouraria de demonstração do restaurante (seção 78). Dados fictícios: os números de
 * agência, conta e cartão não correspondem a nenhuma conta real. Idempotente.
 */
async function seedDemoTreasury(organizationId: string, companyId: string) {
  // Reaproveita o catálogo de instituições financeiras já existente.
  const bancoDoBrasil = await prisma.financialInstitution.findFirst({
    where: { compeCode: '001' },
    select: { id: true },
  });

  const CONTA_BB = '00000000-0000-0000-0000-000000000901';
  const CAIXA = '00000000-0000-0000-0000-000000000902';
  const CARTEIRA_PIX = '00000000-0000-0000-0000-000000000903';

  await prisma.financialAccount.upsert({
    where: { id: CONTA_BB },
    update: {},
    create: {
      id: CONTA_BB,
      organizationId,
      companyId,
      financialInstitutionId: bancoDoBrasil?.id,
      internalCode: 'CC-BB-001',
      name: 'Conta Operacional',
      displayName: 'Banco do Brasil — Conta Operacional',
      accountType: 'CHECKING_ACCOUNT',
      purpose: 'MULTIPLE',
      branchNumber: '1234',
      branchDigit: '5',
      accountNumber: '12345',
      accountDigit: '6',
      normalizedAccountIdentifier: `${bancoDoBrasil?.id ?? 'sem-instituicao'}:12345:123456`,
      holderName: 'Tchê Grill Restaurante Ltda.',
      holderDocument: '11.222.333/0001-81',
      normalizedHolderDocument: '11222333000181',
      isPrimary: true,
      isDefaultForPayments: true,
      isDefaultForReceipts: true,
      reconciliationMode: 'SEMI_AUTOMATIC',
      status: 'ACTIVE',
      accountPlanId: '00000000-0000-0000-0000-000000000411',
    },
  });

  await prisma.financialAccount.upsert({
    where: { id: CAIXA },
    update: {},
    create: {
      id: CAIXA,
      organizationId,
      companyId,
      internalCode: 'CX-001',
      name: 'Caixa do Restaurante',
      displayName: 'Caixa do Restaurante',
      accountType: 'CASH',
      purpose: 'OPERATING_CASH',
      physicalLocation: 'Frente de caixa do salão',
      requiresDailyClosing: true,
      checkFrequencyDays: 1,
      reconciliationMode: 'MANUAL',
      status: 'ACTIVE',
      accountPlanId: '00000000-0000-0000-0000-000000000411',
    },
  });

  await prisma.financialAccount.upsert({
    where: { id: CARTEIRA_PIX },
    update: {},
    create: {
      id: CARTEIRA_PIX,
      organizationId,
      companyId,
      internalCode: 'PIX-001',
      name: 'Carteira PIX',
      displayName: 'Carteira PIX',
      accountType: 'DIGITAL_WALLET',
      purpose: 'RECEIPTS',
      reconciliationMode: 'MANUAL',
      status: 'ACTIVE',
      accountPlanId: '00000000-0000-0000-0000-000000000411',
    },
  });

  // Saldos de implantação.
  for (const [id, accountId, amount] of [
    ['00000000-0000-0000-0000-000000000911', CONTA_BB, 25000],
    ['00000000-0000-0000-0000-000000000912', CAIXA, 1500],
  ] as const) {
    await prisma.financialAccountOpeningBalance.upsert({
      where: { id },
      update: {},
      create: {
        id,
        financialAccountId: accountId,
        balanceDate: new Date('2026-01-01'),
        balanceAmount: amount,
        balanceType: 'CREDIT',
        source: 'Extrato de implantação',
        status: 'APPROVED',
        approvedAt: new Date('2026-01-01'),
      },
    });
  }

  await prisma.companyPixKey.upsert({
    where: { id: '00000000-0000-0000-0000-000000000921' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000921',
      organizationId,
      companyId,
      financialAccountId: CONTA_BB,
      financialInstitutionId: bancoDoBrasil?.id,
      pixType: 'CNPJ',
      pixKey: '11.222.333/0001-81',
      normalizedKey: '11222333000181',
      holderName: 'Tchê Grill Restaurante Ltda.',
      holderDocument: '11.222.333/0001-81',
      normalizedHolderDocument: '11222333000181',
      purpose: 'GENERAL',
      isPrimary: true,
      isForBilling: true,
      isForCustomers: true,
    },
  });

  await prisma.corporateCard.upsert({
    where: { id: '00000000-0000-0000-0000-000000000931' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000931',
      organizationId,
      companyId,
      financialAccountId: CONTA_BB,
      financialInstitutionId: bancoDoBrasil?.id,
      name: 'Cartão Corporativo',
      displayName: 'Cartão Corporativo — final 4587',
      cardType: 'CREDIT',
      brand: 'Visa',
      // Apenas os quatro últimos dígitos: é tudo o que o sistema guarda.
      lastFourDigits: '4587',
      holderName: 'Tchê Grill Restaurante Ltda.',
      isPhysical: true,
      totalLimit: 20000,
      transactionLimit: 5000,
      closingDay: 25,
      dueDay: 5,
      allowsInstallments: true,
      maximumInstallments: 12,
      expirationDate: new Date('2029-12-31'),
      status: 'ACTIVE',
    },
  });

  // Formas de pagamento e recebimento padrão, compartilhadas pela organização.
  const PAYMENT_METHODS = [
    { id: '00000000-0000-0000-0000-000000000941', code: 'PIX', name: 'PIX', type: 'PIX', beneficiary: true },
    { id: '00000000-0000-0000-0000-000000000942', code: 'BOLETO', name: 'Boleto', type: 'BOLETO', digitable: true },
    { id: '00000000-0000-0000-0000-000000000943', code: 'TRANSFERENCIA', name: 'Transferência bancária', type: 'BANK_TRANSFER', bankData: true, beneficiary: true },
    { id: '00000000-0000-0000-0000-000000000944', code: 'CARTAO-CORP', name: 'Cartão corporativo', type: 'CREDIT_CARD', installments: true },
    { id: '00000000-0000-0000-0000-000000000945', code: 'DINHEIRO', name: 'Dinheiro', type: 'CASH' },
  ] as const;

  for (const [index, method] of PAYMENT_METHODS.entries()) {
    await prisma.paymentMethodCatalog.upsert({
      where: { id: method.id },
      update: {},
      create: {
        id: method.id,
        organizationId,
        code: method.code,
        name: method.name,
        methodType: method.type,
        requiresBeneficiary: 'beneficiary' in method ? method.beneficiary : false,
        requiresBankData: 'bankData' in method ? method.bankData : false,
        requiresDigitableLine: 'digitable' in method ? method.digitable : false,
        allowsInstallments: 'installments' in method ? method.installments : false,
        sortOrder: index,
        isSystem: true,
      },
    });
  }

  const RECEIPT_METHODS = [
    { id: '00000000-0000-0000-0000-000000000951', code: 'PIX', name: 'PIX', type: 'PIX', days: 0, fee: null },
    { id: '00000000-0000-0000-0000-000000000952', code: 'CARTAO-CREDITO', name: 'Cartão de crédito', type: 'CREDIT_CARD', days: 30, fee: 3.49 },
    { id: '00000000-0000-0000-0000-000000000953', code: 'CARTAO-DEBITO', name: 'Cartão de débito', type: 'DEBIT_CARD', days: 1, fee: 1.99 },
    { id: '00000000-0000-0000-0000-000000000954', code: 'DINHEIRO', name: 'Dinheiro', type: 'CASH', days: 0, fee: null },
    { id: '00000000-0000-0000-0000-000000000955', code: 'TRANSFERENCIA', name: 'Transferência', type: 'BANK_TRANSFER', days: 0, fee: null },
  ] as const;

  for (const [index, method] of RECEIPT_METHODS.entries()) {
    await prisma.receiptMethod.upsert({
      where: { id: method.id },
      update: {},
      create: {
        id: method.id,
        organizationId,
        code: method.code,
        name: method.name,
        methodType: method.type,
        defaultFinancialAccountId: method.type === 'CASH' ? CAIXA : CONTA_BB,
        settlementDays: method.days,
        percentageFee: method.fee,
        allowsInstallments: method.type === 'CREDIT_CARD',
        maximumInstallments: method.type === 'CREDIT_CARD' ? 12 : null,
        sortOrder: index,
        isSystem: true,
      },
    });
  }

  await prisma.treasurySettings.upsert({
    where: { companyId },
    update: {},
    create: {
      organizationId,
      companyId,
      primaryFinancialAccountId: CONTA_BB,
      defaultPaymentAccountId: CONTA_BB,
      defaultReceiptAccountId: CONTA_BB,
      defaultCashAccountId: CAIXA,
      minimumSafetyBalance: 5000,
      requireDualApproval: true,
      dualApprovalAmount: 10000,
      cardExpirationAlertDays: 60,
    },
  });

  console.log(
    'Tesouraria de demonstração criada: 3 contas, saldos iniciais, chave PIX, cartão corporativo, 5 formas de pagamento, 5 de recebimento e parâmetros.',
  );
}

/**
 * Documentos de demonstração da entrada de documentos (seção 83).
 *
 * Todos os dados são fictícios. Nenhum documento aqui tem arquivo em storage: o registro
 * existe para que as telas tenham o que mostrar, e a visualização do arquivo avisa
 * corretamente que não há arquivo armazenado — inventar um PDF falso seria pior.
 *
 * Nenhum destes documentos é uma obrigação financeira: mesmo o que está "pronto para
 * processamento" apenas aguarda o módulo seguinte.
 */
async function seedDemoDocumentIntake(
  organizationId: string,
  companyId: string,
  demoSupplierId: string,
  categoryId: string,
  costCenterId: string,
) {
  console.log('Aplicando seed de entrada de documentos de demonstração...');

  // Fornecedores fictícios de utilidades, para os documentos de energia e internet.
  const energySupplier = await prisma.supplier.upsert({
    where: { normalizedDocumentNumber: '31500900000106' },
    update: {},
    create: {
      organizationId,
      personType: 'LEGAL_ENTITY',
      documentNumber: '31500900000106',
      normalizedDocumentNumber: '31500900000106',
      legalName: 'Coelba Distribuidora de Energia S.A.',
      tradeName: 'Coelba',
      displayName: 'Coelba',
      systemStatus: 'ACTIVE',
      segment: 'Energia elétrica',
      email: 'faturamento@coelba.example.com',
    },
  });

  const internetSupplier = await prisma.supplier.upsert({
    where: { normalizedDocumentNumber: '09876543000121' },
    update: {},
    create: {
      organizationId,
      personType: 'LEGAL_ENTITY',
      documentNumber: '09876543000121',
      normalizedDocumentNumber: '09876543000121',
      legalName: 'Conecta Sul Telecomunicações Ltda.',
      tradeName: 'Conecta Sul',
      displayName: 'Conecta Sul',
      systemStatus: 'ACTIVE',
      segment: 'Telecomunicações',
      email: 'financeiro@conectasul.example.com',
    },
  });

  for (const supplierId of [energySupplier.id, internetSupplier.id]) {
    await prisma.supplierCompanyLink.upsert({
      where: { supplierId_companyId: { supplierId, companyId } },
      update: {},
      create: {
        supplierId,
        companyId,
        supplierTypes: ['SERVICE'],
        financialNature: 'EXPENSE',
        status: 'ACTIVE',
        autoIdentificationEnabled: true,
      },
    });
  }

  // Boleto válido por construção — os dígitos verificadores são calculados, não inventados.
  const energyDueDate = new Date(Date.UTC(2026, 7, 10));
  const energyBoleto = buildValidBoleto({
    bankCode: '001',
    amount: 2450,
    dueDate: energyDueDate,
    seed: 'coelba-demo',
  });

  // 1. Boleto de energia aguardando revisão.
  const energyDocument = await prisma.intakeDocument.upsert({
    where: { id: '00000000-0000-0000-0000-000000001001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000001001',
      organizationId,
      companyId,
      supplierId: energySupplier.id,
      documentType: 'BOLETO',
      documentDirection: 'PAYABLE',
      sourceChannel: 'MANUAL_UPLOAD',
      originalFileName: 'boleto-energia-agosto.pdf',
      displayName: 'Boleto de energia — agosto/2026',
      mimeType: 'application/pdf',
      fileExtension: 'pdf',
      fileSize: 184_320,
      pageCount: 1,
      documentNumber: '2026080001',
      issueDate: new Date(Date.UTC(2026, 6, 26)),
      competenceDate: new Date(Date.UTC(2026, 6, 1)),
      dueDate: energyDueDate,
      grossAmount: 2450,
      netAmount: 2450,
      barcode: energyBoleto.barcode,
      normalizedBarcode: energyBoleto.barcode,
      digitableLine: energyBoleto.digitableLine,
      normalizedDigitableLine: energyBoleto.digitableLine.replace(/\D/g, ''),
      issuerDocument: '31500900000106',
      issuerName: 'Coelba Distribuidora de Energia S.A.',
      recipientName: 'Tchê Grill Restaurante Ltda.',
      description: 'Energia elétrica — competência julho/2026',
      priority: 'HIGH',
      processingStatus: 'PENDING_REVIEW',
      reviewStatus: 'NOT_REVIEWED',
      duplicateStatus: 'NO_DUPLICATE',
      confidence: 92,
      companyConfidence: 99,
      supplierConfidence: 99,
      typeConfidence: 98,
      extractionMethod: 'DIGITABLE_LINE',
      categoryId,
      costCenterId,
      receivedAt: new Date(Date.UTC(2026, 6, 27, 13, 12)),
    },
  });

  await seedIntakeFields(energyDocument.id, [
    { fieldName: 'digitableLine', value: energyBoleto.digitableLine, method: 'DIGITABLE_LINE', confidence: 98 },
    { fieldName: 'dueDate', value: '2026-08-10', method: 'DIGITABLE_LINE', confidence: 98 },
    { fieldName: 'grossAmount', value: '2450.00', method: 'DIGITABLE_LINE', confidence: 98 },
    { fieldName: 'issuerDocument', value: '31500900000106', method: 'PDF_TEXT', confidence: 90 },
  ]);

  await seedIntakeIssue(energyDocument.id, {
    issueType: 'CATEGORY_MISSING',
    severity: 'WARNING',
    description:
      'A categoria sugerida veio do vínculo do fornecedor e ainda não foi confirmada na revisão.',
  });

  await seedIntakeHistory(energyDocument.id, [
    { newProcessingStatus: 'UPLOADED', changedAt: new Date(Date.UTC(2026, 6, 27, 13, 12)) },
    { newProcessingStatus: 'EXTRACTING', changedAt: new Date(Date.UTC(2026, 6, 27, 13, 12, 20)) },
    { newProcessingStatus: 'PENDING_REVIEW', changedAt: new Date(Date.UTC(2026, 6, 27, 13, 13)) },
  ]);

  // 2. Nota fiscal de carnes, pronta para o processamento.
  const meatDocument = await prisma.intakeDocument.upsert({
    where: { id: '00000000-0000-0000-0000-000000001002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000001002',
      organizationId,
      companyId,
      supplierId: demoSupplierId,
      documentType: 'NFE',
      documentDirection: 'PAYABLE',
      sourceChannel: 'MANUAL_UPLOAD',
      originalFileName: 'nfe-boi-forte-4471.xml',
      displayName: 'NF-e 4471 — Frigorífico Boi Forte',
      mimeType: 'application/xml',
      fileExtension: 'xml',
      fileSize: 22_016,
      documentNumber: '4471',
      documentSeries: '1',
      accessKey: '29260722333444000155550010000044711000044718',
      issueDate: new Date(Date.UTC(2026, 6, 24)),
      competenceDate: new Date(Date.UTC(2026, 6, 1)),
      dueDate: new Date(Date.UTC(2026, 7, 23)),
      grossAmount: 8900,
      netAmount: 8900,
      issuerDocument: '22333444000155',
      issuerName: 'Frigorífico Boi Forte Ltda.',
      recipientName: 'Tchê Grill Restaurante Ltda.',
      description: 'Compra de carnes para churrasco',
      processingStatus: 'READY_FOR_PROCESSING',
      reviewStatus: 'REVIEWED',
      duplicateStatus: 'NO_DUPLICATE',
      confidence: 100,
      companyConfidence: 100,
      supplierConfidence: 99,
      typeConfidence: 100,
      extractionMethod: 'XML_PARSE',
      categoryId,
      costCenterId,
      receivedAt: new Date(Date.UTC(2026, 6, 24, 9, 40)),
      processedAt: new Date(Date.UTC(2026, 6, 24, 9, 41)),
      forwardedAt: new Date(Date.UTC(2026, 6, 25, 10, 5)),
    },
  });

  await seedIntakeFields(meatDocument.id, [
    { fieldName: 'accessKey', value: '29260722333444000155550010000044711000044718', method: 'XML_PARSE', confidence: 100 },
    { fieldName: 'documentNumber', value: '4471', method: 'XML_PARSE', confidence: 100 },
    { fieldName: 'grossAmount', value: '8900.00', method: 'XML_PARSE', confidence: 100 },
    { fieldName: 'issuerDocument', value: '22333444000155', method: 'XML_PARSE', confidence: 100 },
  ]);

  await seedIntakeHistory(meatDocument.id, [
    { newProcessingStatus: 'UPLOADED', changedAt: new Date(Date.UTC(2026, 6, 24, 9, 40)) },
    { newProcessingStatus: 'PENDING_REVIEW', changedAt: new Date(Date.UTC(2026, 6, 24, 9, 41)) },
    {
      newProcessingStatus: 'READY_FOR_PROCESSING',
      newReviewStatus: 'REVIEWED',
      reason: 'Revisado e encaminhado para processamento.',
      changedAt: new Date(Date.UTC(2026, 6, 25, 10, 5)),
    },
  ]);

  // 3. Conta de internet já encaminhada — é o documento que o próximo repete.
  const internetOriginal = await prisma.intakeDocument.upsert({
    where: { id: '00000000-0000-0000-0000-000000001003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000001003',
      organizationId,
      companyId,
      supplierId: internetSupplier.id,
      documentType: 'UTILITY_BILL',
      documentDirection: 'PAYABLE',
      sourceChannel: 'MANUAL_UPLOAD',
      originalFileName: 'internet-julho.pdf',
      displayName: 'Internet — julho/2026',
      mimeType: 'application/pdf',
      fileExtension: 'pdf',
      fileSize: 96_256,
      pageCount: 2,
      documentNumber: 'CS-2026-07',
      issueDate: new Date(Date.UTC(2026, 6, 5)),
      dueDate: new Date(Date.UTC(2026, 6, 20)),
      grossAmount: 389.9,
      netAmount: 389.9,
      issuerDocument: '09876543000121',
      issuerName: 'Conecta Sul Telecomunicações Ltda.',
      description: 'Link dedicado — julho/2026',
      processingStatus: 'READY_FOR_PROCESSING',
      reviewStatus: 'REVIEWED',
      duplicateStatus: 'NO_DUPLICATE',
      confidence: 88,
      extractionMethod: 'PDF_TEXT',
      receivedAt: new Date(Date.UTC(2026, 6, 6, 8, 15)),
      forwardedAt: new Date(Date.UTC(2026, 6, 6, 11, 30)),
    },
  });

  // 4. A mesma conta de internet reenviada — possível duplicidade, aguardando decisão.
  const internetDuplicate = await prisma.intakeDocument.upsert({
    where: { id: '00000000-0000-0000-0000-000000001004' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000001004',
      organizationId,
      companyId,
      supplierId: internetSupplier.id,
      documentType: 'UTILITY_BILL',
      documentDirection: 'PAYABLE',
      sourceChannel: 'CAMERA_CAPTURE',
      originalFileName: 'foto-conta-internet.jpg',
      displayName: 'Internet — julho/2026 (reenvio)',
      mimeType: 'image/jpeg',
      fileExtension: 'jpg',
      fileSize: 1_248_576,
      pageCount: 1,
      documentNumber: 'CS-2026-07',
      issueDate: new Date(Date.UTC(2026, 6, 5)),
      dueDate: new Date(Date.UTC(2026, 6, 20)),
      grossAmount: 389.9,
      netAmount: 389.9,
      issuerDocument: '09876543000121',
      issuerName: 'Conecta Sul Telecomunicações Ltda.',
      description: 'Link dedicado — julho/2026',
      processingStatus: 'PENDING_REVIEW',
      reviewStatus: 'NOT_REVIEWED',
      duplicateStatus: 'POSSIBLE_DUPLICATE',
      confidence: 61,
      supplierConfidence: 96,
      typeConfidence: 84,
      extractionMethod: 'OCR',
      receivedAt: new Date(Date.UTC(2026, 6, 28, 16, 5)),
    },
  });

  await prisma.intakeDocumentDuplicateMatch.upsert({
    where: { id: '00000000-0000-0000-0000-000000001101' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000001101',
      documentId: internetDuplicate.id,
      matchedDocumentId: internetOriginal.id,
      matchType: 'DOCUMENT_NUMBER',
      similarityScore: 70,
      matchingFields: {
        documentNumber: 'CS-2026-07',
        grossAmount: '389.90',
        dueDate: '2026-07-20',
      },
      status: 'POSSIBLE_DUPLICATE',
      decision: 'PENDING',
    },
  });

  await seedIntakeIssue(internetDuplicate.id, {
    issueType: 'DUPLICATE_DOCUMENT',
    severity: 'WARNING',
    description:
      'Mesmo número de documento, valor e vencimento de um documento já encaminhado em 06/07/2026.',
  });

  await seedIntakeIssue(internetDuplicate.id, {
    issueType: 'AMOUNT_NOT_IDENTIFIED',
    severity: 'WARNING',
    description:
      'A leitura veio de uma foto e a confiança ficou abaixo do mínimo. Confira o valor antes de encaminhar.',
  });

  await seedIntakeHistory(internetDuplicate.id, [
    { newProcessingStatus: 'UPLOADED', changedAt: new Date(Date.UTC(2026, 6, 28, 16, 5)) },
    { newProcessingStatus: 'MATCHING', changedAt: new Date(Date.UTC(2026, 6, 28, 16, 6)) },
    {
      newProcessingStatus: 'PENDING_REVIEW',
      reason: 'Possível duplicidade encontrada.',
      changedAt: new Date(Date.UTC(2026, 6, 28, 16, 6, 30)),
    },
  ]);

  await prisma.documentIntakeSettings.upsert({
    where: { companyId },
    update: {},
    create: { organizationId, companyId },
  });

  console.log(
    'Entrada de documentos de demonstração criada: 4 documentos (boleto aguardando revisão, NF-e pronta, conta encaminhada e o reenvio em possível duplicidade), campos extraídos, pendências e histórico.',
  );
}

async function seedIntakeFields(
  documentId: string,
  fields: {
    fieldName: string;
    value: string;
    method: IntakeExtractionMethod;
    confidence: number;
  }[],
) {
  for (const field of fields) {
    await prisma.intakeDocumentExtractedField.upsert({
      where: { documentId_fieldName: { documentId, fieldName: field.fieldName } },
      update: {},
      create: {
        documentId,
        fieldName: field.fieldName,
        originalValue: field.value,
        normalizedValue: field.value,
        sourceMethod: field.method,
        confidence: field.confidence,
        validationStatus: field.confidence >= 95 ? 'VALID' : 'NOT_VALIDATED',
      },
    });
  }
}

async function seedIntakeIssue(
  documentId: string,
  issue: {
    issueType: IntakeIssueType;
    severity: IntakeIssueSeverity;
    description: string;
  },
) {
  const existing = await prisma.intakeDocumentIssue.findFirst({
    where: { documentId, issueType: issue.issueType },
  });
  if (existing) return;

  await prisma.intakeDocumentIssue.create({ data: { documentId, ...issue } });
}

async function seedIntakeHistory(
  documentId: string,
  entries: {
    newProcessingStatus?: IntakeProcessingStatus;
    newReviewStatus?: IntakeReviewStatus;
    reason?: string;
    changedAt: Date;
  }[],
) {
  const existing = await prisma.intakeDocumentStatusHistory.count({
    where: { documentId },
  });
  if (existing > 0) return;

  await prisma.intakeDocumentStatusHistory.createMany({
    data: entries.map((entry) => ({ documentId, ...entry })),
  });
}


/**
 * Lançamento de demonstração do processamento.
 *
 * Processa **um** dos documentos encaminhados e deixa o outro na fila, para que as duas
 * telas — "A processar" e "Contas a pagar" — tenham conteúdo.
 *
 * Nada aqui representa dinheiro que saiu: o título nasce em aberto e para aí.
 */
async function seedDemoDocumentProcessing(
  organizationId: string,
  companyId: string,
  categoryId: string,
  costCenterId: string,
) {
  console.log('Aplicando seed de processamento de demonstração...');

  await prisma.documentProcessingSettings.upsert({
    where: { companyId },
    update: {},
    create: { organizationId, companyId },
  });

  const internetDocumentId = '00000000-0000-0000-0000-000000001003';

  const document = await prisma.intakeDocument.findUnique({
    where: { id: internetDocumentId },
    select: { id: true, supplierId: true },
  });

  if (!document) return;

  const entry = await prisma.financialEntry.upsert({
    where: { id: '00000000-0000-0000-0000-000000002001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000002001',
      organizationId,
      companyId,
      sourceIntakeDocumentId: document.id,
      direction: 'PAYABLE',
      origin: 'DOCUMENT_INTAKE',
      status: 'OPEN',
      supplierId: document.supplierId,
      documentNumber: 'CS-2026-07',
      issueDate: new Date(Date.UTC(2026, 6, 5)),
      competenceDate: new Date(Date.UTC(2026, 6, 1)),
      description: 'Link dedicado — julho/2026',
      grossAmount: 389.9,
      netAmount: 389.9,
      categoryId,
      costCenterId,
      classificationSources: {
        categoryId: 'SUPPLIER_DEFAULT',
        costCenterId: 'SUPPLIER_DEFAULT',
      },
      openedAt: new Date(Date.UTC(2026, 6, 6, 11, 40)),
      installments: {
        create: {
          installmentNumber: 1,
          totalInstallments: 1,
          dueDate: new Date(Date.UTC(2026, 6, 20)),
          grossAmount: 389.9,
          netAmount: 389.9,
        },
      },
      statusHistory: {
        create: [
          {
            newStatus: 'DRAFT',
            reason: 'Lançamento gerado a partir do documento encaminhado.',
            changedAt: new Date(Date.UTC(2026, 6, 6, 11, 35)),
          },
          {
            previousStatus: 'DRAFT',
            newStatus: 'OPEN',
            reason: 'Lançamento aberto.',
            changedAt: new Date(Date.UTC(2026, 6, 6, 11, 40)),
          },
        ],
      },
    },
  });

  await prisma.intakeDocument.update({
    where: { id: document.id },
    data: {
      processingStatus: 'PROCESSED',
      processedAt: new Date(Date.UTC(2026, 6, 6, 11, 35)),
    },
  });

  console.log(
    `Processamento de demonstração criado: 1 lançamento a pagar em aberto (${entry.documentNumber}) e 1 documento ainda na fila.`,
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
