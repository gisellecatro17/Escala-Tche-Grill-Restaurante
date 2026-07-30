"use client";

import * as React from "react";
import Link from "next/link";
import {
  Archive,
  Ban,
  CheckCircle2,
  Copy,
  FolderTree,
  Info,
  LayoutList,
  Move,
  Pencil,
  Trash2,
} from "lucide-react";

import {
  useAccountPlanTree,
  useCreateAccountPlan,
  useDeleteAccountPlan,
  useDuplicateAccountPlan,
  useFinancialNatures,
  useMoveAccountPlan,
  useNextAccountCode,
  useStructureLifecycle,
  useUpdateAccountPlan,
} from "@/lib/api/financial-structure";
import { useSession } from "@/lib/auth/session-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExportMenu } from "@/components/financial-structure/export-menu";
import { MoveNodeDialog } from "@/components/financial-structure/move-node-dialog";
import { NodeDialog } from "@/components/financial-structure/node-dialog";
import { StructureTable } from "@/components/financial-structure/structure-table";
import {
  StructureTree,
  flattenTree,
  type StructureTreeAction,
} from "@/components/financial-structure/structure-tree";
import {
  ACCOUNT_KIND_LABELS,
  ACCOUNT_PLAN_TYPE_LABELS,
  type AccountKind,
  type AccountPlan,
  type AccountPlanKind,
  type AccountPlanType,
} from "@/types/financial-structure";

const PLAN_KIND_LABELS: Record<AccountPlanKind, string> = {
  MANAGEMENT: "Gerencial",
  FINANCIAL: "Financeiro",
  ACCOUNTING: "Contábil",
  HYBRID: "Híbrido",
};

export default function AccountPlanPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;
  const companyId = selectedCompanyId ?? undefined;

  const [includeInactive, setIncludeInactive] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [moveOpen, setMoveOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AccountPlan | null>(null);
  const [parent, setParent] = React.useState<AccountPlan | null>(null);
  const [accountType, setAccountType] = React.useState<AccountPlanType>("EXPENSE");
  const [accountKind, setAccountKind] = React.useState<AccountKind>("ANALYTICAL");
  const [planType, setPlanType] = React.useState<AccountPlanKind>("MANAGEMENT");
  const [financialNatureId, setFinancialNatureId] = React.useState<string | undefined>();
  const [autoCode, setAutoCode] = React.useState(true);

  const { data: tree, isLoading } = useAccountPlanTree(
    organizationId,
    companyId,
    includeInactive,
  );
  const { data: natures } = useFinancialNatures(organizationId, companyId);

  // A prévia do código só é buscada ao criar com geração automática ligada.
  const nextCode = useNextAccountCode(
    organizationId,
    companyId,
    parent?.id,
    dialogOpen && !editing && autoCode,
  );

  const createAccount = useCreateAccountPlan();
  const updateAccount = useUpdateAccountPlan();
  const moveAccount = useMoveAccountPlan();
  const duplicateAccount = useDuplicateAccountPlan();
  const deleteAccount = useDeleteAccountPlan();
  const lifecycle = useStructureLifecycle("/financial-account-plans", [
    "account-plans",
  ]);

  const canManage = hasPermission("account_plan.manage");
  const canManageTree = hasPermission("account_plan.move");
  const canDelete = hasPermission("account_plan.delete");
  const canActivate = hasPermission("account_plan.activate");
  const canDeactivate = hasPermission("account_plan.deactivate");

  const flatOptions = React.useMemo(() => flattenTree(tree ?? []), [tree]);

  function openCreate(parentAccount: AccountPlan | null) {
    setEditing(null);
    setParent(parentAccount);
    setAccountType(parentAccount?.accountType ?? "EXPENSE");
    setAccountKind("ANALYTICAL");
    setPlanType(parentAccount?.planType ?? "MANAGEMENT");
    setFinancialNatureId(undefined);
    setAutoCode(true);
    setDialogOpen(true);
  }

  function openEdit(account: AccountPlan) {
    setEditing(account);
    setParent(null);
    setAccountType(account.accountType);
    setAccountKind(account.accountKind);
    setPlanType(account.planType ?? "MANAGEMENT");
    setFinancialNatureId(account.financialNatureId ?? undefined);
    setAutoCode(false);
    setDialogOpen(true);
  }

  const actions: StructureTreeAction<AccountPlan>[] = [
    ...(canManage
      ? [{ label: "Editar", icon: <Pencil />, onSelect: openEdit }]
      : []),
    ...(canManageTree
      ? [
          {
            label: "Mover na árvore",
            icon: <Move />,
            onSelect: (item: AccountPlan) => {
              setEditing(item);
              setMoveOpen(true);
            },
          },
        ]
      : []),
    ...(hasPermission("financial_structure.duplicate")
      ? [
          {
            label: "Duplicar",
            icon: <Copy />,
            onSelect: (item: AccountPlan) =>
              duplicateAccount.mutate({
                id: item.id,
                payload: { includeChildren: true },
              }),
          },
        ]
      : []),
    ...(canActivate
      ? [
          {
            label: "Ativar",
            icon: <CheckCircle2 />,
            hidden: (item: AccountPlan) =>
              (item.structureStatus ?? "ACTIVE") === "ACTIVE",
            onSelect: (item: AccountPlan) => lifecycle.activate.mutate(item.id),
          },
        ]
      : []),
    ...(canDeactivate
      ? [
          {
            label: "Inativar",
            icon: <Ban />,
            hidden: (item: AccountPlan) =>
              (item.structureStatus ?? "ACTIVE") !== "ACTIVE",
            onSelect: (item: AccountPlan) => {
              const reason = window.prompt(
                `Inativar "${item.name}"? Nada é excluído: os lançamentos que apontam para esta conta continuam íntegros.\n\nMotivo (opcional):`,
              );
              if (reason === null) return;
              lifecycle.deactivate.mutate({ id: item.id, reason: reason || undefined });
            },
          },
          {
            label: "Arquivar",
            icon: <Archive />,
            hidden: (item: AccountPlan) =>
              (item.structureStatus ?? "ACTIVE") === "ARCHIVED",
            onSelect: (item: AccountPlan) => {
              const reason = window.prompt(
                `Arquivar "${item.name}"? A conta sai das listagens, mas continua consultável.\n\nMotivo (opcional):`,
              );
              if (reason === null) return;
              lifecycle.archive.mutate({ id: item.id, reason: reason || undefined });
            },
          },
        ]
      : []),
    ...(canDelete
      ? [
          {
            label: "Excluir",
            icon: <Trash2 />,
            destructive: true,
            hidden: (item: AccountPlan) => item.isSystem,
            onSelect: (item: AccountPlan) => {
              if (window.confirm(`Excluir a conta "${item.name}"?`)) {
                deleteAccount.mutate(item.id);
              }
            },
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
            <Link href="/cadastros/estrutura-financeira">
              <FolderTree /> Estrutura financeira
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Plano de contas</h1>
          <p className="text-sm text-muted-foreground">
            Estrutura contábil gerencial em árvore, sem limite de profundidade. Apenas
            contas analíticas aceitam lançamentos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasPermission("financial_structure.export") && (
            <ExportMenu
              organizationId={organizationId}
              companyId={companyId}
              entity="ACCOUNT_PLAN"
              fileBaseName="plano-de-contas"
              includeInactive={includeInactive}
            />
          )}
          {canManage && (
            <Button onClick={() => openCreate(null)}>+ Incluir nova conta</Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="arvore">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="arvore">
              <FolderTree className="size-4" /> Árvore
            </TabsTrigger>
            <TabsTrigger value="tabela">
              <LayoutList className="size-4" /> Tabela
            </TabsTrigger>
          </TabsList>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={includeInactive}
              onCheckedChange={(checked) => setIncludeInactive(checked === true)}
            />
            Exibir contas inativas
          </label>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-8 w-full" />
            ))}
          </div>
        ) : (
          <>
            <TabsContent value="arvore">
              <Card className="gap-0 p-2">
                <StructureTree<AccountPlan>
                  nodes={tree ?? []}
                  onAddChild={canManage ? openCreate : undefined}
                  emptyMessage="Nenhuma conta cadastrada. Comece incluindo os grupos principais (1 Ativo, 2 Passivo, 3 Receitas...)."
                  renderMeta={(item) => (
                    <Badge variant="outline" className="text-[10px]">
                      {ACCOUNT_PLAN_TYPE_LABELS[item.accountType]}
                    </Badge>
                  )}
                  actions={actions}
                />
              </Card>
            </TabsContent>

            <TabsContent value="tabela">
              <StructureTable<AccountPlan>
                nodes={tree ?? []}
                emptyMessage="Nenhuma conta cadastrada."
                actions={actions}
                columns={[
                  {
                    header: "Tipo",
                    className: "w-32",
                    render: (item) => ACCOUNT_PLAN_TYPE_LABELS[item.accountType],
                  },
                  {
                    header: "Natureza",
                    className: "w-28",
                    render: (item) => ACCOUNT_KIND_LABELS[item.accountKind],
                  },
                  {
                    header: "Plano",
                    className: "w-28",
                    render: (item) =>
                      PLAN_KIND_LABELS[item.planType ?? "MANAGEMENT"],
                  },
                  {
                    header: "Lançamentos",
                    className: "w-28",
                    render: (item) =>
                      item.acceptsEntries ? (
                        "Aceita"
                      ) : (
                        <span className="text-muted-foreground">Não aceita</span>
                      ),
                  },
                  {
                    header: "Relatórios",
                    className: "w-40",
                    render: (item) => (
                      <span className="flex flex-wrap gap-1">
                        {item.showInCashFlow !== false && (
                          <Badge variant="outline" className="text-[10px]">
                            Fluxo
                          </Badge>
                        )}
                        {item.showInIncomeStatement !== false && (
                          <Badge variant="outline" className="text-[10px]">
                            DRE
                          </Badge>
                        )}
                        {item.showInManagementBalance && (
                          <Badge variant="outline" className="text-[10px]">
                            Balanço
                          </Badge>
                        )}
                      </span>
                    ),
                  },
                ]}
              />
            </TabsContent>
          </>
        )}
      </Tabs>

      {!organizationId && (
        <p className="text-sm text-muted-foreground">
          <Info className="mr-1 inline size-4" />
          Selecione uma organização para visualizar o plano de contas.
        </p>
      )}

      {dialogOpen && (
        <NodeDialog
          key={editing?.id ?? parent?.id ?? "novo"}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          requireCode={!autoCode}
          title={editing ? "Editar conta" : "+ Incluir nova conta"}
          description={
            parent
              ? `A conta será criada abaixo de "${parent.code} ${parent.name}".`
              : undefined
          }
          initialValues={{
            code: editing?.code ?? "",
            name: editing?.name ?? "",
            description: editing?.description ?? "",
            notes: editing?.notes ?? "",
          }}
          isSubmitting={createAccount.isPending || updateAccount.isPending}
          onSubmit={async (values) => {
            const payload = {
              name: values.name.trim(),
              description: values.description || undefined,
              notes: values.notes || undefined,
              accountType,
              accountKind,
              planType,
              financialNatureId,
            };

            if (editing) {
              await updateAccount.mutateAsync({
                id: editing.id,
                payload: { ...payload, code: values.code.trim() },
              });
              return;
            }

            await createAccount.mutateAsync({
              ...payload,
              // Com geração automática, o código é resolvido no back-end, onde a
              // unicidade também é validada.
              ...(autoCode
                ? { autoGenerateCode: true }
                : { code: values.code.trim() }),
              organizationId,
              companyId,
              parentAccountId: parent?.id,
            });
          }}
        >
          <div className="flex flex-col gap-3">
            {!editing && (
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={autoCode}
                  onCheckedChange={(checked) => setAutoCode(checked === true)}
                />
                <span>
                  Gerar o código automaticamente
                  <span className="block text-xs text-muted-foreground">
                    {autoCode
                      ? nextCode.data
                        ? `O próximo código disponível é ${nextCode.data.code}.`
                        : "Calculando o próximo código..."
                      : "O código informado deve começar pelo código da conta superior."}
                  </span>
                </span>
              </label>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>Tipo</Label>
                <Select
                  value={accountType}
                  onValueChange={(value) => setAccountType(value as AccountPlanType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACCOUNT_PLAN_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Natureza da conta</Label>
                <Select
                  value={accountKind}
                  onValueChange={(value) => setAccountKind(value as AccountKind)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACCOUNT_KIND_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Finalidade do plano</Label>
                <Select
                  value={planType}
                  onValueChange={(value) => setPlanType(value as AccountPlanKind)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PLAN_KIND_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Natureza financeira</Label>
                <Select value={financialNatureId} onValueChange={setFinancialNatureId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {(natures ?? []).map((nature) => (
                      <SelectItem key={nature.id} value={nature.id}>
                        {nature.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </NodeDialog>
      )}

      {moveOpen && editing && (
        <MoveNodeDialog
          open={moveOpen}
          onOpenChange={setMoveOpen}
          nodeName={editing.name}
          options={flatOptions
            .filter((option) => option.item.id !== editing.id)
            .map((option) => ({
              id: option.item.id,
              label: `${option.item.code ?? ""} ${option.item.name}`.trim(),
              depth: option.depth,
            }))}
          isSubmitting={moveAccount.isPending}
          onSubmit={(parentId, reason) =>
            moveAccount.mutateAsync({ id: editing.id, payload: { parentId, reason } })
          }
        />
      )}
    </div>
  );
}
