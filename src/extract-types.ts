import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { PACKAGES } from './paths';

/**
 * A type the web trio exports: an interface, a type alias, a class or an enum.
 *
 * The method surface said 94% and the type surface said 59% on the same day.
 * Methods are the shallowest layer of a port — a name and an arity — and the
 * types behind them are what a caller actually programs against. Counting only
 * methods is how a port reads finished while a consumer cannot express a single
 * cast-sender option.
 */
export interface TypeEntry {
  /** The exported name, exactly as the web declares it. */
  name: string;
  /** interface | type | class | enum. */
  kind: string;
  /** Which of the three areas it belongs to. */
  area: 'types' | 'adapters' | 'plugins';
  /** Path inside player-core/src, so a gap can be opened rather than guessed at. */
  file: string;
}

const AREAS: TypeEntry['area'][] = ['types', 'adapters', 'plugins'];

const DECLARATION =
  /^\s*export\s+(?:declare\s+)?(?:abstract\s+)?(interface|type|class|enum)\s+([A-Za-z_]\w*)/gm;

function walk(directory: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);

    if (statSync(path).isDirectory()) {
      // __tests__ describes the tests, not the surface a consumer sees.
      if (entry === '__tests__' || entry === 'node_modules') continue;
      found.push(...walk(path));
      continue;
    }

    if (path.endsWith('.ts') && !path.endsWith('.test.ts')) found.push(path);
  }

  return found;
}

/**
 * Every exported type in player-core's `types`, `adapters` and `plugins`.
 *
 * These three because they are what Stoney named, and because they are the three
 * a port can pass a method-name check while failing: the methods live on the
 * player, the types live behind it.
 */
export function extractTypes(): TypeEntry[] {
  const root = join(PACKAGES.core, 'src');
  const entries: TypeEntry[] = [];

  for (const area of AREAS) {
    for (const file of walk(join(root, area))) {
      const source = readFileSync(file, 'utf8');

      for (const match of source.matchAll(DECLARATION)) {
        entries.push({
          name: match[2],
          kind: match[1],
          area,
          file: relative(root, file).split('\\').join('/'),
        });
      }
    }
  }

  // One entry per name. The same type is re-exported from an index in several
  // places, and counting it twice would make the denominator a property of the
  // export graph rather than of the surface.
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.name)) return false;
    seen.add(entry.name);
    return true;
  });
}
