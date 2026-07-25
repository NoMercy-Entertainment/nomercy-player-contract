import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildContract } from '../generate';
import { PACKAGES } from '../paths';

describe('buildContract', () => {
  const contract = buildContract();

  it('stamps the version the trio actually publishes', () => {
    const published: string = JSON.parse(
      readFileSync(resolve(PACKAGES.core, 'package.json'), 'utf8'),
    ).version;

    expect(contract.version).toBe(published);
  });

  it('stamps a real semver, not a placeholder', () => {
    expect(contract.version).toMatch(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/);
  });

  it('records provenance, so a version stamp cannot misrepresent unreleased source', () => {
    expect(contract.provenance.version).toBe(contract.version);
    expect(contract.provenance.commit).toMatch(/^[0-9a-f]{7,40}$/);
    expect(typeof contract.provenance.commitsAheadOfTag).toBe('number');
    expect(typeof contract.provenance.dirty).toBe('boolean');
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
