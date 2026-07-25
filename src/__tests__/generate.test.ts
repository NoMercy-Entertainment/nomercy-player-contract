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

  it('collects error codes from all three packages, not only core', () => {
    // The extractor read only player-core until 2026-07-25, so nine codes minted
    // in the video and music libraries were invisible to every conformance check
    // measured against this file. One representative per package, so the test
    // fails if the extractor is ever narrowed again.
    expect(contract.errors).toContain('core:lifecycle/use-plugin-after-dispose'); // core
    expect(contract.errors).toContain('plugin:octopus/load-failed'); // video, the ASS renderer
    expect(contract.errors).toContain('core:player/crossfade-unsupported'); // music
  });

  it('is deterministic — two builds are byte-identical', () => {
    expect(JSON.stringify(buildContract())).toBe(JSON.stringify(contract));
  });

  it('sorts events by (map, name) so diffs are stable', () => {
    const keys = contract.events.map(e => `${e.map}:${e.name}`);
    expect(keys).toStrictEqual([...keys].sort());
  });
});
