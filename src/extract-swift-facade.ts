import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { REPO_ROOT } from './paths';

// The Swift drop-in binds to a protocol, not to the engine. That protocol is the
// one place a native port can drift from the contract without anything failing
// to compile: add a member the engine cannot answer and every view still builds,
// every test still passes, and the first consumer to call it gets nothing.
//
// So the members are extracted and each one has to be accounted for. Not matched
// by name — Swift spells things differently on purpose, `togglePlayPause` where
// the web has `play`/`pause` — but present in a reconciliation somebody wrote
// down. A member with no entry is a member nobody reconciled.

export interface SwiftFacade {
  name: string;
  members: string[];
}

const FACADE_FILES: { library: 'video' | 'music'; path: string }[] = [
  {
    library: 'video',
    path: 'packages-native/nomercy-video-player-kmp/apple/NoMercyPlayer/Sources/NoMercyPlayer/video/VideoChromePlayer.swift',
  },
  {
    library: 'music',
    path: 'packages-native/nomercy-music-player-kmp/apple/NoMercyMusicPlayer/Sources/NoMercyMusicPlayer/MusicChromePlayer.swift',
  },
];

// The body of `protocol X { ... }`, and only the body: an extension below it
// carries derived conveniences that are the library's own arithmetic rather than
// anything the engine has to answer.
const PROTOCOL = /protocol\s+(\w+)\s*:[^{]*\{([\s\S]*?)\n\}/;
const PROPERTY = /^\s*var\s+(\w+)\s*:/;
const METHOD = /^\s*func\s+(\w+)\s*\(/;

export function extractSwiftFacade(source: string): SwiftFacade | null {
  const match: RegExpMatchArray | null = source.match(PROTOCOL);
  if (!match) {
    return null;
  }

  const members: string[] = [];
  for (const line of match[2].split('\n')) {
    const property: RegExpMatchArray | null = line.match(PROPERTY);
    if (property) {
      members.push(property[1]);
      continue;
    }

    const method: RegExpMatchArray | null = line.match(METHOD);
    if (method) {
      members.push(method[1]);
    }
  }

  return { name: match[1], members };
}

export function readSwiftFacades(): { library: 'video' | 'music'; facade: SwiftFacade }[] {
  const found: { library: 'video' | 'music'; facade: SwiftFacade }[] = [];

  for (const entry of FACADE_FILES) {
    const source: string = readFileSync(resolve(REPO_ROOT, entry.path), 'utf8');
    const facade: SwiftFacade | null = extractSwiftFacade(source);
    if (facade) {
      found.push({ library: entry.library, facade });
    }
  }

  return found;
}

// What each Swift member answers, in the engine's terms.
//
// Written out rather than derived, because the two surfaces are deliberately
// spelled differently and a fuzzy match would either pass everything or invent
// failures. The value of the table is that adding a facade member forces
// somebody to say what it maps to.
export const FACADE_RECONCILIATION: Record<string, string> = {
  // Shared by both facades.
  isPlaying: 'playState',
  togglePlayPause: 'play / pause',
  seek: 'time',
  volume: 'volume',
  isMuted: 'muted',

  // Video.
  currentTime: 'currentTime',
  duration: 'duration',
  bufferedPercent: 'buffered',
  levels: 'availableQualities',
  selectedQuality: 'currentQuality',
  // Two values on purpose: what a viewer chose and what the adaptive ladder is
  // actually serving. Collapsed into one, "Auto" can never show what it picked.
  actualPlayingLevel: 'the level ABR settled on, reported apart from the chosen one',
  audioOptions: 'audioTracks',
  selectedAudioID: 'currentAudioTrack',
  subtitleOptions: 'subtitleTracks',
  selectedSubtitleID: 'currentSubtitleTrack',
  error: 'the error event',
  // The platform surface. The engine does not own an AVPlayer and must not:
  // handing one out is how a library ends up managing somebody else's lifecycle.
  avPlayer: 'not the engine’s — the host’s playback surface',
  play: 'play',
  pause: 'pause',
  selectQuality: 'setQuality',
  selectAudio: 'setAudioTrack',
  selectSubtitle: 'setSubtitleTrack',

  // Music.
  nowPlaying: 'currentItem',
  positionSeconds: 'currentTime',
  durationSeconds: 'duration',
  queue: 'playlist',
  queueIndex: 'currentIndex',
  isShuffled: 'shuffleState',
  repeatMode: 'repeatState',
  next: 'next',
  previous: 'previous',
  playQueueIndex: 'seekToIndex',
  setShuffled: 'shuffleState',
  setRepeat: 'repeatState',
  setVolume: 'volume',
  setMuted: 'mute / unmute',
};

export interface FacadeDrift {
  library: string;
  facade: string;
  unreconciled: string[];
}

export function checkFacadeDrift(
  facades: { library: 'video' | 'music'; facade: SwiftFacade }[],
): FacadeDrift[] {
  return facades
    .map(({ library, facade }) => ({
      library,
      facade: facade.name,
      unreconciled: facade.members.filter(member => !(member in FACADE_RECONCILIATION)),
    }))
    .filter(entry => entry.unreconciled.length > 0);
}
