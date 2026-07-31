"use client";

import * as React from "react";
import { MoreHorizontal, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  flattenTree,
  type StructureTreeAction,
  type TreeItem,
} from "@/components/financial-structure/structure-tree";
import type { TreeNode } from "@/types/financial-structure";

export interface StructureTableColumn<T> {
  header: string;
  /** Largura opcional em classes utilitárias (ex.: "w-28"). */
  className?: string;
  render: (item: T) => React.ReactNode;
}

interface StructureTableProps<T extends TreeItem> {
  nodes: TreeNode<T>[];
  columns: StructureTableColumn<T>[];
  actions?: StructureTreeAction<T>[];
  emptyMessage?: string;
}

/**
 * Visão em tabela dos cadastros em árvore (seção 12), lado a lado com a visão em árvore.
 *
 * A hierarquia é preservada: a ordem vem do achatamento da árvore e a indentação do nome
 * mostra a profundidade — em uma tabela plana, o nível se perderia. Ao filtrar, os
 * ancestrais das linhas encontradas são mantidos para que o contexto não desapareça.
 */
export function StructureTable<T extends TreeItem>({
  nodes,
  columns,
  actions = [],
  emptyMessage = "Nenhum registro cadastrado ainda.",
}: StructureTableProps<T>) {
  const [search, setSearch] = React.useState("");

  const flat = React.useMemo(() => flattenTree(nodes), [nodes]);

  const rows = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return flat;

    const matches = (item: T) =>
      item.name.toLowerCase().includes(term) ||
      (item.code ?? "").toLowerCase().includes(term);

    // Mantém os ancestrais das linhas encontradas: sem eles, um "5.02.001" apareceria
    // solto, sem indicar a que grupo pertence.
    const keep = new Set<number>();
    for (let index = 0; index < flat.length; index += 1) {
      if (!matches(flat[index].item)) continue;
      keep.add(index);

      let depth = flat[index].depth;
      for (let above = index - 1; above >= 0 && depth > 0; above -= 1) {
        if (flat[above].depth < depth) {
          keep.add(above);
          depth = flat[above].depth;
        }
      }
    }

    return flat.filter((_, index) => keep.has(index));
  }, [flat, search]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Buscar por código ou nome"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código e nome</TableHead>
              {columns.map((column) => (
                <TableHead key={column.header} className={column.className}>
                  {column.header}
                </TableHead>
              ))}
              {actions.length > 0 && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (actions.length > 0 ? 2 : 1)}
                  className="text-center text-sm text-muted-foreground"
                >
                  {search ? "Nenhum registro encontrado." : emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              rows.map(({ item, depth }) => {
                const visibleActions = actions.filter(
                  (action) => !action.hidden?.(item),
                );

                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div
                        className="flex items-center gap-2"
                        style={{ paddingLeft: `${depth * 16}px` }}
                      >
                        {item.code && (
                          <span className="font-mono text-xs text-muted-foreground">
                            {item.code}
                          </span>
                        )}
                        <span
                          className={cn(
                            item.status === "INACTIVE" &&
                              "text-muted-foreground line-through",
                          )}
                        >
                          {item.name}
                        </span>
                        {item.isSystem && (
                          <Badge variant="secondary" className="text-[10px]">
                            Sistema
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    {columns.map((column) => (
                      <TableCell key={column.header} className={column.className}>
                        {column.render(item)}
                      </TableCell>
                    ))}

                    {actions.length > 0 && (
                      <TableCell>
                        {visibleActions.length > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-7"
                              >
                                <MoreHorizontal className="size-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              {visibleActions.map((action, index) => (
                                <React.Fragment key={action.label}>
                                  {action.destructive && index > 0 && (
                                    <DropdownMenuSeparator />
                                  )}
                                  <DropdownMenuItem
                                    variant={
                                      action.destructive ? "destructive" : "default"
                                    }
                                    onSelect={() => action.onSelect(item)}
                                  >
                                    {action.icon}
                                    {action.label}
                                  </DropdownMenuItem>
                                </React.Fragment>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        {rows.length} de {flat.length} registro(s). A indentação indica o nível na
        hierarquia.
      </p>
    </div>
  );
}
