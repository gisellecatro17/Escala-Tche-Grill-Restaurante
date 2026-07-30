"use client";

import * as React from "react";

import {
  useBusinessUnitTree,
  useCreateBusinessUnit,
  useDeleteBusinessUnit,
  useMoveBusinessUnit,
  useUpdateBusinessUnit,
} from "@/lib/api/financial-structure";
import { useSession } from "@/lib/auth/session-context";
import { TreePage } from "@/components/financial-structure/tree-page";
import type { BusinessUnit } from "@/types/financial-structure";

export default function BusinessUnitsPage() {
  const { user, selectedCompanyId } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;
  const [includeInactive, setIncludeInactive] = React.useState(false);

  const { data: tree, isLoading } = useBusinessUnitTree(
    organizationId,
    selectedCompanyId ?? undefined,
    includeInactive,
  );

  const createBusinessUnit = useCreateBusinessUnit();
  const updateBusinessUnit = useUpdateBusinessUnit();
  const moveBusinessUnit = useMoveBusinessUnit();
  const deleteBusinessUnit = useDeleteBusinessUnit();

  return (
    <TreePage<BusinessUnit>
      title="Unidades de negócio"
      description="Dimensão independente das demais (BPO Financeiro, Tecnologia, Consultoria, Holding). Pode ser compartilhada por toda a organização ou exclusiva de uma empresa."
      addLabel="+ Incluir nova unidade de negócio"
      emptyMessage="Nenhuma unidade de negócio cadastrada."
      entity="BUSINESS_UNIT"
      exportFileName="unidades-de-negocio.csv"
      companyScoped={false}
      tree={tree}
      isLoading={isLoading}
      includeInactive={includeInactive}
      onIncludeInactiveChange={setIncludeInactive}
      permissions={{
        manage: "business_unit.manage",
        manageTree: "business_unit.manage",
        delete: "business_unit.delete",
      }}
      isSubmitting={createBusinessUnit.isPending || updateBusinessUnit.isPending}
      isMoving={moveBusinessUnit.isPending}
      onCreate={async (values, parent) => {
        if (!organizationId) return;
        await createBusinessUnit.mutateAsync({
          organizationId,
          companyId: selectedCompanyId ?? undefined,
          name: values.name.trim(),
          code: values.code || undefined,
          description: values.description || undefined,
          notes: values.notes || undefined,
          parentBusinessUnitId: parent?.id,
        });
      }}
      onUpdate={async (id, values) => {
        await updateBusinessUnit.mutateAsync({
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
        moveBusinessUnit.mutateAsync({ id, payload: { parentId, reason } })
      }
      onDelete={(id) => deleteBusinessUnit.mutate(id)}
    />
  );
}
