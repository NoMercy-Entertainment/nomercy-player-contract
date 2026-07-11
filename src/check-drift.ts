import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildContract } from './generate';

const CONTRACT_PATH: string = `${dirname(fileURLToPath(import.meta.url))}/../contract/contract.json`;

export function checkDrift(): { ok: boolean; diff: string } {
  const fresh = `${JSON.stringify(buildContract(), null, 2)}\n`;
  const committed = readFileSync(CONTRACT_PATH, 'utf8');

  if (fresh === committed) return { ok: true, diff: '' };

  const freshLines = fresh.split('\n');
  const committedLines = committed.split('\n');
  const at = freshLines.findIndex((line, i) => line !== committedLines[i]);

  return { ok: false, diff: `line ${at + 1}: committed=${committedLines[at] ?? '<eof>'} fresh=${freshLines[at] ?? '<eof>'}` };
}

if (process.argv[1]?.endsWith('check-drift.ts')) {
  const result = checkDrift();
  if (!result.ok) {
    process.stderr.write(`Player contract drift: ${result.diff}\nRun 'npm run generate' and commit.\n`);
    process.exit(1);
  }
  process.stdout.write('Player contract up to date.\n');
}
