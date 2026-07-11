import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { checkDrift } from '../check-drift';
import { buildContract } from '../generate';

describe('checkDrift', () => {
  it('passes when the committed contract matches a fresh build', () => {
    expect(checkDrift().ok).toBe(true);
  });

  it('the committed file equals a fresh build (no manual edits)', () => {
    const onDisk = readFileSync(new URL('../../contract/contract.json', import.meta.url), 'utf8');
    expect(onDisk).toBe(`${JSON.stringify(buildContract(), null, 2)}\n`);
  });
});
