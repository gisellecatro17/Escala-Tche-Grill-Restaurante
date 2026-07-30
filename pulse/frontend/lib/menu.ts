import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  AlertTriangle,
  Bell,
  Building2,
  Users,
  Truck,
  Tags,
  Landmark,
  CreditCard,
  Layers,
  FileInput,
  FileClock,
  ShieldCheck,
  ListChecks,
  CalendarClock,
  CheckCircle2,
  ArrowLeftRight,
  Upload,
  GitCompareArrows,
  Lock,
  BarChart3,
  LineChart,
  PieChart,
  Gauge,
  FileBarChart,
  Settings,
  UserCog,
  KeyRound,
  SlidersHorizontal,
  Workflow,
  Plug,
  History,
  FolderTree,
  FolderKanban,
  Network,
  Scale,
  SplitSquareHorizontal,
  Target,
  Wand2,
  Tag as TagIcon,
} from "lucide-react";

export interface MenuItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Permissão necessária para exibir o item (slug de permissão). Vazio = todos autenticados. */
  permission?: string;
  /** Telas ainda não implementadas aparecem desabilitadas com selo "Em breve". */
  implemented?: boolean;
}

export interface MenuModule {
  label: string;
  items: MenuItem[];
}

export const MENU: MenuModule[] = [
  {
    label: "Visão Geral",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard, implemented: true },
      { label: "Saldo financeiro", href: "/visao-geral/saldo", icon: Wallet },
      { label: "Contas a pagar", href: "/visao-geral/contas-a-pagar", icon: ArrowUpCircle },
      { label: "Contas a receber", href: "/visao-geral/contas-a-receber", icon: ArrowDownCircle },
      { label: "Resultado", href: "/visao-geral/resultado", icon: TrendingUp },
      { label: "Pendências", href: "/visao-geral/pendencias", icon: ListChecks },
      { label: "Alertas", href: "/visao-geral/alertas", icon: AlertTriangle },
      { label: "Atalhos", href: "/visao-geral/atalhos", icon: Bell },
    ],
  },
  {
    label: "Cadastros",
    items: [
      { label: "Empresas", href: "/cadastros/empresas", icon: Building2, permission: "company.view", implemented: true },
      { label: "Fornecedores", href: "/cadastros/fornecedores", icon: Truck, permission: "supplier.view", implemented: true },
      { label: "Clientes", href: "/cadastros/clientes", icon: Users, permission: "customer.view", implemented: true },
      { label: "Estrutura financeira", href: "/cadastros/estrutura-financeira", icon: Network, permission: "financial_structure.view", implemented: true },
      { label: "Plano de contas", href: "/cadastros/plano-de-contas", icon: FolderTree, permission: "account_plan.view", implemented: true },
      { label: "Categorias financeiras", href: "/cadastros/categorias", icon: Tags, permission: "financial_category.view", implemented: true },
      { label: "Centros de custo", href: "/cadastros/centros-de-custo", icon: Layers, permission: "cost_center.view", implemented: true },
      { label: "Centros de resultado", href: "/cadastros/centros-de-resultado", icon: Target, permission: "result_center.view", implemented: true },
      { label: "Projetos", href: "/cadastros/projetos", icon: FolderKanban, permission: "project.view", implemented: true },
      { label: "Unidades de negócio", href: "/cadastros/unidades-de-negocio", icon: Network, permission: "business_unit.view", implemented: true },
      { label: "Naturezas financeiras", href: "/cadastros/naturezas-financeiras", icon: Scale, permission: "financial_nature.view", implemented: true },
      { label: "Tags financeiras", href: "/cadastros/tags-financeiras", icon: TagIcon, permission: "financial_tag.view", implemented: true },
      { label: "Rateios", href: "/cadastros/rateios", icon: SplitSquareHorizontal, permission: "allocation_rule.view", implemented: true },
      { label: "Regras de classificação", href: "/cadastros/regras-de-classificacao", icon: Wand2, permission: "classification_rule.view", implemented: true },
      { label: "Importar estrutura", href: "/cadastros/estrutura-financeira/importar", icon: Upload, permission: "financial_structure.import", implemented: true },
      { label: "Histórico da estrutura", href: "/cadastros/estrutura-financeira/historico", icon: FileClock, permission: "financial_structure.manage_versions", implemented: true },
      { label: "Tesouraria", href: "/cadastros/tesouraria", icon: Landmark, permission: "treasury.view_dashboard", implemented: true },
      { label: "Contas financeiras", href: "/cadastros/contas-financeiras", icon: Landmark, permission: "financial_account.view", implemented: true },
      { label: "Cartões corporativos", href: "/cadastros/cartoes", icon: CreditCard, permission: "card.view", implemented: true },
      { label: "Chaves PIX", href: "/cadastros/chaves-pix", icon: KeyRound, permission: "financial_account.view", implemented: true },
      { label: "Formas de pagamento", href: "/cadastros/formas-de-pagamento", icon: ArrowUpCircle, permission: "payment_method.view", implemented: true },
      { label: "Formas de recebimento", href: "/cadastros/formas-de-recebimento", icon: ArrowDownCircle, permission: "receipt_method.view", implemented: true },
      { label: "Favorecidos bancários", href: "/cadastros/favorecidos-bancarios", icon: Users, permission: "treasury.view", implemented: true },
      { label: "Parâmetros de tesouraria", href: "/cadastros/tesouraria/parametros", icon: SlidersHorizontal, permission: "treasury.view", implemented: true },
      { label: "Histórico da tesouraria", href: "/cadastros/tesouraria/historico", icon: FileClock, permission: "treasury.view", implemented: true },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { label: "Visão financeira", href: "/financeiro", icon: Gauge, permission: "financial.view" },
      { label: "Envio de documentos", href: "/financeiro/envio-de-documentos", icon: FileInput, permission: "financial.documents" },
      { label: "A processar", href: "/financeiro/a-processar", icon: FileClock, permission: "financial.process" },
      { label: "A autorizar", href: "/financeiro/a-autorizar", icon: ShieldCheck, permission: "financial.approve" },
      { label: "Contas a pagar", href: "/financeiro/contas-a-pagar", icon: ArrowUpCircle, permission: "payables.view" },
      { label: "Contas a receber", href: "/financeiro/contas-a-receber", icon: ArrowDownCircle, permission: "receivables.view" },
      { label: "Agendados", href: "/financeiro/agendados", icon: CalendarClock, permission: "financial.scheduled" },
      { label: "Contas pagas", href: "/financeiro/contas-pagas", icon: CheckCircle2, permission: "financial.paid" },
      { label: "Movimentações", href: "/financeiro/movimentacoes", icon: ArrowLeftRight, permission: "financial.movements" },
      { label: "Importação bancária", href: "/financeiro/importacao-bancaria", icon: Upload, permission: "bank-import.view" },
      { label: "Conciliação bancária", href: "/financeiro/conciliacao-bancaria", icon: GitCompareArrows, permission: "reconciliation.view" },
      { label: "Transferências", href: "/financeiro/transferencias", icon: ArrowLeftRight, permission: "transfers.view" },
      { label: "Fechamento financeiro", href: "/financeiro/fechamento", icon: Lock, permission: "financial.closing" },
    ],
  },
  {
    label: "Inteligência Financeira",
    items: [
      { label: "Dashboard gerencial", href: "/inteligencia-financeira", icon: BarChart3, permission: "bi.view" },
      { label: "Fluxo de caixa", href: "/inteligencia-financeira/fluxo-de-caixa", icon: LineChart, permission: "bi.cash-flow" },
      { label: "DRE gerencial", href: "/inteligencia-financeira/dre", icon: FileBarChart, permission: "bi.dre" },
      { label: "Receitas e despesas", href: "/inteligencia-financeira/receitas-e-despesas", icon: PieChart, permission: "bi.revenue-expenses" },
      { label: "Categorias", href: "/inteligencia-financeira/categorias", icon: Tags, permission: "bi.categories" },
      { label: "Centros de custo", href: "/inteligencia-financeira/centros-de-custo", icon: Layers, permission: "bi.cost-centers" },
      { label: "Fornecedores", href: "/inteligencia-financeira/fornecedores", icon: Truck, permission: "bi.suppliers" },
      { label: "Clientes", href: "/inteligencia-financeira/clientes", icon: Users, permission: "bi.customers" },
      { label: "Indicadores", href: "/inteligencia-financeira/indicadores", icon: Gauge, permission: "bi.indicators" },
      { label: "Relatórios", href: "/inteligencia-financeira/relatorios", icon: FileBarChart, permission: "bi.reports" },
    ],
  },
  {
    label: "Configurações",
    items: [
      { label: "Dados da organização", href: "/configuracoes/organizacao", icon: Settings, permission: "settings.organization" },
      { label: "Usuários", href: "/configuracoes/usuarios", icon: UserCog, permission: "settings.users" },
      { label: "Perfis", href: "/configuracoes/perfis", icon: KeyRound, permission: "settings.roles" },
      { label: "Permissões", href: "/configuracoes/permissoes", icon: Lock, permission: "settings.permissions" },
      { label: "Parâmetros financeiros", href: "/configuracoes/parametros-financeiros", icon: SlidersHorizontal, permission: "settings.financial-params" },
      { label: "Regras de aprovação", href: "/configuracoes/regras-de-aprovacao", icon: Workflow, permission: "settings.approval-rules" },
      { label: "Regras de conciliação", href: "/configuracoes/regras-de-conciliacao", icon: GitCompareArrows, permission: "settings.reconciliation-rules" },
      { label: "Integrações", href: "/configuracoes/integracoes", icon: Plug, permission: "settings.integrations" },
      { label: "Notificações", href: "/configuracoes/notificacoes", icon: Bell, permission: "settings.notifications" },
      { label: "Auditoria", href: "/configuracoes/auditoria", icon: History, permission: "settings.audit" },
    ],
  },
];
