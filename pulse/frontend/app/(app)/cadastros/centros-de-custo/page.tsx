"use client";

import * as React from "react";

import {
  useCostCenterTree,
  useCreateCostCenter,
  useDeleteCostCenter,
  useMoveCostCenter,
  useUpdateCostCenter,
} from "@/lib/api/taxonomy";
import { useSession } from "@/lib/auth/session-context";
import { TreePage } from "@/components/financial-structure/tree-page";
import type { CostCenterNode } from "@/types/financial-structure";

export default function CostCentersPage() {
  const { selectedCompanyId } = useSession();
  const [includeInactive, setIncludeInactive] = React.useState(false);

  const { data: tree, isLoading } = useCostCenterTree(
    selectedCompanyId ?? undefined,
    includeInactive,
  );

  const createCostCenter = useCreateCostCenter();
  const updateCostCenter = useUpdateCostCenter();
  const moveCostCenter = useMoveCostCenter();
  const deleteCostCenter = useDeleteCostCenter();

  return (
    <TreePage<CostCenterNode>
      title="Centros de custo"
      description="Onde o gasto acontece. Árvore sem limite de profundidade — apenas os centros analíticos (folhas) aceitam lançamentos diretos."
      addLabel="+ Incluir novo centro de custo"
      emptyMessage="Nenhum centro de custo cadastrado. Comece incluindo as áreas principais (Administrativo, Operacional, Restaurante...)."
      entity="COST_CENTER"
      exportFileName="centros-de-custo.csv"
      tree={tree}
      isLoading={isLoading}
      includeInactive={includeInactive}
      onIncludeInactiveChange={setIncludeInactive}
      permissions={{
        manage: "cost_center.manage",
        manageTree: "cost_center.move",
        delete: "cost_center.delete",
      }}
      isSubmitting={createCostCenter.isPending || updateCostCenter.isPending}
      isMoving={moveCostCenter.isPending}
      onCreate={async (values, parent) => {
        if (!selectedCompanyId) return;
        await createCostCenter.mutateAsync({
          companyId: selectedCompanyId,
          name: values.name.trim(),
          code: values.code || undefined,
          description: values.description || undefined,
          notes: values.notes || undefined,
          parentCostCenterId: parent?.id,
        });
      }}
      onUpdate={async (id, values) => {
        await updateCostCenter.mutateAsync({
          id,
          payload: {
            name: values.name.trim(),
            code: values.code || undefined,
            description: values.description || undefined,
            notes: values.notes || undefined,
          },
        });
      }}
      onMove={(id, parentId, reason) =>
        moveCostCenter.mutateAsync({ id, payload: { parentId, reason } })
      }
      onDelete={(id) => deleteCostCenter.mutate(id)}
    />
  );
}
