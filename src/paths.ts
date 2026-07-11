import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here: string = dirname(fileURLToPath(import.meta.url));

// tools/player-contract/src → repo root is three levels up.
export const REPO_ROOT: string = resolve(here, '..', '..', '..');

export const PACKAGES: { core: string; video: string; music: string } = {
  core: resolve(REPO_ROOT, 'packages', 'nomercy-player-core'),
  video: resolve(REPO_ROOT, 'packages', 'nomercy-video-player'),
  music: resolve(REPO_ROOT, 'packages', 'nomercy-music-player'),
};
