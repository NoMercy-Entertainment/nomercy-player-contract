// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import { ArrowFunction, FunctionExpression, ObjectLiteralExpression, ParameterDeclaration, Project, SourceFile, SyntaxKind, VariableDeclaration } from 'ts-morph';

import { PACKAGES, REPO_ROOT } from './paths';

/**
 * Every declaration in the web trio, module by module, for the port's ledger.
 *
 * `scripts/ts-surface-inventory.py` found these with regular expressions and got
 * the answer wrong five times, every time in the direction that flatters the
 * port. Four are written up in the campaign notes. The fifth is why this file
 * exists:
 *
 *     bandwidthEstimator(this: Internals, fn?: () => number): (() => number) | void
 *
 * The method pattern read a parameter list as `\(([^)]*)\)`, and `[^)]*` cannot
 * cross the `)` in `() => number`. So EVERY method taking a callback was absent
 * from the inventory — not reported as unported, absent, which is worse: a
 * declaration that is never counted can never be counted as outstanding, and it
 * shrinks the denominator at the same time.
 *
 * A parser has no such failure mode, and one was already in this directory when
 * the regex was written beside it.
 */
export interface ModuleDeclaration {
  kind: 'function' | 'class' | 'const' | 'interface' | 'type' | 'enum' | 'method';
  name: string;
  /** Parameters excluding TypeScript's synthetic `this`, which Kotlin has no counterpart for. */
  arity: number;
}

export type PackageSurface = Record<string, ModuleDeclaration[]>;

const SKIP_DIR: Set<string> = new Set(['__tests__', 'node_modules', 'dist']);

function sourceFiles(dir: string): string[] {
  const found: string[] = [];

  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.has(name)) continue;

    const path: string = resolve(dir, name);

    if (statSync(path).isDirectory()) {
      found.push(...sourceFiles(path));
      continue;
    }

    if (name.endsWith('.ts') && !name.endsWith('.d.ts') && !name.endsWith('.test.ts')) {
      found.push(path);
    }
  }

  return found;
}

// `this: Internals` is a type annotation wearing a parameter's clothes: it emits
// no argument and Kotlin's receiver is implicit, so counting it made every mixin
// method's arity one too many and leaned on the comparison's tolerance to hide it.
function arityOf(parameters: ParameterDeclaration[]): number {
  return parameters.filter(parameter => parameter.getName() !== 'this').length;
}

function isCallable(node: VariableDeclaration): boolean {
  const initializer = node.getInitializer();

  return initializer instanceof ArrowFunction || initializer instanceof FunctionExpression;
}

/**
 * The object literal a mixin exports, if this declaration is one.
 *
 * `export const abrMethods = { bandwidth() {...} } as const` — the methods are
 * the module's real surface and the const is a composition detail, so both are
 * reported and the reader decides which is which. `as const` wraps the literal
 * in an assertion, which is why the initializer is unwrapped rather than tested
 * directly.
 */
function literalOf(node: VariableDeclaration): ObjectLiteralExpression | undefined {
  let initializer = node.getInitializer();

  const assertion = initializer?.asKind(SyntaxKind.AsExpression);
  if (assertion !== undefined) initializer = assertion.getExpression();

  return initializer?.asKind(SyntaxKind.ObjectLiteralExpression);
}

function readLiteral(literal: ObjectLiteralExpression): ModuleDeclaration[] {
  const found: ModuleDeclaration[] = [];

  for (const property of literal.getProperties()) {
    const method = property.asKind(SyntaxKind.MethodDeclaration);
    if (method !== undefined) {
      found.push({ kind: 'method', name: method.getName(), arity: arityOf(method.getParameters()) });
      continue;
    }

    // `name: (a, b) => ...` and `name: function (a, b) {}` are the same surface
    // written differently, and a port cannot tell them apart either.
    const assignment = property.asKind(SyntaxKind.PropertyAssignment);
    const initializer = assignment?.getInitializer();

    if (initializer instanceof ArrowFunction || initializer instanceof FunctionExpression) {
      found.push({ kind: 'method', name: assignment!.getName(), arity: arityOf(initializer.getParameters()) });
    }
  }

  return found;
}

function readFile(source: SourceFile): ModuleDeclaration[] {
  const found: ModuleDeclaration[] = [];

  for (const node of source.getFunctions()) {
    const name: string | undefined = node.getName();
    if (name === undefined || !node.isExported()) continue;

    found.push({ kind: 'function', name, arity: arityOf(node.getParameters()) });
  }

  for (const node of source.getClasses()) {
    const name: string | undefined = node.getName();
    if (name !== undefined && node.isExported()) {
      found.push({ kind: 'class', name, arity: 0 });
    }

    for (const method of node.getMethods()) {
      found.push({ kind: 'method', name: method.getName(), arity: arityOf(method.getParameters()) });
    }
  }

  for (const statement of source.getVariableStatements()) {
    for (const node of statement.getDeclarations()) {
      if (statement.isExported()) {
        found.push({
          kind: isCallable(node) ? 'function' : 'const',
          name: node.getName(),
          arity: isCallable(node) ? arityOf((node.getInitializer() as ArrowFunction).getParameters()) : 0,
        });
      }

      const literal = literalOf(node);
      if (literal !== undefined) found.push(...readLiteral(literal));
    }
  }

  for (const node of source.getInterfaces()) {
    if (!node.isExported()) continue;

    found.push({ kind: 'interface', name: node.getName(), arity: 0 });

    // An exported interface's callable members are contract, not decoration —
    // `IPlayer` is where the trio states what a player can be asked to do, and
    // dropping its members would quietly retire the question the port exists to
    // answer. Data properties are the shape of a value and are answered by the
    // Kotlin type as a whole, so only the callables are listed.
    for (const method of node.getMethods()) {
      found.push({ kind: 'method', name: method.getName(), arity: arityOf(method.getParameters()) });
    }

    for (const property of node.getProperties()) {
      const signature = property.getTypeNode()?.asKind(SyntaxKind.FunctionType);
      if (signature === undefined) continue;

      found.push({ kind: 'method', name: property.getName(), arity: arityOf(signature.getParameters()) });
    }
  }

  for (const node of source.getTypeAliases()) {
    if (node.isExported()) found.push({ kind: 'type', name: node.getName(), arity: 0 });
  }

  for (const node of source.getEnums()) {
    if (node.isExported()) found.push({ kind: 'enum', name: node.getName(), arity: 0 });
  }

  // A leading underscore is the trio's own marker for "not surface", and the
  // port is not expected to answer one.
  return found.filter(entry => !entry.name.startsWith('_'));
}

export function dumpModuleSurface(): Record<string, PackageSurface> {
  const dumped: Record<string, PackageSurface> = {};

  for (const [alias, root] of Object.entries(PACKAGES)) {
    const src: string = resolve(root, 'src');
    const project: Project = new Project({
      tsConfigFilePath: resolve(root, 'tsconfig.json'),
      skipAddingFilesFromTsConfig: true,
    });

    const surface: PackageSurface = {};

    for (const path of sourceFiles(src)) {
      const module: string = relative(src, path).replace(/\\/g, '/');
      const entries: ModuleDeclaration[] = readFile(project.addSourceFileAtPath(path));

      // Two declarations of the same name and arity in one module are one
      // question for the port, not two.
      const unique: Map<string, ModuleDeclaration> = new Map();
      for (const entry of entries) unique.set(`${entry.kind}:${entry.name}:${entry.arity}`, entry);

      surface[module] = [...unique.values()].sort((left, right) =>
        left.kind === right.kind ? left.name.localeCompare(right.name) : left.kind.localeCompare(right.kind));
    }

    dumped[`nomercy-${alias === 'core' ? 'player-core' : `${alias}-player`}`] = surface;
  }

  return dumped;
}

const OUT: string = resolve(REPO_ROOT, '.parity', 'ts-surface.json');

mkdirSync(resolve(REPO_ROOT, '.parity'), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(dumpModuleSurface(), null, 2)}\n`, 'utf8');

const total: number = Object.values(dumpModuleSurface())
  .reduce((sum, surface) => sum + Object.values(surface).reduce((count, rows) => count + rows.length, 0), 0);

process.stdout.write(`${total} declarations -> ${relative(REPO_ROOT, OUT)}\n`);
