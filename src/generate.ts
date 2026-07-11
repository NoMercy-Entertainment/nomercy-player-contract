import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EventEntry, extractEvents } from './extract-events';
import { extractErrors } from './extract-errors';
import { extractMethods, MethodEntry } from './extract-methods';

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

export function buildContract(): Contract {
  const events = extractEvents().sort(byKey(e => `${e.map}:${e.name}`));
  const methods = extractMethods().sort(byKey(m => `${m.player}:${m.name}`));
  const errors = extractErrors();

  return { version: '2.0.0', events, methods, errors };
}

const CONTRACT_PATH: string = `${dirname(fileURLToPath(import.meta.url))}/../contract/contract.json`;

// Entrypoint: `npm run generate`.
if (process.argv[1]?.endsWith('generate.ts')) {
  mkdirSync(dirname(CONTRACT_PATH), { recursive: true });
  writeFileSync(CONTRACT_PATH, `${JSON.stringify(buildContract(), null, 2)}\n`);
  process.stdout.write(`wrote ${CONTRACT_PATH}\n`);
}
