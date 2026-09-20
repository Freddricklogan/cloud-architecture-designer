/**
 * Design model — a directed graph of catalog nodes.
 *
 * Every function here is pure: it takes a design and returns a new design (or
 * a value) and never mutates its input. That is what lets `main.js` keep an
 * undo stack for free and what lets every rule in `review.js` be unit-tested
 * against hand-built graphs.
 *
 * @typedef {{ id: string, type: string, name: string, x: number, y: number }} DesignNode
 * @typedef {{ from: string, to: string }} DesignEdge
 * @typedef {{ nodes: DesignNode[], edges: DesignEdge[] }} Design
 */

import { getEntry, isKnownType } from './catalog.js';

export const NODE_WIDTH = 92;
export const NODE_HEIGHT = 62;
export const MAX_NAME_LENGTH = 40;

/** @returns {Design} */
export function emptyDesign() {
  return { nodes: [], edges: [] };
}

/**
 * Deterministic id factory. The canvas passes a counter so ids stay unique
 * even when several nodes are created inside one millisecond (the original
 * demo used `Date.now()` and could collide).
 * @param {number} [start]
 */
export function createIdFactory(start = 1) {
  let next = start;
  return () => `n${next++}`;
}

/** Trim, collapse whitespace and cap the length of a user-visible name. */
export function sanitizeName(name, fallback = 'Untitled') {
  const clean = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
  return clean || fallback;
}

/**
 * @param {Design} design
 * @param {{ type: string, name?: string, x: number, y: number }} spec
 * @param {() => string} nextId
 * @returns {Design}
 */
export function addNode(design, spec, nextId) {
  const entry = getEntry(spec.type);
  if (!entry) throw new Error(`Unknown service type: ${spec.type}`);
  const node = {
    id: nextId(),
    type: entry.type,
    name: sanitizeName(spec.name, entry.name),
    x: Number.isFinite(spec.x) ? spec.x : 0,
    y: Number.isFinite(spec.y) ? spec.y : 0
  };
  return { nodes: [...design.nodes, node], edges: design.edges.slice() };
}

/** @param {Design} design @param {string} id */
export function removeNode(design, id) {
  return {
    nodes: design.nodes.filter((n) => n.id !== id),
    edges: design.edges.filter((e) => e.from !== id && e.to !== id)
  };
}

/** @param {Design} design @param {string} id @param {number} x @param {number} y */
export function moveNode(design, id, x, y) {
  return {
    nodes: design.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
    edges: design.edges
  };
}

/** @param {Design} design @param {string} id */
export function getNode(design, id) {
  return design.nodes.find((n) => n.id === id);
}

/**
 * Is there already an edge between a and b in either direction?
 * @param {Design} design
 */
export function hasEdge(design, a, b) {
  return design.edges.some(
    (e) => (e.from === a && e.to === b) || (e.from === b && e.to === a)
  );
}

/**
 * Connect `from` -> `to` (direction is the flow of traffic). Self-loops,
 * duplicates and references to missing nodes are ignored, not thrown: they
 * are the normal result of a stray click on a canvas.
 * @param {Design} design
 */
export function connect(design, from, to) {
  if (from === to) return design;
  if (!getNode(design, from) || !getNode(design, to)) return design;
  if (hasEdge(design, from, to)) return design;
  return { nodes: design.nodes, edges: [...design.edges, { from, to }] };
}

/** @param {Design} design */
export function disconnect(design, from, to) {
  return {
    nodes: design.nodes,
    edges: design.edges.filter(
      (e) => !((e.from === from && e.to === to) || (e.from === to && e.to === from))
    )
  };
}

/** Number of edges touching a node (either direction). */
export function degree(design, id) {
  return design.edges.filter((e) => e.from === id || e.to === id).length;
}

/** Ids of nodes reachable in one hop in either direction. */
export function neighbours(design, id) {
  const out = new Set();
  for (const e of design.edges) {
    if (e.from === id) out.add(e.to);
    else if (e.to === id) out.add(e.from);
  }
  return [...out];
}

/** Ids of nodes this node sends traffic to (`from` -> `to`). */
export function downstream(design, id) {
  return design.edges.filter((e) => e.from === id).map((e) => e.to);
}

/** Ids of nodes that send traffic to this node. */
export function upstream(design, id) {
  return design.edges.filter((e) => e.to === id).map((e) => e.from);
}

/** All nodes of one catalog type. */
export function nodesOfType(design, type) {
  return design.nodes.filter((n) => n.type === type);
}

/** All nodes whose type is in a set. */
export function nodesIn(design, typeSet) {
  return design.nodes.filter((n) => typeSet.has(n.type));
}

/** Distinct catalog types present. */
export function typeSet(design) {
  return new Set(design.nodes.map((n) => n.type));
}

/** Distinct categories present. */
export function categorySet(design) {
  const cats = new Set();
  for (const n of design.nodes) {
    const entry = getEntry(n.type);
    if (entry) cats.add(entry.category);
  }
  return cats;
}

/**
 * Is `target` reachable from `source` following edge direction?
 * Breadth-first; safe on cycles.
 */
export function reaches(design, source, target) {
  if (source === target) return true;
  const seen = new Set([source]);
  const queue = [source];
  while (queue.length) {
    const cur = queue.shift();
    for (const next of downstream(design, cur)) {
      if (next === target) return true;
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}

/** Nodes with no edges at all (only meaningful once there are 2+ nodes). */
export function orphans(design) {
  if (design.nodes.length < 2) return [];
  return design.nodes.filter((n) => degree(design, n.id) === 0);
}

/**
 * Hit-test a point against node boxes, topmost (last drawn) first.
 * @param {Design} design
 */
export function hitTest(design, x, y) {
  for (let i = design.nodes.length - 1; i >= 0; i -= 1) {
    const n = design.nodes[i];
    if (
      x >= n.x - NODE_WIDTH / 2 && x <= n.x + NODE_WIDTH / 2 &&
      y >= n.y - NODE_HEIGHT / 2 && y <= n.y + NODE_HEIGHT / 2
    ) {
      return n;
    }
  }
  return null;
}

/** Keep a node fully inside a width x height canvas. */
export function clampPosition(x, y, width, height) {
  const hw = NODE_WIDTH / 2;
  const hh = NODE_HEIGHT / 2;
  return {
    x: Math.min(Math.max(x, hw), Math.max(hw, width - hw)),
    y: Math.min(Math.max(y, hh), Math.max(hh, height - hh))
  };
}

/* ------------------------------------------------------------ serialisation */

export const SCHEMA_VERSION = 1;

/** Plain-JSON form of a design. */
export function serializeDesign(design) {
  return {
    schema: 'cloud-architecture-designer',
    version: SCHEMA_VERSION,
    nodes: design.nodes.map((n) => ({ id: n.id, type: n.type, name: n.name, x: n.x, y: n.y })),
    edges: design.edges.map((e) => ({ from: e.from, to: e.to }))
  };
}

/**
 * Parse untrusted JSON into a design. Unknown types, malformed nodes, dangling
 * or duplicate edges are dropped and reported rather than thrown, so a partly
 * broken file still loads what it can.
 * @param {unknown} input  a JSON string or an already-parsed object
 * @returns {{ design: Design, warnings: string[] }}
 */
export function parseDesign(input) {
  const warnings = [];
  let raw = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch {
      return { design: emptyDesign(), warnings: ['File is not valid JSON.'] };
    }
  }
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.nodes)) {
    return { design: emptyDesign(), warnings: ['File does not contain a "nodes" array.'] };
  }
  if (raw.version !== undefined && raw.version !== SCHEMA_VERSION) {
    warnings.push(`Schema version ${raw.version} differs from ${SCHEMA_VERSION}; loading best-effort.`);
  }

  const nodes = [];
  const ids = new Set();
  for (const n of raw.nodes) {
    if (!n || typeof n !== 'object') { warnings.push('Skipped a node that was not an object.'); continue; }
    if (!isKnownType(n.type)) { warnings.push(`Skipped node with unknown type "${String(n.type)}".`); continue; }
    const id = String(n.id ?? '');
    if (!id || ids.has(id)) { warnings.push(`Skipped node with missing or duplicate id "${id}".`); continue; }
    ids.add(id);
    nodes.push({
      id,
      type: n.type,
      name: sanitizeName(n.name, getEntry(n.type).name),
      x: Number.isFinite(n.x) ? n.x : 0,
      y: Number.isFinite(n.y) ? n.y : 0
    });
  }

  let design = { nodes, edges: [] };
  const rawEdges = Array.isArray(raw.edges) ? raw.edges : [];
  for (const e of rawEdges) {
    if (!e || typeof e !== 'object') continue;
    const from = String(e.from ?? '');
    const to = String(e.to ?? '');
    if (!ids.has(from) || !ids.has(to)) { warnings.push(`Dropped edge ${from} -> ${to}: endpoint missing.`); continue; }
    const before = design.edges.length;
    design = connect(design, from, to);
    if (design.edges.length === before) warnings.push(`Dropped edge ${from} -> ${to}: duplicate or self-loop.`);
  }
  return { design, warnings };
}
