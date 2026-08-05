import { extractGroups } from './extract-groups';

// `npx tsx src/dump-groups.ts` — every group and the methods filed under it.
const groups = extractGroups();
const byLabel = new Map<string, string[]>();

for (const [name, label] of groups) {
  byLabel.set(label, [...(byLabel.get(label) ?? []), name]);
}

for (const label of [...byLabel.keys()].sort()) {
  process.stdout.write(`${label} (${byLabel.get(label)?.length})\n  ${byLabel.get(label)?.sort().join(', ')}\n`);
}
