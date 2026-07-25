import { Project, SyntaxKind } from 'ts-morph';

import { PACKAGES } from './paths';

const CODE_SHAPE = /^[a-z0-9-]+:[a-z0-9-]+\/[a-z0-9-]+$/;

// All three packages, not just core. The video and music libraries mint codes of
// their own — `core:player/crossfade-unsupported` in music/index.ts, the whole
// `plugin:lyrics/` and `plugin:scrobble/` families — and a contract that omits
// them under-measures the surface the natives have to match. Conformance would
// then pass on a port that throws a code no web consumer handles, which is the
// failure this file exists to prevent.
export function extractErrors(): string[] {
  const project: Project = new Project({ skipAddingFilesFromTsConfig: true });

  for (const root of [PACKAGES.core, PACKAGES.video, PACKAGES.music]) {
    project.addSourceFilesAtPaths([
      `${root}/src/**/*.ts`,
      `!${root}/src/**/__tests__/**`,
      `!${root}/src/**/*.test.ts`,
    ]);
  }

  const codes = new Set<string>();

  for (const source of project.getSourceFiles()) {
    for (const literal of source.getDescendantsOfKind(SyntaxKind.StringLiteral)) {
      const value = literal.getLiteralValue();
      if (CODE_SHAPE.test(value)) codes.add(value);
    }
  }

  return [...codes].sort();
}
