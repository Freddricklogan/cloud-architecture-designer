/**
 * DOM rendering for the side panels. Builds elements with `textContent` and
 * `createElement` only — node names can come from an imported file, so no
 * string is ever interpolated into `innerHTML`.
 */

import { CATALOG, CATEGORIES, getEntry } from './catalog.js';
import { degree } from './graph.js';
import { formatUsd } from './cost.js';
import { CATEGORY_COLOURS } from './render.js';

function el(tag, props = {}, kids = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids) if (kid != null) node.append(kid);
  return node;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/**
 * Palette: one draggable card per catalog entry plus an "Add" button so the
 * designer works without a pointer.
 * @param {HTMLElement} host
 * @param {(type: string) => void} onAdd
 */
export function renderPalette(host, onAdd) {
  clear(host);
  for (const cat of CATEGORIES) {
    const entries = CATALOG.filter((e) => e.category === cat.key);
    if (!entries.length) continue;
    const section = el('section', { class: 'cad-palette__group', 'aria-labelledby': `pal-${cat.key}` });
    section.append(el('h3', { id: `pal-${cat.key}`, class: 'cad-palette__title', text: cat.label }));
    for (const entry of entries) {
      const swatch = el('span', { class: 'cad-palette__icon', text: entry.abbr, 'aria-hidden': 'true' });
      swatch.style.setProperty('--cat', CATEGORY_COLOURS[entry.category]);
      const add = el('button', { type: 'button', class: 'cad-palette__add', 'aria-label': `Add ${entry.name}`, text: '+' });
      add.addEventListener('click', () => onAdd(entry.type));
      const item = el('div', { class: 'cad-palette__item', draggable: 'true', dataset: { type: entry.type } }, [
        swatch,
        el('span', { class: 'cad-palette__text' }, [
          el('span', { class: 'cad-palette__name', text: entry.name }),
          el('span', { class: 'cad-palette__desc', text: entry.description })
        ]),
        add
      ]);
      item.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', entry.type);
        event.dataTransfer.effectAllowed = 'copy';
      });
      section.append(item);
    }
    host.append(section);
  }
}

/** @param {HTMLElement} host @param {import('./cost.js').estimateCost extends (...a: any) => infer R ? R : never} cost */
export function renderCost(host, cost) {
  clear(host);
  if (!cost.byCategory.length) {
    host.append(el('p', { class: 'cad-muted', text: 'Add components to see a breakdown.' }));
    return;
  }
  const list = el('ul', { class: 'cad-cost-list' });
  for (const row of cost.byCategory) {
    const bar = el('span', { class: 'cad-cost-bar', 'aria-hidden': 'true' });
    bar.style.setProperty('--w', `${Math.round(row.share * 100)}%`);
    bar.style.setProperty('--cat', CATEGORY_COLOURS[row.category]);
    list.append(el('li', { class: 'cad-cost-row' }, [
      el('span', { class: 'cad-cost-label', text: row.label }),
      bar,
      el('span', { class: 'cad-cost-value', text: `${formatUsd(row.cost)} · ${Math.round(row.share * 100)}%` })
    ]));
  }
  host.append(list);
}

const STATUS_GLYPH = { pass: '✓', warn: '!', fail: '✗', na: '–' };
const STATUS_LABEL = { pass: 'Pass', warn: 'Warning', fail: 'Fail', na: 'Not applicable' };

/**
 * @param {HTMLElement} scoreHost
 * @param {HTMLElement} pillarsHost
 * @param {HTMLElement} listHost
 * @param {import('./review.js').Review} review
 */
export function renderReview(scoreHost, pillarsHost, listHost, review) {
  scoreHost.textContent = review.score === null ? '—' : `${review.score}`;
  scoreHost.dataset.tone = review.score === null ? 'na' : review.score >= 80 ? 'ok' : review.score >= 50 ? 'warn' : 'danger';

  clear(pillarsHost);
  for (const p of review.pillars) {
    const fill = el('span', { class: 'cad-pillar__fill', 'aria-hidden': 'true' });
    fill.style.setProperty('--w', p.score === null ? '0%' : `${p.score}%`);
    fill.dataset.tone = p.score === null ? 'na' : p.score >= 80 ? 'ok' : p.score >= 50 ? 'warn' : 'danger';
    pillarsHost.append(el('li', { class: 'cad-pillar' }, [
      el('span', { class: 'cad-pillar__label', text: p.label }),
      el('span', { class: 'cad-pillar__track' }, [fill]),
      el('span', { class: 'cad-pillar__score', text: p.score === null ? 'n/a' : `${p.score}` })
    ]));
  }

  clear(listHost);
  const order = { fail: 0, warn: 1, pass: 2, na: 3 };
  const sorted = review.findings.slice().sort((a, b) => order[a.status] - order[b.status]);
  for (const f of sorted) {
    listHost.append(el('li', { class: `cad-finding cad-finding--${f.status}` }, [
      el('span', { class: 'cad-finding__icon', text: STATUS_GLYPH[f.status], role: 'img', 'aria-label': STATUS_LABEL[f.status] }),
      el('span', { class: 'cad-finding__body' }, [
        el('span', { class: 'cad-finding__title', text: `${f.id} · ${f.title}` }),
        el('span', { class: 'cad-finding__note', text: `${f.pillarLabel} — ${f.note}` })
      ])
    ]));
  }
}

/**
 * @param {HTMLElement} host
 * @param {import('./graph.js').Design} design
 * @param {import('./graph.js').DesignNode|null} node
 * @param {{ onRemove: (id: string) => void, onConnect: (id: string) => void }} handlers
 */
export function renderSelected(host, design, node, handlers) {
  clear(host);
  if (!node) {
    host.append(el('p', { class: 'cad-muted', text: 'Select a component on the canvas or in the inventory.' }));
    return;
  }
  const entry = getEntry(node.type);
  const rows = [
    ['Type', entry.name],
    ['Category', entry.category],
    ['Planning figure', `${formatUsd(entry.cost)} / month`],
    ['Connections', String(degree(design, node.id))],
    ['Terraform', entry.terraform],
    ['CloudFormation', entry.cfn]
  ];
  host.append(el('p', { class: 'cad-selected__name', text: node.name }));
  const dl = el('dl', { class: 'cad-props' });
  for (const [k, v] of rows) {
    dl.append(el('div', { class: 'cad-prop' }, [el('dt', { text: k }), el('dd', { text: v })]));
  }
  host.append(dl);
  const connect = el('button', { type: 'button', class: 'cad-btn', text: 'Connect from here' });
  connect.addEventListener('click', () => handlers.onConnect(node.id));
  const remove = el('button', { type: 'button', class: 'cad-btn cad-btn--danger', text: 'Remove' });
  remove.addEventListener('click', () => handlers.onRemove(node.id));
  host.append(el('div', { class: 'cad-btn-row' }, [connect, remove]));
}

/**
 * Screen-reader-friendly inventory of the canvas: every node with the same
 * actions the pointer has.
 * @param {HTMLElement} host
 * @param {import('./graph.js').Design} design
 * @param {string|null} selectedId
 * @param {{ onSelect: (id: string) => void }} handlers
 */
export function renderInventory(host, design, selectedId, handlers) {
  clear(host);
  if (!design.nodes.length) {
    host.append(el('li', { class: 'cad-muted', text: 'Nothing on the canvas yet.' }));
    return;
  }
  for (const n of design.nodes) {
    const entry = getEntry(n.type);
    const btn = el('button', {
      type: 'button',
      class: 'cad-inventory__item' + (n.id === selectedId ? ' is-selected' : ''),
      'aria-pressed': String(n.id === selectedId)
    }, [
      el('span', { class: 'cad-inventory__abbr', text: entry.abbr, 'aria-hidden': 'true' }),
      el('span', { class: 'cad-inventory__name', text: n.name }),
      el('span', { class: 'cad-inventory__meta', text: `${entry.name} · ${degree(design, n.id)} link${degree(design, n.id) === 1 ? '' : 's'}` })
    ]);
    btn.querySelector('.cad-inventory__abbr').style.setProperty('--cat', CATEGORY_COLOURS[entry.category]);
    btn.addEventListener('click', () => handlers.onSelect(n.id));
    host.append(el('li', {}, [btn]));
  }
}

/** Fill the export dialog. */
export function renderExport(dialog, { title, filename, body }) {
  dialog.querySelector('#export-title').textContent = title;
  dialog.querySelector('#export-body').textContent = body;
  dialog.dataset.filename = filename;
}
