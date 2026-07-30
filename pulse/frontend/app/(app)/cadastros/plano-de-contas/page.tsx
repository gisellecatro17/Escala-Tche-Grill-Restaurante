"use client";

import * as React from "react";
import { Copy, Download, FolderTree, Move, Pencil, Trash2 } from "lucide-react";

import {
  useAccountPlanTree,
  useCreateAccountPlan,
  useDeleteAccountPlan,
  useDuplicateAccountPlan,
  useExportStructure,
  useFinancialNatures,
  useMoveAccountPlan,
  useUpdateAccountPlan,
} from "@/lib/api/financial-structure";
import { useSession } from "@/lib/auth/session-context";
import { downloadCsv } from "@/lib/download";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { NodeDialog } from "@/components/financial-structure/node-dialog";
import { MoveNodeDialog } from "@/components/financial-structure/move-node-dialog";
import { StructureTree, flattenTree } from "@/components/financial-structure/structure-tree";
import {
  ACCOUNT_KIND_LABELS,
  ACCOUNT_PLAN_TYPE_LABELS,
  type AccountKind,
  type AccountPlan,
  type AccountPlanType,
} from "@/types/financial-structure";

export default function AccountPlanPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;

  const [includeInactive, setIncludeInactive] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [moveOpen, setMoveOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AccountPlan | null>(null);
  const [parent, setParent] = React.useState<AccountPlan | null>(null);
  const [accountType, setAccountType] = React.useState<AccountPlanType>("EXPENSE");
  const [accountKind, setAccountKind] = React.useState<AccountKind>("ANALYTICAL");
  const [financialNatureId, setFinancialNatureId] = React.useState<string | undefined>();

  const { data: tree, isLoading } = useAccountPlanTree(
    organizationId,
    selectedCompanyId ?? undefined,
    includeInactive,
  );
  const { data: natures } = useFinancialNatures(organizationId, selectedCompanyId ?? undefined);

  const createAccount = useCreateAccountPlan();
  const updateAccount = useUpdateAccountPlan();
  const moveAccount = useMoveAccountPlan();
  const duplicateAccount = useDuplicateAccountPlan();
  const deleteAccount = useDeleteAccountPlan();
  const exportStructure = useExportStructure();

  const canManage = hasPermission("account_plan.manage");
  const canManageTree = hasPermission("account_plan.move");
  const canDelete = hasPermission("account_plan.delete");
  const canExport = hasPermission("financial_structure.export");

  const flatOptions = React.useMemo(() => flattenTree(tree ?? []), [tree]);

  function openCreate(parentAccount: AccountPlan | null) {
    setEditing(null);
    setParent(parentAccount);
    setAccountType(parentAccount?.accountType ?? "EXPENSE");
    setAccountKind("ANALYTICAL");
    setFinancialNatureId(undefined);
    setDialogOpen(true);
  }

  function openEdit(account: AccountPlan) {
    setEditing(account);
    setParent(null);
    setAccountType(account.accountType);
    setAccountKind(account.accountKind);
    setFinancialNatureId(account.financialNatureId ?? undefined);
    setDialogOpen(true);
  }

  async function handleExport() {
    if (!organizationId) return;
    const result = await exportStructure.mutateAsync({
      organizationId,
      companyId: selectedCompanyId ?? undefined,
      entity: "ACCOUNT_PLAN",
      format: "csv",
    });
    if (result.content) downloadCsv("plano-de-contas.csv", result.content);
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Plano de contas</h1>
          <p className="text-sm text-muted-foreground">
            Estrutura contábil gerencial em árvore, sem limite de profundidade. Apenas contas
            analíticas aceitam lançamentos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canExport && (
            <Button variant="outline" onClick={handleExport} disabled={exportStructure.isPending}>
              <Download /> Exportar
            </Button>
          )}
          {canManage && <Button onClick={() => openCreate(null)}>+ Incluir nova conta</Button>}
        </div>
      </div>

      <Card className="gap-0 p-2">
        <label className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
          />
          Exibir contas inativas
        </label>

        {isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : (
          <StructureTree<AccountPlan>
            nodes={tree ?? []}
            onAddChild={canManage ? openCreate : undefined}
            emptyMessage="Nenhuma conta cadastrada. Comece incluindo os grupos principais (1 Ativo, 2 Passivo, 3 Receitas...)."
            renderMeta={(item) => (
              <Badge variant="outline" className="text-[10px]">
                {ACCOUNT_PLAN_TYPE_LABELS[item.accountType]}
              </Badge>
            )}
            actions={[
              ...(canManage
                ? [
                    {
                      label: "Editar",
                      icon: <Pencil />,
                      onSelect: openEdit,
                    },
                  ]
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
                        duplicateAccount.mutate({ id: item.id, payload: { includeChildren: true } }),
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
            ]}
          />
        )}
      </Card>

      {!organizationId && (
        <p className="text-sm text-muted-foreground">
          <FolderTree className="mr-1 inline size-4" />
          Selecione uma organização para visualizar o plano de contas.
        </p>
      )}

      {dialogOpen && (
        <NodeDialog
          key={editing?.id ?? parent?.id ?? "novo"}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          requireCode
          title={editing ? "Editar conta" : "+ Incluir nova conta"}
          description={
            parent ? `A conta será criada abaixo de "${parent.code} ${parent.name}".` : undefined
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
              code: values.code.trim(),
              name: values.name.trim(),
              description: values.description || undefined,
              notes: values.notes || undefined,
              accountType,
              accountKind,
              financialNatureId,
            };
            if (editing) {
              await updateAccount.mutateAsync({ id: editing.id, payload });
            } else {
              await createAccount.mutateAsync({
                ...payload,
                organizationId,
                companyId: selectedCompanyId ?? undefined,
                parentAccountId: parent?.id,
              });
            }
          }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label>Tipo</Label>
              <Select value={accountType} onValueChange={(v) => setAccountType(v as AccountPlanType)}>
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
              <Select value={accountKind} onValueChange={(v) => setAccountKind(v as AccountKind)}>
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
        </NodeDialog>
      )}

      {moveOpen && editing && (
        <MoveNodeDialog
          open={moveOpen}
          onOpenChange={setMoveOpen}
          nodeName={editing.name}
          options={flatOptions
            .filter((o) => o.item.id !== editing.id)
            .map((o) => ({ id: o.item.id, label: `${o.item.code ?? ""} ${o.item.name}`.trim(), depth: o.depth }))}
          isSubmitting={moveAccount.isPending}
          onSubmit={(parentId, reason) =>
            moveAccount.mutateAsync({ id: editing.id, payload: { parentId, reason } })
          }
        />
      )}
    </div>
  );
}
