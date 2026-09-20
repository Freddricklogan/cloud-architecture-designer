/**
 * Cost estimation. The figures are the catalog's illustrative planning
 * placeholders, summed and broken down by category; nothing here pretends
 * to be an AWS price list. The UI prints the assumption beside the total.
 */

import { CATEGORIES, getEntry } from './catalog.js';

/**
 * @param {import('./graph.js').Design} design
 * @returns {{ total: number, byCategory: Array<{ category: string, label: string, cost: number, share: number }>, largest: {name: string, cost: number}|null }}
 */
export function estimateCost(design) {
  const totals = new Map();
  let total = 0;
  let largest = null;
  for (const node of design.nodes) {
    const entry = getEntry(node.type);
    if (!entry) continue;
    total += entry.cost;
    totals.set(entry.category, (totals.get(entry.category) ?? 0) + entry.cost);
    if (!largest || entry.cost > largest.cost) largest = { name: node.name, cost: entry.cost };
  }
  const byCategory = CATEGORIES
    .filter((c) => totals.has(c.key))
    .map((c) => ({
      category: c.key,
      label: c.label,
      cost: totals.get(c.key),
      share: total > 0 ? totals.get(c.key) / total : 0
    }))
    .sort((a, b) => b.cost - a.cost);
  return { total, byCategory, largest };
}

/** "$1,234" with no decimals; the inputs are round planning figures. */
export function formatUsd(value) {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}
