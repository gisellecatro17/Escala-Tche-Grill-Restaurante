"use client";

import * as React from "react";

import {
  useCategoryTree,
  useCreateCategory,
  useDeleteCategory,
  useMoveCategory,
  useUpdateCategory,
} from "@/lib/api/taxonomy";
import { useSession } from "@/lib/auth/session-context";
import { TreePage } from "@/components/financial-structure/tree-page";
import type { CategoryNode } from "@/types/financial-structure";

export default function CategoriesPage() {
  const { selectedCompanyId } = useSession();
  const [includeInactive, setIncludeInactive] = React.useState(false);

  const { data: tree, isLoading } = useCategoryTree(
    selectedCompanyId ?? undefined,
    includeInactive,
  );

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const moveCategory = useMoveCategory();
  const deleteCategory = useDeleteCategory();

  return (
    <TreePage<CategoryNode>
      title="Categorias financeiras"
      description="Categorias e subcategorias em árvore, sem limite de profundidade. Cada categoria pode carregar dimensões e regras padrão herdadas pelos lançamentos."
      addLabel="+ Incluir nova categoria"
      emptyMessage="Nenhuma categoria cadastrada. Comece incluindo as categorias principais (Energia, Folha, Impostos...)."
      entity="CATEGORY"
      exportFileName="categorias-financeiras.csv"
      tree={tree}
      isLoading={isLoading}
      includeInactive={includeInactive}
      onIncludeInactiveChange={setIncludeInactive}
      permissions={{
        manage: "categories.manage",
        manageTree: "categories.manage_tree",
        delete: "categories.delete",
      }}
      isSubmitting={createCategory.isPending || updateCategory.isPending}
      isMoving={moveCategory.isPending}
      onCreate={async (values, parent) => {
        if (!selectedCompanyId) return;
        await createCategory.mutateAsync({
          companyId: selectedCompanyId,
          name: values.name.trim(),
          code: values.code || undefined,
          description: values.description || undefined,
          notes: values.notes || undefined,
          parentCategoryId: parent?.id,
        });
      }}
      onUpdate={async (id, values) => {
        await updateCategory.mutateAsync({
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
        moveCategory.mutateAsync({ id, payload: { parentId, reason } })
      }
      onDelete={(id) => deleteCategory.mutate(id)}
    />
  );
}
