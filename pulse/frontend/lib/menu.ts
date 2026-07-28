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
      { label: "Empresas", href: "/cadastros/empresas", icon: Building2, permission: "companies.view" },
      { label: "Fornecedores", href: "/cadastros/fornecedores", icon: Truck, permission: "suppliers.view" },
      { label: "Clientes", href: "/cadastros/clientes", icon: Users, permission: "customers.view" },
      { label: "Categorias financeiras", href: "/cadastros/categorias", icon: Tags, permission: "categories.view" },
      { label: "Centros de custo", href: "/cadastros/centros-de-custo", icon: Layers, permission: "cost-centers.view" },
      { label: "Contas bancárias", href: "/cadastros/contas-bancarias", icon: Landmark, permission: "bank-accounts.view" },
      { label: "Formas de pagamento", href: "/cadastros/formas-de-pagamento", icon: CreditCard, permission: "payment-methods.view" },
      { label: "Cartões e adquirentes", href: "/cadastros/cartoes-e-adquirentes", icon: CreditCard, permission: "acquirers.view" },
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
