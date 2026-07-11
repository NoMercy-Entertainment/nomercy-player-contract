import { describe, expect, it } from 'vitest';

import { extractMethods } from '../extract-methods';

describe('extractMethods', () => {
  const methods = extractMethods();
  const names = methods.map(m => m.name);

  it('captures transport methods present on both players', () => {
    expect(names).toContain('play');
    expect(names).toContain('pause');
    expect(names).toContain('stop');
    expect(names).toContain('next');
    expect(names).toContain('previous');
  });

  it('captures the video quality surface (stateful-noun law)', () => {
    expect(names).toContain('qualityLevels');
    expect(names).toContain('quality');
  });

  it('records a non-empty signature text for every method', () => {
    expect(methods.every(m => m.signature.length > 0)).toBe(true);
  });

  it('excludes private and phantom-brand members', () => {
    expect(names.some(n => n.startsWith('_'))).toBe(false);
  });
});
