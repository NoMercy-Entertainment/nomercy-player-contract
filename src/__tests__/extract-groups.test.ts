import { describe, expect, it } from 'vitest';

import { extractGroups } from '../extract-groups';

describe('extractGroups', () => {
  const groups = extractGroups();

  it('files transport methods under the transport mixin', () => {
    expect(groups.get('play')).toBe('core/transport');
    expect(groups.get('pause')).toBe('core/transport');
  });

  it('files volume under the volume mixin', () => {
    expect(groups.get('volume')).toBe('core/volume');
  });

  it('files plugin registration under its own mixin', () => {
    expect(groups.get('addPlugin')).toBe('core/plugin-registration');
  });

  it('labels every group as core/<subsystem>', () => {
    const bad = [...new Set(groups.values())].filter(label => !/^core\/[a-z0-9-]+$/.test(label));
    expect(bad).toStrictEqual([]);
  });
});
