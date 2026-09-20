/**
 * Canvas renderer. Reads a design and draws it; never mutates state. Uses the
 * shell's dark tokens so the canvas matches the page, and scales for the
 * device pixel ratio so nodes are crisp on high-density displays (the
 * original demo drew at 1× and looked blurred on Retina).
 */

import { getEntry } from './catalog.js';
import { NODE_HEIGHT, NODE_WIDTH } from './graph.js';

export const CATEGORY_COLOURS = {
  compute: '#d29922',
  storage: '#3fb950',
  database: '#58a6ff',
  networking: '#d2a8ff',
  security: '#f85149',
  integration: '#39c5cf',
  operations: '#8b98b0'
};

const TOKENS = {
  grid: 'rgba(139, 152, 176, 0.08)',
  edge: 'rgba(139, 152, 176, 0.55)',
  edgeArrow: 'rgba(139, 152, 176, 0.9)',
  nodeFill: '#16223a',
  nodeSelected: '#1f2a44',
  nodeBorder: '#22304d',
  label: '#e6edf3',
  muted: '#8b98b0',
  hint: 'rgba(139, 152, 176, 0.7)',
  pending: '#58a6ff'
};

/**
 * Resize the backing store to the CSS size × devicePixelRatio.
 * @returns {{ width: number, height: number }} CSS-pixel size
 */
export function fitCanvas(canvas) {
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
    canvas.width = width * dpr;
    canvas.height = height * dpr;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width, height };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Trim the edge so it starts and ends at the node border rather than the
 * centre, so the arrowhead is visible.
 */
function edgeEndpoints(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  // Intersection of the ray with the axis-aligned box (approximate by scaling).
  const tA = Math.min(NODE_WIDTH / 2 / Math.abs(ux || 1e-9), NODE_HEIGHT / 2 / Math.abs(uy || 1e-9));
  const tB = tA;
  return {
    x1: a.x + ux * tA,
    y1: a.y + uy * tA,
    x2: b.x - ux * tB,
    y2: b.y - uy * tB
  };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {import('./graph.js').Design} design
 * @param {{ selectedId?: string|null, connectFromId?: string|null, width: number, height: number }} view
 */
export function drawDesign(canvas, design, view) {
  const ctx = canvas.getContext('2d');
  const { width, height } = view;
  ctx.clearRect(0, 0, width, height);

  // Grid
  ctx.strokeStyle = TOKENS.grid;
  ctx.lineWidth = 1;
  for (let x = 0.5; x < width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
  for (let y = 0.5; y < height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }

  const byId = new Map(design.nodes.map((n) => [n.id, n]));

  // Edges
  for (const e of design.edges) {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a || !b) continue;
    const { x1, y1, x2, y2 } = edgeEndpoints(a, b);
    ctx.beginPath();
    ctx.strokeStyle = TOKENS.edge;
    ctx.lineWidth = 1.5;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - 9 * Math.cos(angle - Math.PI / 7), y2 - 9 * Math.sin(angle - Math.PI / 7));
    ctx.lineTo(x2 - 9 * Math.cos(angle + Math.PI / 7), y2 - 9 * Math.sin(angle + Math.PI / 7));
    ctx.closePath();
    ctx.fillStyle = TOKENS.edgeArrow;
    ctx.fill();
  }

  // Nodes
  for (const n of design.nodes) {
    const entry = getEntry(n.type);
    const colour = CATEGORY_COLOURS[entry?.category] ?? TOKENS.muted;
    const selected = n.id === view.selectedId;
    const pending = n.id === view.connectFromId;
    const x = n.x - NODE_WIDTH / 2;
    const y = n.y - NODE_HEIGHT / 2;

    ctx.fillStyle = selected ? TOKENS.nodeSelected : TOKENS.nodeFill;
    ctx.strokeStyle = pending ? TOKENS.pending : selected ? colour : TOKENS.nodeBorder;
    ctx.lineWidth = selected || pending ? 2 : 1;
    if (pending) ctx.setLineDash([5, 3]);
    roundRect(ctx, x, y, NODE_WIDTH, NODE_HEIGHT, 8);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    // Category stripe
    ctx.fillStyle = colour;
    ctx.fillRect(x, y + 8, 3, NODE_HEIGHT - 16);

    ctx.fillStyle = colour;
    ctx.font = '700 13px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(entry?.abbr ?? n.type.toUpperCase(), n.x, n.y - 9);

    ctx.fillStyle = TOKENS.label;
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.fillText(truncate(ctx, n.name, NODE_WIDTH - 14), n.x, n.y + 12);
  }

  if (!design.nodes.length) {
    ctx.fillStyle = TOKENS.hint;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 15px Inter, system-ui, sans-serif';
    ctx.fillText('Drag a service from the palette, or load a reference architecture', width / 2, height / 2 - 12);
    ctx.font = '12px Inter, system-ui, sans-serif';
    ctx.fillStyle = TOKENS.muted;
    ctx.fillText('Shift-click two nodes to connect them (traffic flows first → second) · Delete removes the selection', width / 2, height / 2 + 12);
  }
}

function truncate(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}
