import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildContract, Contract } from './generate';

const CONTRACT_PATH: string = `${dirname(fileURLToPath(import.meta.url))}/../contract/contract.json`;

export interface ReleaseCheck {
  ok: boolean;
  reason: string;
}

// The native ports pin to this file and implement whatever it says. When the
// source sits ahead of its tag, "whatever it says" includes changes nobody has
// published, so a native library would ship a symbol that no web consumer has.
//
// That is not hypothetical: at 2.0.1 this contract already carried the
// MediaList `current` -> `item` rename from commit 523bf4b, which is not in the
// published release. The version field said 2.0.1 and meant something else.
export function checkReleased(contract: Contract): ReleaseCheck {
  const { version, commitsAheadOfTag, dirty } = contract.provenance;

  if (dirty) {
    return { ok: false, reason: 'the source tree has uncommitted changes, so this contract describes nothing reproducible' };
  }

  if (commitsAheadOfTag < 0) {
    return { ok: false, reason: `no v${version} tag exists, so there is no released surface to describe` };
  }

  if (commitsAheadOfTag > 0) {
    return {
      ok: false,
      reason:
        `the source is ${commitsAheadOfTag} commit(s) ahead of v${version}, so this contract describes `
        + 'unreleased API. Publish the trio, or pass --allow-unreleased to say you meant it',
    };
  }

  return { ok: true, reason: '' };
}

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

  const release = checkReleased(buildContract());
  if (!release.ok) {
    if (process.argv.includes('--allow-unreleased')) {
      process.stdout.write(`Contract describes unreleased API, allowed explicitly: ${release.reason}\n`);
    }
    else {
      process.stderr.write(`Player contract is not a released surface: ${release.reason}\n`);
      process.exit(1);
    }
  }

  process.stdout.write('Player contract up to date.\n');
}
