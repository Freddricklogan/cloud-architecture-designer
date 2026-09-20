import { describe, it, expect } from 'vitest';
import {
  CATALOG, CATEGORIES, COMPUTE_TYPES, DATA_STORE_TYPES, getEntry, isKnownType,
  MESSAGING_TYPES, PUBLIC_ENTRY_TYPES, CREDENTIALED_STORE_TYPES
} from '../src/catalog.js';

describe('catalog', () => {
  it('has unique types', () => {
    const types = CATALOG.map((e) => e.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it('every entry has the fields the exporters and rules rely on', () => {
    for (const e of CATALOG) {
      expect(e.type).toMatch(/^[a-z0-9]+$/);
      expect(typeof e.name).toBe('string');
      expect(typeof e.abbr).toBe('string');
      expect(typeof e.cost).toBe('number');
      expect(e.cost).toBeGreaterThanOrEqual(0);
      expect(typeof e.managed).toBe('boolean');
      expect(e.terraform).toMatch(/^aws_[a-z0-9_]+$/);
      expect(e.cfn).toMatch(/^AWS::[A-Za-z0-9]+::[A-Za-z0-9]+$/);
    }
  });

  it('every entry belongs to a listed category', () => {
    const keys = new Set(CATEGORIES.map((c) => c.key));
    for (const e of CATALOG) expect(keys.has(e.category)).toBe(true);
  });

  it('looks up entries by type', () => {
    expect(getEntry('rds').name).toBe('RDS');
    expect(getEntry('nope')).toBeUndefined();
    expect(isKnownType('lambda')).toBe(true);
    expect(isKnownType('')).toBe(false);
  });

  it('classification sets only reference real types', () => {
    for (const set of [COMPUTE_TYPES, DATA_STORE_TYPES, MESSAGING_TYPES, PUBLIC_ENTRY_TYPES, CREDENTIALED_STORE_TYPES]) {
      for (const t of set) expect(isKnownType(t)).toBe(true);
    }
    for (const t of CREDENTIALED_STORE_TYPES) expect(DATA_STORE_TYPES.has(t)).toBe(true);
  });
});
