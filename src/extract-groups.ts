import { readdirSync } from 'node:fs';

import { ObjectLiteralExpression, Project, SourceFile, SyntaxKind } from 'ts-morph';

import { PACKAGES } from './paths';

// A method's group is the mixin that declares it.
//
// The contract used to say only which player exposes a method, which answers
// "does it exist" and nothing about where the behaviour lives. A native port is
// read and graded a subsystem at a time — transport, queue, cast — so the
// oracle has to name the subsystem, or every parity report is one flat list of
// 289 names with no way to tell a finished area from a half-done one.
//
// The kit's mixins ARE those subsystems: `core/mixins/transport.ts` declares
// exactly the transport surface. Group therefore comes from the declaring file,
// not from a hand-kept table that would drift the first time a method moved.

const MIXIN_DIR: string = `${PACKAGES.core}/src/core/mixins`;

function objectKeys(literal: ObjectLiteralExpression): string[] {
  const names: string[] = [];

  for (const prop of literal.getProperties()) {
    const named = prop.asKind(SyntaxKind.PropertyAssignment)
      ?? prop.asKind(SyntaxKind.ShorthandPropertyAssignment)
      ?? prop.asKind(SyntaxKind.MethodDeclaration)
      ?? prop.asKind(SyntaxKind.GetAccessor)
      ?? prop.asKind(SyntaxKind.SetAccessor);

    if (!named) continue;

    const nameNode = named.getNameNode();
    names.push(
      nameNode.getKind() === SyntaxKind.StringLiteral
        ? nameNode.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralValue()
        : named.getName(),
    );
  }

  return names;
}

function keysDeclaredIn(source: SourceFile): string[] {
  const names: string[] = [];

  for (const declaration of source.getVariableDeclarations()) {
    if (!declaration.isExported()) continue;

    // `as const` wraps the literal in an assertion; unwrap before reading keys.
    const initializer = declaration.getInitializer();
    const literal = initializer?.asKind(SyntaxKind.ObjectLiteralExpression)
      ?? initializer?.asKind(SyntaxKind.AsExpression)?.getExpression().asKind(SyntaxKind.ObjectLiteralExpression);

    if (literal) names.push(...objectKeys(literal));
  }

  return names;
}

/** Method name -> group label (`core/transport`, `core/queue`, ...). */
export function extractGroups(): Map<string, string> {
  const project: Project = new Project({
    tsConfigFilePath: `${PACKAGES.core}/tsconfig.json`,
    skipAddingFilesFromTsConfig: true,
  });

  const groups = new Map<string, string>();

  for (const file of readdirSync(MIXIN_DIR).filter(name => name.endsWith('.ts')).sort()) {
    const label = `core/${file.replace(/(-mixin)?\.ts$/, '')}`;
    const source = project.addSourceFileAtPath(`${MIXIN_DIR}/${file}`);

    for (const name of keysDeclaredIn(source)) {
      // First declaration wins: a helper re-exported by a second mixin belongs
      // to the file that defines it, and the sorted walk makes that stable.
      if (!groups.has(name)) groups.set(name, label);
    }
  }

  return groups;
}
