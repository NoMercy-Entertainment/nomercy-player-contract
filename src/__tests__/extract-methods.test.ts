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

  it('files a kit method under the mixin that declares it', () => {
    expect(methods.find(m => m.name === 'play' && m.player === 'video')?.group).toBe('core/transport');
    expect(methods.find(m => m.name === 'volume' && m.player === 'music')?.group).toBe('core/volume');
  });

  it('files a library-only method under the library itself', () => {
    expect(methods.find(m => m.name === 'toggleFullscreen')?.group).toBe('video/player');
  });

  it('marks a stateful noun as an accessor and a verb as a method', () => {
    expect(methods.find(m => m.name === 'volume' && m.player === 'video')?.kind).toBe('accessor');
    expect(methods.find(m => m.name === 'play' && m.player === 'video')?.kind).toBe('method');
  });

  it('does not mistake an overloaded reader for a stateful noun', () => {
    // `t(key)` / `t(PluginClass, key)` and `qualityLevels()` /
    // `qualityLevels(opts)` both read; neither has a writer to port.
    expect(methods.find(m => m.name === 't' && m.player === 'video')?.kind).toBe('method');
    expect(methods.find(m => m.name === 'qualityLevels')?.kind).toBe('method');
  });

  it('marks plain data as a property', () => {
    expect(methods.find(m => m.name === 'playerId' && m.player === 'video')?.kind).toBe('property');
    expect(methods.find(m => m.name === 'videoElement')?.kind).toBe('property');
  });

  it('records every arity a method can be called with', () => {
    // The picker takes nothing; a native routing call taking a device id is a
    // different method wearing the same name.
    expect(methods.find(m => m.name === 'selectAudioOutput')?.arities).toStrictEqual([0]);
    // `volumeUp(step?)` is callable both ways.
    expect(methods.find(m => m.name === 'volumeUp')?.arities).toStrictEqual([0, 1]);
    expect(methods.find(m => m.name === 'volume' && m.player === 'video')?.arities).toStrictEqual([0, 1]);
  });

  it('gives every method a group', () => {
    expect(methods.filter(m => !m.group)).toStrictEqual([]);
  });
});
