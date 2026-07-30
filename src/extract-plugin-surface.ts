import { readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { ArrowFunction, ClassDeclaration, FunctionDeclaration, FunctionExpression, InterfaceDeclaration, Project, SourceFile, SyntaxKind, VariableDeclaration } from 'ts-morph';

import { PACKAGES } from './paths';

/**
 * Every callable and every option the web plugins declare.
 *
 * The existing contract covers two classes' public methods. It never covered a
 * plugin, and the plugins are where the chrome, the key handling, the subtitle
 * rendering and the cast surface live — a port graded against the contract could
 * be missing every one of them and stay green.
 *
 * Reading a plugin and porting what stands out is sampling. It produced a chrome
 * that drew five of fourteen controls while ten source-reading gates passed, and
 * the gates passed because they were written from the same partial reading. The
 * only fix that does not have that failure mode is a mechanical inventory: every
 * declaration the AST reports, whether or not anybody thought it mattered.
 */
export interface SurfaceEntry {
  /** `video/desktop-ui`, `core/controllers`, `core/src`. */
  plugin: string;
  package: 'core' | 'video' | 'music';
  /** File the declaration lives in, relative to the plugin. */
  file: string;
  name: string;
  kind: 'function' | 'method' | 'option' | 'const';
  /** Interface or class the member belongs to; absent for free declarations. */
  owner?: string;
  /** Exported from the plugin's entry point, so a consumer can reach it. */
  exported: boolean;
}

type PackageName = SurfaceEntry['package'];

const SKIP_DIR: Set<string> = new Set(['__tests__', 'node_modules', 'dist']);

// A plugin's own options interface is part of its surface: an option the port
// does not declare is an option a consumer silently loses. That is exactly how
// inactivityMs, buttonPriority and portraitHidden went missing — writing them at
// the call site is a compile error, so the code that never wrote them compiled.
const OPTION_SUFFIX: RegExp = /Options$/;

/**
 * Every top-level area of a package's source, not only its plugins.
 *
 * This read `src/plugins` alone, and the plugins are perhaps a third of each
 * package: the controllers, the adapters, the ports, the state machine and the
 * player classes' own logic were all outside it and graded by nothing except two
 * classes' public method lists. A gate that measures a third of the source reports
 * on a third of the port.
 */
function areaDirs(pkg: PackageName): string[] {
  const root: string = resolve(PACKAGES[pkg], 'src');

  let names: string[];

  try {
    names = readdirSync(root);
  }
  catch {
    return [];
  }

  const dirs: string[] = names
    .filter(name => !SKIP_DIR.has(name))
    .map(name => resolve(root, name))
    .filter(path => statSync(path).isDirectory());

  // `src` itself, for the files that sit at its root — index.ts, the player class,
  // v1-compat. Those are the most-used code in the package and were not in any
  // subdirectory, so a walk of the subdirectories alone missed them entirely.
  return [root, ...dirs];
}

function pluginDirs(pkg: PackageName): string[] {
  const root: string = resolve(PACKAGES[pkg], 'src', 'plugins');
  let names: string[];

  try {
    names = readdirSync(root);
  }
  catch {
    return [];
  }

  return names
    .filter(name => !SKIP_DIR.has(name))
    .map(name => resolve(root, name))
    .filter(path => statSync(path).isDirectory());
}

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

function isCallableInitializer(declaration: VariableDeclaration): boolean {
  const initializer = declaration.getInitializer();
  if (initializer === undefined) return false;

  return initializer instanceof ArrowFunction || initializer instanceof FunctionExpression;
}

function readInterface(node: InterfaceDeclaration, base: Omit<SurfaceEntry, 'name' | 'kind' | 'owner'>): SurfaceEntry[] {
  const owner: string = node.getName();
  if (!OPTION_SUFFIX.test(owner)) return [];

  return node.getProperties().map(property => ({
    ...base,
    name: property.getName(),
    kind: 'option' as const,
    owner,
    exported: node.isExported(),
  }));
}

function readClass(node: ClassDeclaration, base: Omit<SurfaceEntry, 'name' | 'kind' | 'owner'>): SurfaceEntry[] {
  const owner: string = node.getName() ?? 'anonymous';

  return node.getMethods()
    .filter(method => !method.getName().startsWith('__'))
    .map(method => ({
      ...base,
      name: method.getName(),
      kind: 'method' as const,
      owner,
      exported: node.isExported(),
    }));
}

function readFile(source: SourceFile, plugin: string, pkg: PackageName, pluginDir: string): SurfaceEntry[] {
  const base = {
    plugin,
    package: pkg,
    file: source.getFilePath().slice(pluginDir.length + 1),
    exported: false,
  };

  const entries: SurfaceEntry[] = [];

  for (const node of source.getFunctions()) {
    const name: string | undefined = (node as FunctionDeclaration).getName();
    if (name === undefined) continue;

    entries.push({ ...base, name, kind: 'function', exported: node.isExported() });
  }

  for (const statement of source.getVariableStatements()) {
    for (const declaration of statement.getDeclarations()) {
      const callable: boolean = isCallableInitializer(declaration);

      entries.push({
        ...base,
        name: declaration.getName(),
        kind: callable ? 'function' : 'const',
        exported: statement.isExported(),
      });
    }
  }

  for (const node of source.getInterfaces()) {
    entries.push(...readInterface(node, base));
  }

  for (const node of source.getClasses()) {
    entries.push(...readClass(node, base));
  }

  // An object literal passed straight to the plugin factory declares its hooks
  // as properties, not as named functions — `setup(player) { ... }` inside the
  // returned object never appears as a FunctionDeclaration.
  for (const literal of source.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)) {
    for (const property of literal.getProperties()) {
      const method = property.asKind(SyntaxKind.MethodDeclaration);
      if (method === undefined) continue;

      entries.push({ ...base, name: method.getName(), kind: 'method', owner: 'literal', exported: false });
    }
  }

  return entries;
}

export function extractPluginSurface(): SurfaceEntry[] {
  const entries: SurfaceEntry[] = [];

  for (const pkg of ['core', 'video', 'music'] as PackageName[]) {
    const tsconfig: string = resolve(PACKAGES[pkg], 'tsconfig.json');

    // The plugins named individually, because a gap in one of thirty-one is a
    // different statement from a gap "in the plugins", and everything else by area.
    const seen: Set<string> = new Set();

    for (const dir of [...pluginDirs(pkg), ...areaDirs(pkg)]) {
      const area: string = `${pkg}/${dir.split(/[\\/]/).pop()}`;
      const project: Project = new Project({ tsConfigFilePath: tsconfig, skipAddingFilesFromTsConfig: true });

      for (const path of sourceFiles(dir)) {
        // src/ is walked as an area AND its subdirectories are walked on their
        // own, so a file under one of them would otherwise count twice.
        if (seen.has(path)) continue;
        seen.add(path);

        entries.push(...readFile(project.addSourceFileAtPath(path), area, pkg, dir));
      }
    }
  }

  return entries;
}
