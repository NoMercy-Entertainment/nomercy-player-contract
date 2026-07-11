import { describe, expect, it } from 'vitest';

import { extractEvents } from '../extract-events';

describe('extractEvents', () => {
  const events = extractEvents();
  const names = events.map(e => e.name);

  it('captures known base events by their exact string key', () => {
    expect(names).toContain('play');
    expect(names).toContain('pause');
    expect(names).toContain('time');
  });

  it('captures a namespaced event key verbatim', () => {
    expect(names).toContain('stream:error');
  });

  it('captures video-map and music-map events distinctly', () => {
    expect(events.some(e => e.map === 'video')).toBe(true);
    expect(events.some(e => e.map === 'music')).toBe(true);
  });

  it('carries a non-empty payload type text for every event', () => {
    expect(events.every(e => e.payload.length > 0)).toBe(true);
  });
});
