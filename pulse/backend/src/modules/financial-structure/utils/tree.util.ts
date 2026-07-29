import { BadRequestException } from '@nestjs/common';

/** Forma mínima que qualquer nó de árvore da estrutura financeira precisa expor. */
export interface TreeNodeLike {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  code?: string | null;
}

export interface TreeNode<T> {
  node: T;
  children: TreeNode<T>[];
}

/**
 * Monta a árvore a partir de uma lista plana. Nós cujo pai não está na lista (por
 * exemplo, filtrados por status) são promovidos a raiz para nunca desaparecerem da tela.
 */
export function buildTree<T>(
  items: T[],
  getId: (item: T) => string,
  getParentId: (item: T) => string | null,
): TreeNode<T>[] {
  const wrapped = new Map<string, TreeNode<T>>();
  for (const item of items) {
    wrapped.set(getId(item), { node: item, children: [] });
  }

  const roots: TreeNode<T>[] = [];
  for (const item of items) {
    const parentId = getParentId(item);
    const parent = parentId ? wrapped.get(parentId) : undefined;
    const current = wrapped.get(getId(item));
    if (!current) continue;

    if (parent) {
      parent.children.push(current);
    } else {
      roots.push(current);
    }
  }

  return roots;
}

/**
 * Impede que um nó seja movido para baixo de si mesmo ou de um de seus descendentes,
 * o que criaria um ciclo e quebraria toda navegação da árvore.
 */
export function assertNoCycle(
  nodeId: string,
  newParentId: string | null,
  parentOf: Map<string, string | null>,
  message = 'Não é possível mover um item para dentro dele mesmo ou de um de seus descendentes.',
): void {
  if (!newParentId) return;

  if (newParentId === nodeId) {
    throw new BadRequestException(message);
  }

  const visited = new Set<string>([nodeId]);
  let cursor: string | null = newParentId;

  while (cursor) {
    if (visited.has(cursor)) {
      throw new BadRequestException(message);
    }
    visited.add(cursor);
    cursor = parentOf.get(cursor) ?? null;
  }
}

/** Calcula profundidade e caminho materializado ("Pai > Filho") de um nó. */
export function computeLevelAndPath(
  parentId: string | null,
  nodesById: Map<string, { name: string; parentId: string | null }>,
  ownName: string,
): { level: number; path: string } {
  const ancestors: string[] = [];
  let cursor = parentId;
  let guard = 0;

  while (cursor && guard < 100) {
    const parent = nodesById.get(cursor);
    if (!parent) break;
    ancestors.unshift(parent.name);
    cursor = parent.parentId;
    guard += 1;
  }

  return {
    level: ancestors.length,
    path: [...ancestors, ownName].join(' > '),
  };
}

/** Retorna o id do nó e de todos os seus descendentes. */
export function collectSubtreeIds(
  rootId: string,
  childrenOf: Map<string, string[]>,
): string[] {
  const result: string[] = [];
  const queue = [rootId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    result.push(current);
    queue.push(...(childrenOf.get(current) ?? []));
  }

  return result;
}
