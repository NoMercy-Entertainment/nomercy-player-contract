import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EventEntry, extractEvents } from './extract-events';
import { extractErrors } from './extract-errors';
import { extractMethods, MethodEntry } from './extract-methods';
import { PACKAGES } from './paths';

export interface Contract {
  version: string;
  events: EventEntry[];
  methods: MethodEntry[];
  errors: string[];
}

function byKey<T>(key: (item: T) => string): (a: T, b: T) => number {
  return (a, b): number => {
    const ka = key(a);
    const kb = key(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  };
}

// Read from player-core rather than hardcoded: a literal silently describes the
// wrong release the moment the trio publishes, and the natives pin to this field.
export function contractVersion(): string {
  const manifest: string = readFileSync(resolve(PACKAGES.core, 'package.json'), 'utf8');
  const parsed: { version?: unknown } = JSON.parse(manifest);

  if (typeof parsed.version !== 'string') {
    throw new Error('nomercy-player-core/package.json has no string "version"');
  }

  return parsed.version;
}

export function buildContract(): Contract {
  const events = extractEvents().sort(byKey(e => `${e.map}:${e.name}`));
  const methods = extractMethods().sort(byKey(m => `${m.player}:${m.name}`));
  const errors = extractErrors();

  return { version: contractVersion(), events, methods, errors };
}

const CONTRACT_PATH: string = `${dirname(fileURLToPath(import.meta.url))}/../contract/contract.json`;

// Entrypoint: `npm run generate`.
if (process.argv[1]?.endsWith('generate.ts')) {
  mkdirSync(dirname(CONTRACT_PATH), { recursive: true });
  writeFileSync(CONTRACT_PATH, `${JSON.stringify(buildContract(), null, 2)}\n`);
  process.stdout.write(`wrote ${CONTRACT_PATH}\n`);
}
