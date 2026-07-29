"use client";

import * as React from "react";
import { Loader2, Tag, Trash2 } from "lucide-react";

import {
  useCreateFinancialTag,
  useDeleteFinancialTag,
  useFinancialTags,
} from "@/lib/api/financial-structure";
import { ApiRequestError } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session-context";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export default function FinancialTagsPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;

  const [name, setName] = React.useState("");
  const [group, setGroup] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const { data: tags, isLoading } = useFinancialTags(
    organizationId,
    selectedCompanyId ?? undefined,
  );
  const createTag = useCreateFinancialTag();
  const deleteTag = useDeleteFinancialTag();

  const canManage = hasPermission("financial-tags.manage");
  const canDelete = hasPermission("financial-tags.delete");

  const grouped = React.useMemo(() => {
    const map = new Map<string, typeof tags>();
    for (const tag of tags ?? []) {
      const key = tag.group ?? "Sem agrupamento";
      map.set(key, [...(map.get(key) ?? []), tag]);
    }
    return [...map.entries()];
  }, [tags]);

  async function handleCreate() {
    if (!organizationId || !name.trim()) return;
    setError(null);
    try {
      await createTag.mutateAsync({
        organizationId,
        companyId: selectedCompanyId ?? undefined,
        name: name.trim(),
        group: group.trim() || undefined,
      });
      setName("");
    } catch (createError) {
      setError(
        createError instanceof ApiRequestError
          ? createError.message
          : "Não foi possível incluir a tag.",
      );
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tags financeiras</h1>
        <p className="text-sm text-muted-foreground">
          Marcadores livres aplicáveis a qualquer cadastro da estrutura financeira. Um mesmo
          registro pode receber várias tags, e elas servirão de filtro global em relatórios.
        </p>
      </div>

      {canManage && (
        <Card className="gap-3 p-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-48 flex-1 flex-col gap-1.5">
              <Label>Nome da tag</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Contrato 34"
              />
            </div>
            <div className="flex w-48 flex-col gap-1.5">
              <Label>Agrupamento (opcional)</Label>
              <Input
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                placeholder="Ex.: Contratos"
              />
            </div>
            <Button onClick={handleCreate} disabled={!name.trim() || createTag.isPending}>
              {createTag.isPending && <Loader2 className="animate-spin" />}+ Incluir nova tag
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <Card className="flex flex-col gap-2 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </Card>
      ) : grouped.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <Tag className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhuma tag cadastrada ainda.</p>
        </Card>
      ) : (
        grouped.map(([groupName, groupTags]) => (
          <Card key={groupName} className="gap-3 p-4">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {groupName}
            </p>
            <div className="flex flex-wrap gap-2">
              {(groupTags ?? []).map((tag) => (
                <div key={tag.id} className="flex items-center gap-1">
                  <Badge variant="outline" className="gap-1.5">
                    {tag.name}
                    <span className="text-[10px] text-muted-foreground">{tag.usageCount}</span>
                  </Badge>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      onClick={() => {
                        if (window.confirm(`Excluir a tag "${tag.name}"?`)) {
                          deleteTag.mutate(tag.id);
                        }
                      }}
                    >
                      <Trash2 className="size-3 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
