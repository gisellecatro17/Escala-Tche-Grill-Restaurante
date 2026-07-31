import { BadRequestException } from '@nestjs/common';

import {
  assertNoCycle,
  buildTree,
  collectSubtreeIds,
  computeLevelAndPath,
} from './tree.util';

interface Node {
  id: string;
  name: string;
  parentId: string | null;
}

const NODES: Node[] = [
  { id: '1', name: 'Ativo', parentId: null },
  { id: '1.1', name: 'Ativo Circulante', parentId: '1' },
  { id: '1.1.01', name: 'Caixa', parentId: '1.1' },
  { id: '2', name: 'Passivo', parentId: null },
];

describe('tree.util', () => {
  describe('buildTree', () => {
    it('aninha os nós conforme a hierarquia', () => {
      const tree = buildTree(
        NODES,
        (n) => n.id,
        (n) => n.parentId,
      );

      expect(tree).toHaveLength(2);
      expect(tree[0].node.name).toBe('Ativo');
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children[0].children[0].node.name).toBe('Caixa');
    });

    it('promove a raiz nós cujo pai foi filtrado, para não sumirem da tela', () => {
      const withoutParent = NODES.filter((n) => n.id !== '1.1');

      const tree = buildTree(
        withoutParent,
        (n) => n.id,
        (n) => n.parentId,
      );

      // "Caixa" perdeu o pai "1.1" (inativo/filtrado) e deve aparecer como raiz.
      expect(tree.map((t) => t.node.id).sort()).toEqual(['1', '1.1.01', '2']);
    });
  });

  describe('assertNoCycle', () => {
    const parentOf = new Map<string, string | null>(
      NODES.map((n) => [n.id, n.parentId]),
    );

    it('permite mover para a raiz', () => {
      expect(() => assertNoCycle('1.1', null, parentOf)).not.toThrow();
    });

    it('permite mover para um nó que não é descendente', () => {
      expect(() => assertNoCycle('1.1', '2', parentOf)).not.toThrow();
    });

    it('impede mover um nó para dentro dele mesmo', () => {
      expect(() => assertNoCycle('1.1', '1.1', parentOf)).toThrow(
        BadRequestException,
      );
    });

    it('impede mover um nó para dentro de um descendente', () => {
      expect(() => assertNoCycle('1', '1.1.01', parentOf)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('computeLevelAndPath', () => {
    const nodesById = new Map(
      NODES.map((n) => [n.id, { name: n.name, parentId: n.parentId }]),
    );

    it('calcula profundidade e caminho materializado', () => {
      expect(computeLevelAndPath('1.1', nodesById, 'Caixa')).toEqual({
        level: 2,
        path: 'Ativo > Ativo Circulante > Caixa',
      });
    });

    it('trata nó raiz como nível 0', () => {
      expect(computeLevelAndPath(null, nodesById, 'Receitas')).toEqual({
        level: 0,
        path: 'Receitas',
      });
    });
  });

  describe('collectSubtreeIds', () => {
    it('retorna o nó e todos os descendentes', () => {
      const childrenOf = new Map<string, string[]>([
        ['1', ['1.1']],
        ['1.1', ['1.1.01']],
      ]);

      expect(collectSubtreeIds('1', childrenOf).sort()).toEqual([
        '1',
        '1.1',
        '1.1.01',
      ]);
    });
  });
});
