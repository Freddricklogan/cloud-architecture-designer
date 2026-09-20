import { describe, it, expect } from 'vitest';
import { TEMPLATES, getTemplate, instantiateTemplate } from '../src/templates.js';
import { createIdFactory, orphans } from '../src/graph.js';
import { isKnownType } from '../src/catalog.js';
import { reviewDesign } from '../src/review.js';

describe('templates', () => {
  it('ships five reference architectures with unique ids', () => {
    expect(TEMPLATES).toHaveLength(5);
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(5);
    expect(getTemplate('serverless').name).toBe('Serverless API');
    expect(getTemplate('nope')).toBeUndefined();
  });

  for (const t of TEMPLATES) {
    describe(t.id, () => {
      it('uses only catalog types and unique keys', () => {
        const keys = t.nodes.map((n) => n.key);
        expect(new Set(keys).size).toBe(keys.length);
        for (const n of t.nodes) expect(isKnownType(n.type)).toBe(true);
      });

      it('every edge references a declared key, no self-loops, no duplicates', () => {
        const keys = new Set(t.nodes.map((n) => n.key));
        const seen = new Set();
        for (const [a, b] of t.edges) {
          expect(keys.has(a)).toBe(true);
          expect(keys.has(b)).toBe(true);
          expect(a).not.toBe(b);
          const k = [a, b].sort().join('>');
          expect(seen.has(k)).toBe(false);
          seen.add(k);
        }
      });

      it('instantiates centred on the canvas with every edge intact and no orphans', () => {
        const d = instantiateTemplate(t, 400, 300, createIdFactory());
        expect(d.nodes).toHaveLength(t.nodes.length);
        expect(d.edges).toHaveLength(t.edges.length);
        expect(d.nodes[0].x).toBe(400 + t.nodes[0].dx);
        expect(orphans(d)).toEqual([]);
      });

      it('passes the security pillar outright (a reference architecture should)', () => {
        const d = instantiateTemplate(t, 400, 300, createIdFactory());
        const sec = reviewDesign(d).findings.filter((f) => f.pillar === 'security' && f.status !== 'na');
        expect(sec.map((f) => `${f.id}:${f.status}`)).toEqual(sec.map((f) => `${f.id}:pass`));
      });

      it('has no failing Well-Architected rule (a reference architecture should not)', () => {
        const d = instantiateTemplate(t, 400, 300, createIdFactory());
        const review = reviewDesign(d);
        const fails = review.findings.filter((f) => f.status === 'fail');
        expect(fails, fails.map((f) => `${f.id}: ${f.note}`).join('\n')).toEqual([]);
      });
    });
  }

  it('throws on a template whose edge references an unknown key', () => {
    const broken = { id: 'x', name: 'x', summary: '', nodes: [{ key: 'a', type: 's3', name: 'a', dx: 0, dy: 0 }], edges: [['a', 'b']] };
    expect(() => instantiateTemplate(broken, 0, 0, createIdFactory())).toThrow(/unknown key/);
  });
});
