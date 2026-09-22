/**
 * Application entry point: owns the design state and the undo stack, wires
 * pointer and keyboard events, and drives rendering. Every computation lives
 * in the pure modules; this file only orchestrates.
 */

import { mountExecShell } from './exec-shell.js';
import { getEntry } from './catalog.js';
import {
  addNode, clampPosition, connect, createIdFactory, emptyDesign, getNode, hitTest,
  moveNode, parseDesign, removeNode, serializeDesign
} from './graph.js';
import { TEMPLATES, getTemplate, instantiateTemplate } from './templates.js';
import { estimateCost, formatUsd } from './cost.js';
import { reviewDesign, serviceTypes } from './review.js';
import { toCloudFormation, toReviewMarkdown, toTerraform } from './export.js';
import { drawDesign, fitCanvas } from './render.js';
import {
  renderCost, renderExport, renderInventory, renderPalette, renderReview, renderSelected
} from './ui.js';

const REPO = 'https://github.com/Freddricklogan/cloud-architecture-designer';
const PAGES = 'https://freddricklogan.github.io/cloud-architecture-designer/';
const UNDO_LIMIT = 50;

const $ = (id) => document.getElementById(id);

const nextId = createIdFactory();

const state = {
  design: emptyDesign(),
  undo: [],
  selectedId: null,
  connectFromId: null,
  dragging: null, // { id, dx, dy }
  size: { width: 800, height: 600 },
  review: reviewDesign(emptyDesign()),
  cost: estimateCost(emptyDesign())
};

const dom = {
  canvas: $('canvas'),
  status: $('canvas-status'),
  template: $('template-select'),
  palette: $('palette'),
  compCount: $('comp-count'),
  connCount: $('conn-count'),
  catCount: $('cat-count'),
  costTotal: $('cost-total'),
  costBreakdown: $('cost-breakdown'),
  reviewScore: $('review-score'),
  reviewPillars: $('review-pillars'),
  reviewList: $('review-list'),
  selected: $('selected-info'),
  inventory: $('inventory'),
  dialog: $('export-dialog'),
  importInput: $('import-json')
};

/* ------------------------------------------------------------------ state */

function commit(nextDesign, { record = true } = {}) {
  if (record) {
    state.undo.push(state.design);
    if (state.undo.length > UNDO_LIMIT) state.undo.shift();
  }
  state.design = nextDesign;
  if (state.selectedId && !getNode(nextDesign, state.selectedId)) state.selectedId = null;
  if (state.connectFromId && !getNode(nextDesign, state.connectFromId)) state.connectFromId = null;
  recompute();
  render();
}

function recompute() {
  state.review = reviewDesign(state.design);
  state.cost = estimateCost(state.design);
}

function setStatus(text) {
  dom.status.textContent = text;
}

/* ----------------------------------------------------------------- render */

function render() {
  drawDesign(dom.canvas, state.design, {
    selectedId: state.selectedId,
    connectFromId: state.connectFromId,
    ...state.size
  });
  dom.compCount.textContent = String(state.design.nodes.length);
  dom.connCount.textContent = String(state.design.edges.length);
  dom.catCount.textContent = String(new Set(state.design.nodes.map((n) => getEntry(n.type).category)).size);
  dom.costTotal.textContent = formatUsd(state.cost.total);
  renderCost(dom.costBreakdown, state.cost);
  renderReview(dom.reviewScore, dom.reviewPillars, dom.reviewList, state.review);
  renderSelected(dom.selected, state.design, state.selectedId ? getNode(state.design, state.selectedId) : null, {
    onRemove: removeSelected,
    onConnect: beginConnect
  });
  renderInventory(dom.inventory, state.design, state.selectedId, { onSelect: select });
  $('btn-undo').disabled = state.undo.length === 0;
  shell.refreshKpis();
}

/* ---------------------------------------------------------------- actions */

function select(id) {
  state.selectedId = id;
  if (state.connectFromId && state.connectFromId !== id) {
    finishConnect(id);
    return;
  }
  render();
}

function beginConnect(id) {
  state.connectFromId = id;
  const n = getNode(state.design, id);
  setStatus(`Connecting from ${n?.name ?? id} — shift-click or choose the target (Esc cancels).`);
  render();
}

function finishConnect(targetId) {
  const from = state.connectFromId;
  state.connectFromId = null;
  const before = state.design.edges.length;
  const next = connect(state.design, from, targetId);
  if (next.edges.length === before) {
    setStatus('Those two are already connected.');
    render();
    return;
  }
  setStatus(`Connected ${getNode(next, from).name} → ${getNode(next, targetId).name}.`);
  commit(next);
}

function cancelConnect() {
  if (!state.connectFromId) return;
  state.connectFromId = null;
  setStatus('Connection cancelled.');
  render();
}

function addAt(type, x, y) {
  const pos = clampPosition(x, y, state.size.width, state.size.height);
  const next = addNode(state.design, { type, x: pos.x, y: pos.y }, nextId);
  state.selectedId = next.nodes[next.nodes.length - 1].id;
  setStatus(`Added ${getEntry(type).name}.`);
  commit(next);
}

function addFromPalette(type) {
  // Keyboard path: place near the centre with a small deterministic offset so
  // successive additions do not stack exactly.
  const i = state.design.nodes.length;
  addAt(type, state.size.width / 2 + ((i % 5) - 2) * 40, state.size.height / 2 + (Math.floor(i / 5) % 5 - 2) * 40);
}

function removeSelected(id = state.selectedId) {
  if (!id) return;
  const name = getNode(state.design, id)?.name;
  const next = removeNode(state.design, id);
  state.selectedId = null;
  setStatus(`Removed ${name}.`);
  commit(next);
}

function loadTemplate(id) {
  const t = getTemplate(id);
  if (!t) return;
  const next = instantiateTemplate(t, state.size.width / 2, state.size.height / 2, nextId);
  state.selectedId = null;
  state.connectFromId = null;
  setStatus(`Loaded ${t.name}: ${t.summary}`);
  commit(next);
}

function clearAll() {
  if (!state.design.nodes.length) return;
  state.selectedId = null;
  state.connectFromId = null;
  setStatus('Canvas cleared. Undo restores it.');
  commit(emptyDesign());
}

function undo() {
  const prev = state.undo.pop();
  if (!prev) return;
  state.selectedId = null;
  state.connectFromId = null;
  setStatus('Undone.');
  commit(prev, { record: false });
}

/* ---------------------------------------------------------------- exports */

function openExport(title, filename, body) {
  renderExport(dom.dialog, { title, filename, body });
  if (typeof dom.dialog.showModal === 'function') dom.dialog.showModal();
  else dom.dialog.setAttribute('open', '');
}

function download(filename, body, type = 'text/plain') {
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportPng() {
  render();
  const url = dom.canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cloud-architecture.png';
  document.body.append(a);
  a.click();
  a.remove();
}

function importJson(file) {
  if (!file) return;
  file.text().then((text) => {
    const { design, warnings } = parseDesign(text);
    if (!design.nodes.length) {
      setStatus(`Import failed: ${warnings[0] ?? 'no nodes found.'}`);
      return;
    }
    // Re-clamp into the current canvas so a design saved on a larger screen stays reachable.
    let next = design;
    for (const n of design.nodes) {
      const pos = clampPosition(n.x, n.y, state.size.width, state.size.height);
      next = moveNode(next, n.id, pos.x, pos.y);
    }
    state.selectedId = null;
    setStatus(
      warnings.length
        ? `Imported ${design.nodes.length} components with ${warnings.length} warning${warnings.length === 1 ? '' : 's'}: ${warnings[0]}`
        : `Imported ${design.nodes.length} components and ${design.edges.length} connections.`
    );
    commit(next);
  }).catch(() => setStatus('Import failed: could not read the file.'));
}

/* ------------------------------------------------------------------ shell */

const shell = mountExecShell({
  theme: 'graphite',
  title: 'Cloud Architecture Designer',
  tagline:
    'Sketch an AWS architecture, review it against six Well-Architected pillars with topology-aware rules, and export a Terraform or CloudFormation skeleton — entirely in the browser.',
  repo: REPO,
  pagesUrl: PAGES,
  badges: [
    { label: '15 graph-aware rules', tone: 'accent' },
    { label: 'Terraform + CloudFormation export', dot: true },
    { label: 'Client-side only', dot: true }
  ],
  kpis: [
    { label: 'Components', compute: () => state.design.nodes.length, tone: 'accent' },
    { label: 'Connections', compute: () => state.design.edges.length },
    { label: 'Service types', compute: () => serviceTypes(state.design).size },
    { label: 'Well-Architected score', compute: () => (state.review.score === null ? '—' : `${state.review.score}`), tone: 'ok' },
    { label: 'Failing checks', compute: () => state.review.counts.fail, tone: 'danger' }
  ],
  tour: [
    {
      selector: '#template-select',
      title: 'Load a reference architecture',
      body: 'Five templates ship with explicit, directed connections. This loads the three-tier web application: DNS → CDN → load balancer → two auto-scaled tiers → cache and database.',
      action: () => { dom.template.value = 'three-tier'; loadTemplate('three-tier'); dom.template.value = ''; }
    },
    {
      selector: '#review-panel',
      title: 'Read the review',
      body: 'Fifteen rules across six pillars, scored only over the checks that apply. Each note names the specific component it is talking about.',
      action: () => {}
    },
    {
      selector: '#inventory',
      title: 'Break it on purpose',
      body: 'This removes the WAF. Watch SEC-2 flip from pass to fail: the rule reads the graph, so a WAF only counts when it sits in front of a public entry point.',
      action: () => {
        const waf = state.design.nodes.find((n) => n.type === 'waf');
        if (waf) removeSelected(waf.id);
      }
    },
    {
      selector: '#palette',
      title: 'Repair it',
      body: 'This adds a WAF back and wires it to CloudFront. SEC-2 returns to pass — and adding a WAF that is not connected would only have earned a warning.',
      action: () => {
        const cdn = state.design.nodes.find((n) => n.type === 'cloudfront');
        if (!cdn) return;
        let next = addNode(state.design, { type: 'waf', name: 'WAF', x: cdn.x - 160, y: cdn.y }, nextId);
        const waf = next.nodes[next.nodes.length - 1];
        next = connect(next, waf.id, cdn.id);
        state.selectedId = waf.id;
        setStatus('Added WAF and connected it to CloudFront.');
        commit(next);
      }
    },
    {
      selector: '#btn-export-tf',
      title: 'Export a Terraform skeleton',
      body: 'Every component becomes a correctly typed resource, ordered by the design\'s edges through depends_on. The attributes you must decide are marked TODO — nothing is invented.',
      action: () => openExport('Terraform skeleton', 'main.tf', toTerraform(state.design))
    }
  ]
});

/* ----------------------------------------------------------------- wiring */

// Template select
for (const t of TEMPLATES) {
  const opt = document.createElement('option');
  opt.value = t.id;
  opt.textContent = t.name;
  dom.template.append(opt);
}
dom.template.addEventListener('change', (e) => {
  loadTemplate(e.target.value);
  e.target.value = '';
});

renderPalette(dom.palette, addFromPalette);

// Canvas: drag-and-drop from the palette
dom.canvas.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
dom.canvas.addEventListener('drop', (e) => {
  e.preventDefault();
  const type = e.dataTransfer.getData('text/plain');
  if (!getEntry(type)) return;
  const rect = dom.canvas.getBoundingClientRect();
  addAt(type, e.clientX - rect.left, e.clientY - rect.top);
});

// Canvas: pointer interaction
function canvasPoint(e) {
  const rect = dom.canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

dom.canvas.addEventListener('pointerdown', (e) => {
  const { x, y } = canvasPoint(e);
  const node = hitTest(state.design, x, y);
  if (e.shiftKey && node) {
    if (!state.connectFromId) beginConnect(node.id);
    else finishConnect(node.id);
    return;
  }
  if (state.connectFromId && node) {
    finishConnect(node.id);
    return;
  }
  if (node) {
    state.selectedId = node.id;
    state.dragging = { id: node.id, dx: x - node.x, dy: y - node.y };
    dom.canvas.setPointerCapture(e.pointerId);
    state.undo.push(state.design);
    if (state.undo.length > UNDO_LIMIT) state.undo.shift();
  } else {
    state.selectedId = null;
    cancelConnect();
  }
  render();
});

dom.canvas.addEventListener('pointermove', (e) => {
  if (!state.dragging) return;
  const { x, y } = canvasPoint(e);
  const pos = clampPosition(x - state.dragging.dx, y - state.dragging.dy, state.size.width, state.size.height);
  state.design = moveNode(state.design, state.dragging.id, pos.x, pos.y);
  drawDesign(dom.canvas, state.design, { selectedId: state.selectedId, connectFromId: state.connectFromId, ...state.size });
});

function endDrag() {
  if (!state.dragging) return;
  state.dragging = null;
  render();
}
dom.canvas.addEventListener('pointerup', endDrag);
dom.canvas.addEventListener('pointercancel', endDrag);

// Keyboard on the canvas
dom.canvas.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { cancelConnect(); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedId) { e.preventDefault(); removeSelected(); return; }
  if (!state.selectedId) return;
  const step = e.shiftKey ? 40 : 10;
  const n = getNode(state.design, state.selectedId);
  const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
  if (!delta) return;
  e.preventDefault();
  const pos = clampPosition(n.x + delta[0], n.y + delta[1], state.size.width, state.size.height);
  commit(moveNode(state.design, n.id, pos.x, pos.y));
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.connectFromId) cancelConnect();
});

// Toolbar
$('btn-undo').addEventListener('click', undo);
$('btn-clear').addEventListener('click', clearAll);
$('btn-export-tf').addEventListener('click', () => openExport('Terraform skeleton', 'main.tf', toTerraform(state.design)));
$('btn-export-cfn').addEventListener('click', () => openExport('CloudFormation skeleton', 'template.yaml', toCloudFormation(state.design)));
$('btn-export-json').addEventListener('click', () => openExport('Design JSON', 'design.json', JSON.stringify(serializeDesign(state.design), null, 2)));
$('btn-export-review').addEventListener('click', () => openExport('Review report (Markdown)', 'review.md', toReviewMarkdown(state.design, state.review, state.cost)));
$('btn-export-png').addEventListener('click', exportPng);
$('btn-import').addEventListener('click', () => dom.importInput.click());
dom.importInput.addEventListener('change', (e) => {
  importJson(e.target.files?.[0]);
  e.target.value = '';
});

// Export dialog
$('export-copy').addEventListener('click', async () => {
  const body = $('export-body').textContent;
  try {
    await navigator.clipboard.writeText(body);
    $('export-copy').textContent = 'Copied';
    setTimeout(() => { $('export-copy').textContent = 'Copy'; }, 1500);
  } catch {
    $('export-copy').textContent = 'Select and copy manually';
  }
});
$('export-download').addEventListener('click', () => {
  download(dom.dialog.dataset.filename || 'export.txt', $('export-body').textContent);
});
$('export-close').addEventListener('click', () => dom.dialog.close());

// Resize
function resize() {
  state.size = fitCanvas(dom.canvas);
  let next = state.design;
  for (const n of state.design.nodes) {
    const pos = clampPosition(n.x, n.y, state.size.width, state.size.height);
    if (pos.x !== n.x || pos.y !== n.y) next = moveNode(next, n.id, pos.x, pos.y);
  }
  state.design = next;
  render();
}
window.addEventListener('resize', resize);

/* ------------------------------------------------------------------- boot */

resize();
setStatus('Drag a service from the palette, or load a reference architecture.');
