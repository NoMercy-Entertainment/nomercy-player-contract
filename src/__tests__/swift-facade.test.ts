import { describe, expect, it } from 'vitest';

import {
  checkFacadeDrift,
  extractSwiftFacade,
  readSwiftFacades,
  SwiftFacade,
} from '../extract-swift-facade';

describe('the Swift facade extractor', () => {
  it('takes the protocol body and not the conveniences below it', () => {
    // The extension carries the library's own arithmetic — progress, hasNext —
    // which the engine is not asked for and must not be reconciled against it.
    const source: string = [
      '@MainActor',
      'public protocol MusicChromePlayer: ObservableObject {',
      '    var isPlaying: Bool { get }',
      '    func togglePlayPause()',
      '}',
      '',
      'extension MusicChromePlayer {',
      '    public var progress: Double { 0 }',
      '}',
    ].join('\n');

    const facade: SwiftFacade | null = extractSwiftFacade(source);

    expect(facade?.members).toEqual(['isPlaying', 'togglePlayPause']);
  });

  it('returns nothing when the file holds no protocol at all', () => {
    expect(extractSwiftFacade('public struct NowPlaying {}')).toBeNull();
  });

  it('reads both shipped facades off disk', () => {
    const facades = readSwiftFacades();

    expect(facades.map(entry => entry.facade.name).sort()).toEqual([
      'MusicChromePlayer',
      'VideoChromePlayer',
    ]);
  });

  it('has an accounted-for reconciliation for every member of both facades', () => {
    // The check itself, run against the real files. A member added to either
    // protocol without an entry fails here — which is the only moment anybody
    // is forced to say what the engine answers it with.
    expect(checkFacadeDrift(readSwiftFacades())).toEqual([]);
  });

  it('reports a member nobody reconciled rather than passing it', () => {
    // The guard has to be seen failing. A drift check that cannot go red is a
    // green tick over a facade that has drifted.
    const invented: SwiftFacade = { name: 'VideoChromePlayer', members: ['isPlaying', 'teleport'] };

    const drift = checkFacadeDrift([{ library: 'video', facade: invented }]);

    expect(drift).toEqual([
      { library: 'video', facade: 'VideoChromePlayer', unreconciled: ['teleport'] },
    ]);
  });
});
