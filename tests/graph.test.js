import { describe, it, expect } from 'vitest';
import {
  addNode, categorySet, clampPosition, connect, createIdFactory, degree, disconnect,
  downstream, emptyDesign, getNode, hasEdge, hitTest, moveNode, neighbours, NODE_HEIGHT,
  NODE_WIDTH, nodesIn, nodesOfType, orphans, parseDesign, reaches, removeNode,
  sanitizeName, serializeDesign, typeSet, upstream, MAX_NAME_LENGTH
} from '../src/graph.js';

function build() {
  const nextId = createIdFactory();
  let d = emptyDesign();
  d = addNode(d, { type: 'alb', name: 'ALB', x: 100, y: 100 }, nextId);
  d = addNode(d, { type: 'ec2', name: 'Web', x: 200, y: 200 }, nextId);
  d = addNode(d, { type: 'rds', name: 'DB', x: 300, y: 300 }, nextId);
  d = connect(d, 'n1', 'n2');
  d = connect(d, 'n2', 'n3');
  return d;
}

describe('graph — nodes', () => {
  it('starts empty', () => {
    expect(emptyDesign()).toEqual({ nodes: [], edges: [] });
  });

  it('ids are unique and sequential even within one millisecond', () => {
    const nextId = createIdFactory(7);
    expect([nextId(), nextId(), nextId()]).toEqual(['n7', 'n8', 'n9']);
  });

  it('adds a node from the catalog and does not mutate the input', () => {
    const before = emptyDesign();
    const after = addNode(before, { type: 's3', x: 1, y: 2 }, createIdFactory());
    expect(before.nodes).toHaveLength(0);
    expect(after.nodes).toEqual([{ id: 'n1', type: 's3', name: 'S3 Bucket', x: 1, y: 2 }]);
  });

  it('rejects unknown types', () => {
    expect(() => addNode(emptyDesign(), { type: 'mainframe', x: 0, y: 0 }, createIdFactory())).toThrow(/Unknown service type/);
  });

  it('coerces non-finite coordinates to zero', () => {
    const d = addNode(emptyDesign(), { type: 's3', x: NaN, y: Infinity }, createIdFactory());
    expect(d.nodes[0]).toMatchObject({ x: 0, y: 0 });
  });

  it('removes a node and every edge touching it', () => {
    const d = removeNode(build(), 'n2');
    expect(d.nodes.map((n) => n.id)).toEqual(['n1', 'n3']);
    expect(d.edges).toEqual([]);
  });

  it('moves a node immutably', () => {
    const d = build();
    const moved = moveNode(d, 'n1', 5, 6);
    expect(getNode(moved, 'n1')).toMatchObject({ x: 5, y: 6 });
    expect(getNode(d, 'n1')).toMatchObject({ x: 100, y: 100 });
  });
});

describe('graph — names', () => {
  it('trims, collapses whitespace and caps length', () => {
    expect(sanitizeName('  EC2   (Web) ')).toBe('EC2 (Web)');
    expect(sanitizeName('x'.repeat(100))).toHaveLength(MAX_NAME_LENGTH);
  });
  it('falls back when empty', () => {
    expect(sanitizeName('   ', 'Fallback')).toBe('Fallback');
    expect(sanitizeName(null)).toBe('Untitled');
  });
});

describe('graph — edges', () => {
  it('connects directed edges once, ignoring duplicates in either direction', () => {
    let d = build();
    expect(d.edges).toHaveLength(2);
    d = connect(d, 'n2', 'n1');
    expect(d.edges).toHaveLength(2);
    expect(hasEdge(d, 'n2', 'n1')).toBe(true);
  });

  it('ignores self-loops and missing endpoints', () => {
    const d = build();
    expect(connect(d, 'n1', 'n1')).toBe(d);
    expect(connect(d, 'n1', 'zzz')).toBe(d);
  });

  it('disconnects regardless of direction', () => {
    const d = disconnect(build(), 'n2', 'n1');
    expect(d.edges).toEqual([{ from: 'n2', to: 'n3' }]);
  });

  it('reports degree, neighbours, upstream and downstream', () => {
    const d = build();
    expect(degree(d, 'n2')).toBe(2);
    expect(neighbours(d, 'n2').sort()).toEqual(['n1', 'n3']);
    expect(upstream(d, 'n2')).toEqual(['n1']);
    expect(downstream(d, 'n2')).toEqual(['n3']);
  });

  it('reachability follows edge direction and survives cycles', () => {
    let d = build();
    expect(reaches(d, 'n1', 'n3')).toBe(true);
    expect(reaches(d, 'n3', 'n1')).toBe(false);
    expect(reaches(d, 'n1', 'n1')).toBe(true);
    d = connect(d, 'n3', 'n1');
    expect(reaches(d, 'n3', 'n2')).toBe(true);
  });

  it('finds orphans only once there are two or more nodes', () => {
    let d = addNode(emptyDesign(), { type: 's3', x: 0, y: 0 }, createIdFactory());
    expect(orphans(d)).toEqual([]);
    d = addNode(d, { type: 'kms', x: 0, y: 0 }, createIdFactory(2));
    expect(orphans(d).map((n) => n.id)).toEqual(['n1', 'n2']);
  });
});

describe('graph — queries', () => {
  it('filters by type, set and category', () => {
    const d = build();
    expect(nodesOfType(d, 'ec2')).toHaveLength(1);
    expect(nodesIn(d, new Set(['alb', 'rds']))).toHaveLength(2);
    expect([...typeSet(d)].sort()).toEqual(['alb', 'ec2', 'rds']);
    expect([...categorySet(d)].sort()).toEqual(['compute', 'database', 'networking']);
  });
});

describe('graph — geometry', () => {
  it('hit-tests the topmost node under a point', () => {
    let d = build();
    d = moveNode(d, 'n3', 200, 200); // overlaps n2
    expect(hitTest(d, 200, 200).id).toBe('n3');
    expect(hitTest(d, 200 + NODE_WIDTH / 2, 200)).not.toBeNull();
    expect(hitTest(d, 200 + NODE_WIDTH / 2 + 1, 200)).toBeNull();
    expect(hitTest(d, 900, 900)).toBeNull();
  });

  it('clamps positions inside the canvas', () => {
    expect(clampPosition(-50, -50, 800, 600)).toEqual({ x: NODE_WIDTH / 2, y: NODE_HEIGHT / 2 });
    expect(clampPosition(5000, 5000, 800, 600)).toEqual({ x: 800 - NODE_WIDTH / 2, y: 600 - NODE_HEIGHT / 2 });
    expect(clampPosition(400, 300, 800, 600)).toEqual({ x: 400, y: 300 });
  });
});

describe('graph — serialisation', () => {
  it('round-trips through JSON', () => {
    const d = build();
    const { design, warnings } = parseDesign(JSON.stringify(serializeDesign(d)));
    expect(warnings).toEqual([]);
    expect(design).toEqual(d);
  });

  it('rejects non-JSON and non-designs without throwing', () => {
    expect(parseDesign('{not json').warnings[0]).toMatch(/not valid JSON/);
    expect(parseDesign({ hello: 1 }).warnings[0]).toMatch(/nodes/);
    expect(parseDesign('null').design.nodes).toEqual([]);
  });

  it('drops unknown types, duplicate ids, dangling and duplicate edges with warnings', () => {
    const { design, warnings } = parseDesign({
      version: 1,
      nodes: [
        { id: 'a', type: 's3', name: 'Bucket', x: 1, y: 1 },
        { id: 'a', type: 'kms', name: 'Dup', x: 1, y: 1 },
        { id: 'b', type: 'quantum', name: 'Nope', x: 1, y: 1 },
        { id: 'c', type: 'kms', name: '<script>alert(1)</script>', x: 'x', y: 2 },
        'garbage',
        { type: 'rds', name: 'no id', x: 0, y: 0 }
      ],
      edges: [{ from: 'c', to: 'a' }, { from: 'a', to: 'c' }, { from: 'a', to: 'zzz' }, { from: 'a', to: 'a' }, null]
    });
    expect(design.nodes.map((n) => n.id)).toEqual(['a', 'c']);
    expect(design.nodes[1].x).toBe(0);
    // Name is stored verbatim (rendered via textContent), only trimmed/capped.
    expect(design.nodes[1].name).toBe('<script>alert(1)</script>');
    expect(design.edges).toEqual([{ from: 'c', to: 'a' }]);
    expect(warnings.length).toBe(7);
  });

  it('warns on a schema version mismatch but still loads', () => {
    const { design, warnings } = parseDesign({ version: 99, nodes: [{ id: 'a', type: 's3', x: 0, y: 0 }] });
    expect(design.nodes).toHaveLength(1);
    expect(warnings[0]).toMatch(/Schema version 99/);
  });
});
