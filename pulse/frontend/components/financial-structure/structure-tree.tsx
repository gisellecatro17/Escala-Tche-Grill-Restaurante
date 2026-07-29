"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, MoreHorizontal, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { TreeNode } from "@/types/financial-structure";

/** Dados mínimos que a árvore precisa para renderizar qualquer cadastro estrutural. */
export interface TreeItem {
  id: string;
  code?: string | null;
  name: string;
  status?: string;
  isSystem?: boolean;
  acceptsEntries?: boolean;
}

export interface StructureTreeAction<T> {
  label: string;
  icon?: React.ReactNode;
  onSelect: (item: T) => void;
  destructive?: boolean;
  /** Oculta a ação para itens específicos (ex.: registros de sistema). */
  hidden?: (item: T) => boolean;
}

interface StructureTreeProps<T extends TreeItem> {
  nodes: TreeNode<T>[];
  actions?: StructureTreeAction<T>[];
  onAddChild?: (parent: T) => void;
  /** Marca visualmente o item selecionado. */
  selectedId?: string;
  onSelect?: (item: T) => void;
  emptyMessage?: string;
  /** Rótulo adicional à direita do nome (ex.: tipo da conta). */
  renderMeta?: (item: T) => React.ReactNode;
}

/**
 * Árvore expansível/recolhível reutilizada por plano de contas, categorias, centros de
 * custo, centros de resultado e unidades de negócio. Todos os nós começam expandidos.
 */
export function StructureTree<T extends TreeItem>({
  nodes,
  actions = [],
  onAddChild,
  selectedId,
  onSelect,
  emptyMessage = "Nenhum registro cadastrado ainda.",
  renderMeta,
}: StructureTreeProps<T>) {
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());

  function toggle(id: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (nodes.length === 0) {
    return <p className="p-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <ul className="flex flex-col">
      {nodes.map((node) => (
        <TreeRow
          key={node.node.id}
          node={node}
          depth={0}
          collapsed={collapsed}
          onToggle={toggle}
          actions={actions}
          onAddChild={onAddChild}
          selectedId={selectedId}
          onSelect={onSelect}
          renderMeta={renderMeta}
        />
      ))}
    </ul>
  );
}

interface TreeRowProps<T extends TreeItem> {
  node: TreeNode<T>;
  depth: number;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  actions: StructureTreeAction<T>[];
  onAddChild?: (parent: T) => void;
  selectedId?: string;
  onSelect?: (item: T) => void;
  renderMeta?: (item: T) => React.ReactNode;
}

function TreeRow<T extends TreeItem>({
  node,
  depth,
  collapsed,
  onToggle,
  actions,
  onAddChild,
  selectedId,
  onSelect,
  renderMeta,
}: TreeRowProps<T>) {
  const item = node.node;
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsed.has(item.id);
  const visibleActions = actions.filter((action) => !action.hidden?.(item));

  return (
    <li>
      <div
        className={cn(
          "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60",
          selectedId === item.id && "bg-muted",
        )}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(item.id)}
            className="text-muted-foreground hover:text-foreground"
            aria-label={isCollapsed ? "Expandir" : "Recolher"}
          >
            {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        ) : (
          <span className="size-4" />
        )}

        <button
          type="button"
          onClick={() => onSelect?.(item)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          {item.code && (
            <span className="font-mono text-xs text-muted-foreground">{item.code}</span>
          )}
          <span className={cn(item.status === "INACTIVE" && "text-muted-foreground line-through")}>
            {item.name}
          </span>
          {renderMeta?.(item)}
          {item.acceptsEntries === false && (
            <Badge variant="outline" className="text-[10px]">
              Sintética
            </Badge>
          )}
          {item.isSystem && (
            <Badge variant="secondary" className="text-[10px]">
              Sistema
            </Badge>
          )}
        </button>

        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {onAddChild && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => onAddChild(item)}
              aria-label="Incluir item filho"
            >
              <Plus className="size-3.5" />
            </Button>
          )}
          {visibleActions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="size-7">
                  <MoreHorizontal className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {visibleActions.map((action, index) => (
                  <React.Fragment key={action.label}>
                    {action.destructive && index > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      variant={action.destructive ? "destructive" : "default"}
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
        </div>
      </div>

      {hasChildren && !isCollapsed && (
        <ul className="flex flex-col">
          {node.children.map((child) => (
            <TreeRow
              key={child.node.id}
              node={child}
              depth={depth + 1}
              collapsed={collapsed}
              onToggle={onToggle}
              actions={actions}
              onAddChild={onAddChild}
              selectedId={selectedId}
              onSelect={onSelect}
              renderMeta={renderMeta}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Achata a árvore em uma lista com indentação, para usar em selects de "conta pai". */
export function flattenTree<T extends TreeItem>(
  nodes: TreeNode<T>[],
  depth = 0,
): { item: T; depth: number }[] {
  return nodes.flatMap((node) => [
    { item: node.node, depth },
    ...flattenTree(node.children, depth + 1),
  ]);
}
