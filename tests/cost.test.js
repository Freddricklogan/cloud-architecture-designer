import { describe, it, expect } from 'vitest';
import { estimateCost, formatUsd } from '../src/cost.js';
import { addNode, createIdFactory, emptyDesign } from '../src/graph.js';
import { getEntry } from '../src/catalog.js';

function designOf(...types) {
  const nextId = createIdFactory();
  let d = emptyDesign();
  for (const t of types) d = addNode(d, { type: t, x: 0, y: 0 }, nextId);
  return d;
}

describe('estimateCost', () => {
  it('is zero for an empty design', () => {
    expect(estimateCost(emptyDesign())).toEqual({ total: 0, byCategory: [], largest: null });
  });

  it('sums the catalog figures and breaks them down by category, largest first', () => {
    const d = designOf('ec2', 'ec2', 'rds', 'kms');
    const c = estimateCost(d);
    expect(c.total).toBe(getEntry('ec2').cost * 2 + getEntry('rds').cost + getEntry('kms').cost);
    expect(c.byCategory[0]).toMatchObject({ category: 'compute', cost: 300 });
    expect(c.byCategory.map((b) => b.category)).toEqual(['compute', 'database', 'security']);
    const shares = c.byCategory.reduce((a, b) => a + b.share, 0);
    expect(shares).toBeCloseTo(1, 10);
    expect(c.largest).toEqual({ name: 'RDS', cost: 300 });
  });

  it('keeps the first of equal-cost candidates as largest', () => {
    const c = estimateCost(designOf('ec2', 'ec2'));
    expect(c.largest.name).toBe('EC2 Instance');
  });

  it('formats whole dollars with separators', () => {
    expect(formatUsd(0)).toBe('$0');
    expect(formatUsd(1234.6)).toBe('$1,235');
  });
});
