import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { PACKAGES, REPO_ROOT } from '../paths';

describe('paths', () => {
  it('resolves the repo root containing the packages dir', () => {
    expect(existsSync(`${REPO_ROOT}/packages`)).toBe(true);
  });

  it('points at all three real package roots', () => {
    expect(existsSync(`${PACKAGES.core}/package.json`)).toBe(true);
    expect(existsSync(`${PACKAGES.video}/package.json`)).toBe(true);
    expect(existsSync(`${PACKAGES.music}/package.json`)).toBe(true);
  });
});
