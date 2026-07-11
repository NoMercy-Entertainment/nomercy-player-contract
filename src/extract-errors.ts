import { Project, SyntaxKind } from 'ts-morph';

import { PACKAGES } from './paths';

const CODE_SHAPE = /^[a-z0-9-]+:[a-z0-9-]+\/[a-z0-9-]+$/;

export function extractErrors(): string[] {
  const project: Project = new Project({ skipAddingFilesFromTsConfig: true });
  project.addSourceFilesAtPaths([
    `${PACKAGES.core}/src/**/*.ts`,
    `!${PACKAGES.core}/src/**/__tests__/**`,
    `!${PACKAGES.core}/src/**/*.test.ts`,
  ]);

  const codes = new Set<string>();

  for (const source of project.getSourceFiles()) {
    for (const literal of source.getDescendantsOfKind(SyntaxKind.StringLiteral)) {
      const value = literal.getLiteralValue();
      if (CODE_SHAPE.test(value)) codes.add(value);
    }
  }

  return [...codes].sort();
}
