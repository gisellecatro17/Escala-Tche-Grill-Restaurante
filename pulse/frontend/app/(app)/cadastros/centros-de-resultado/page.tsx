"use client";

import * as React from "react";

import {
  useCreateResultCenter,
  useDeleteResultCenter,
  useMoveResultCenter,
  useResultCenterTree,
  useUpdateResultCenter,
} from "@/lib/api/financial-structure";
import { useSession } from "@/lib/auth/session-context";
import { TreePage } from "@/components/financial-structure/tree-page";
import type { ResultCenter } from "@/types/financial-structure";

export default function ResultCentersPage() {
  const { selectedCompanyId } = useSession();
  const [includeInactive, setIncludeInactive] = React.useState(false);

  const { data: tree, isLoading } = useResultCenterTree(
    selectedCompanyId ?? undefined,
    includeInactive,
  );

  const createResultCenter = useCreateResultCenter();
  const updateResultCenter = useUpdateResultCenter();
  const moveResultCenter = useMoveResultCenter();
  const deleteResultCenter = useDeleteResultCenter();

  return (
    <TreePage<ResultCenter>
      title="Centros de resultado"
      description="De onde vem o resultado. Estrutura própria, completamente separada dos centros de custo — uma receita pode ser analisada por linha de negócio sem se confundir com onde o gasto ocorre."
      addLabel="+ Incluir novo centro de resultado"
      emptyMessage="Nenhum centro de resultado cadastrado. Comece incluindo as linhas de receita (Receitas BPO, Receitas Consultoria...)."
      entity="RESULT_CENTER"
      exportFileName="centros-de-resultado.csv"
      tree={tree}
      isLoading={isLoading}
      includeInactive={includeInactive}
      onIncludeInactiveChange={setIncludeInactive}
      permissions={{
        manage: "result_center.manage",
        manageTree: "result_center.move",
        delete: "result_center.delete",
      }}
      isSubmitting={createResultCenter.isPending || updateResultCenter.isPending}
      isMoving={moveResultCenter.isPending}
      onCreate={async (values, parent) => {
        if (!selectedCompanyId) return;
        await createResultCenter.mutateAsync({
          companyId: selectedCompanyId,
          name: values.name.trim(),
          code: values.code || undefined,
          description: values.description || undefined,
          notes: values.notes || undefined,
          parentResultCenterId: parent?.id,
        });
      }}
      onUpdate={async (id, values) => {
        await updateResultCenter.mutateAsync({
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
        moveResultCenter.mutateAsync({ id, payload: { parentId, reason } })
      }
      onDelete={(id) => deleteResultCenter.mutate(id)}
    />
  );
}
