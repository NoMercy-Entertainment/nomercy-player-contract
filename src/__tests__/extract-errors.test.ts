import { describe, expect, it } from 'vitest';

import { extractErrors } from '../extract-errors';

describe('extractErrors', () => {
  const codes = extractErrors();

  it('collects plugin-registration failure codes', () => {
    expect(codes).toContain('core:plugin/missing-dep');
    expect(codes).toContain('core:plugin/duplicate-id');
  });

  it('every code matches the namespace:category/reason shape', () => {
    const shape = /^[a-z0-9-]+:[a-z0-9-]+\/[a-z0-9-]+$/;
    expect(codes.every(c => shape.test(c))).toBe(true);
  });

  it('returns a de-duplicated, sorted list', () => {
    expect(codes).toStrictEqual([...new Set(codes)].sort());
  });

  it('excludes test-fixture codes', () => {
    expect(codes).not.toContain('core:foo/bar');
  });
});
