import { describe, expect, it } from 'vitest';

import { buildContract } from '../generate';

describe('buildContract', () => {
  const contract = buildContract();

  it('stamps the web-contract version', () => {
    expect(contract.version).toBe('2.0.0');
  });

  it('includes the three surfaces', () => {
    expect(contract.events.length).toBeGreaterThan(0);
    expect(contract.methods.length).toBeGreaterThan(0);
    expect(contract.errors.length).toBeGreaterThan(0);
  });

  it('is deterministic — two builds are byte-identical', () => {
    expect(JSON.stringify(buildContract())).toBe(JSON.stringify(contract));
  });

  it('sorts events by (map, name) so diffs are stable', () => {
    const keys = contract.events.map(e => `${e.map}:${e.name}`);
    expect(keys).toStrictEqual([...keys].sort());
  });
});
