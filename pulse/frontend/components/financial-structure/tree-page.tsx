"use client";

import * as React from "react";
import { Download, Move, Pencil, Trash2 } from "lucide-react";

import { useExportStructure } from "@/lib/api/financial-structure";
import { useSession } from "@/lib/auth/session-context";
import { downloadCsv } from "@/lib/download";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MoveNodeDialog } from "@/components/financial-structure/move-node-dialog";
import { NodeDialog, type NodeFormValues } from "@/components/financial-structure/node-dialog";
import {
  StructureTree,
  flattenTree,
  type TreeItem,
} from "@/components/financial-structure/structure-tree";
import type { HierarchyEntity, TreeNode } from "@/types/financial-structure";

interface TreePagePermissions {
  manage: string;
  manageTree: string;
  delete: string;
}

interface TreePageProps<T extends TreeItem> {
  title: string;
  description: string;
  addLabel: string;
  emptyMessage: string;
  entity: HierarchyEntity;
  exportFileName: string;
  tree: TreeNode<T>[] | undefined;
  isLoading: boolean;
  includeInactive: boolean;
  onIncludeInactiveChange: (value: boolean) => void;
  permissions: TreePagePermissions;
  isSubmitting: boolean;
  isMoving: boolean;
  onCreate: (values: NodeFormValues, parent: T | null) => Promise<unknown>;
  onUpdate: (id: string, values: NodeFormValues) => Promise<unknown>;
  onMove: (id: string, parentId: string | null, reason?: string) => Promise<unknown>;
  onDelete: (id: string) => void;
  /** Campos extras do formulário, específicos de cada cadastro. */
  dialogExtras?: React.ReactNode;
  /** Chamado ao abrir o formulário, para o pai reinicializar seus campos extras. */
  onDialogOpen?: (item: T | null, parent: T | null) => void;
  requireCode?: boolean;
  companyScoped?: boolean;
}

/**
 * Página padrão dos cadastros em árvore da estrutura financeira (categorias, centros de
 * custo, centros de resultado e unidades de negócio). O plano de contas tem tela própria
 * por conta dos campos contábeis adicionais.
 */
export function TreePage<T extends TreeItem>({
  title,
  description,
  addLabel,
  emptyMessage,
  entity,
  exportFileName,
  tree,
  isLoading,
  includeInactive,
  onIncludeInactiveChange,
  permissions,
  isSubmitting,
  isMoving,
  onCreate,
  onUpdate,
  onMove,
  onDelete,
  dialogExtras,
  onDialogOpen,
  requireCode = false,
  companyScoped = true,
}: TreePageProps<T>) {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [moveOpen, setMoveOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<T | null>(null);
  const [parent, setParent] = React.useState<T | null>(null);

  const exportStructure = useExportStructure();

  const canManage = hasPermission(permissions.manage);
  const canManageTree = hasPermission(permissions.manageTree);
  const canDelete = hasPermission(permissions.delete);
  const canExport = hasPermission("financial_structure.export");

  const flatOptions = React.useMemo(() => flattenTree(tree ?? []), [tree]);

  function open(item: T | null, parentItem: T | null) {
    setEditing(item);
    setParent(parentItem);
    onDialogOpen?.(item, parentItem);
    setDialogOpen(true);
  }

  async function handleExport() {
    if (!organizationId) return;
    const result = await exportStructure.mutateAsync({
      organizationId,
      companyId: companyScoped ? (selectedCompanyId ?? undefined) : undefined,
      entity,
      format: "csv",
    });
    if (result.content) downloadCsv(exportFileName, result.content);
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canExport && (
            <Button variant="outline" onClick={handleExport} disabled={exportStructure.isPending}>
              <Download /> Exportar
            </Button>
          )}
          {canManage && <Button onClick={() => open(null, null)}>{addLabel}</Button>}
        </div>
      </div>

      <Card className="gap-0 p-2">
        <label className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => onIncludeInactiveChange(e.target.checked)}
          />
          Exibir registros inativos
        </label>

        {isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : (
          <StructureTree<T>
            nodes={tree ?? []}
            emptyMessage={emptyMessage}
            onAddChild={canManage ? (item) => open(null, item) : undefined}
            actions={[
              ...(canManage
                ? [{ label: "Editar", icon: <Pencil />, onSelect: (item: T) => open(item, null) }]
                : []),
              ...(canManageTree
                ? [
                    {
                      label: "Mover na árvore",
                      icon: <Move />,
                      onSelect: (item: T) => {
                        setEditing(item);
                        setMoveOpen(true);
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
                      hidden: (item: T) => Boolean(item.isSystem),
                      onSelect: (item: T) => {
                        if (window.confirm(`Excluir "${item.name}"? Esta ação não pode ser desfeita.`)) {
                          onDelete(item.id);
                        }
                      },
                    },
                  ]
                : []),
            ]}
          />
        )}
      </Card>

      {dialogOpen && (
        <NodeDialog
          key={editing?.id ?? parent?.id ?? "novo"}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          requireCode={requireCode}
          title={editing ? "Editar registro" : addLabel}
          description={parent ? `Será criado abaixo de "${parent.name}".` : undefined}
          initialValues={{
            code: editing?.code ?? "",
            name: editing?.name ?? "",
          }}
          isSubmitting={isSubmitting}
          onSubmit={async (values) => {
            if (editing) await onUpdate(editing.id, values);
            else await onCreate(values, parent);
          }}
        >
          {dialogExtras}
        </NodeDialog>
      )}

      {moveOpen && editing && (
        <MoveNodeDialog
          open={moveOpen}
          onOpenChange={setMoveOpen}
          nodeName={editing.name}
          options={flatOptions
            .filter((o) => o.item.id !== editing.id)
            .map((o) => ({
              id: o.item.id,
              label: `${o.item.code ?? ""} ${o.item.name}`.trim(),
              depth: o.depth,
            }))}
          isSubmitting={isMoving}
          onSubmit={(parentId, reason) => onMove(editing.id, parentId, reason)}
        />
      )}
    </div>
  );
}
