import { ClassDeclaration, Project, SyntaxKind, TypeNode } from 'ts-morph';

import { extractGroups } from './extract-groups';
import { PACKAGES } from './paths';

export interface MethodEntry {
  name: string;
  signature: string;
  player: 'video' | 'music';
  // The subsystem that declares the behaviour (`core/transport`), or the
  // library itself for a method the player class implements on its own.
  group: string;
  // `accessor` is the stateful-noun pair — `quality()` reads, `quality(level)`
  // writes — which a native port answers with two overloads and can half-port
  // without any name going missing. The grader needs to know which is which.
  kind: 'accessor' | 'method';
}

interface PlayerSpec {
  tsconfig: string;
  file: string;
  cls: string;
  player: MethodEntry['player'];
}

const PLAYERS: PlayerSpec[] = [
  { tsconfig: `${PACKAGES.video}/tsconfig.json`, file: `${PACKAGES.video}/src/index.ts`, cls: 'NMVideoPlayer', player: 'video' },
  { tsconfig: `${PACKAGES.music}/tsconfig.json`, file: `${PACKAGES.music}/src/index.ts`, cls: 'NMMusicPlayer', player: 'music' },
];

// Public declared surface only: `_`-prefixed internals and `__`-prefixed
// phantom brands (`__eventMap__`) are not part of the contract.
function isPublic(name: string): boolean {
  return !name.startsWith('_');
}

// A stateful noun is declared as a type literal carrying more than one call
// signature — the reader and the writer. One call signature is a plain method.
function kindOf(typeNode: TypeNode | undefined): MethodEntry['kind'] {
  const literal = typeNode?.asKind(SyntaxKind.TypeLiteral);
  if (!literal) return 'method';

  return literal.getMembers().filter(member => member.asKind(SyntaxKind.CallSignature)).length > 1
    ? 'accessor'
    : 'method';
}

function readClass(spec: PlayerSpec, groups: Map<string, string>): MethodEntry[] {
  const project: Project = new Project({ tsConfigFilePath: spec.tsconfig, skipAddingFilesFromTsConfig: true });
  const source = project.addSourceFileAtPath(spec.file);
  const cls: ClassDeclaration = source.getClassOrThrow(spec.cls);

  const entries: MethodEntry[] = [];

  const own = `${spec.player}/player`;

  for (const prop of cls.getProperties()) {
    if (!isPublic(prop.getName())) continue;
    entries.push({
      name: prop.getName(),
      signature: prop.getTypeNode()?.getText() ?? 'unknown',
      player: spec.player,
      group: groups.get(prop.getName()) ?? own,
      kind: kindOf(prop.getTypeNode()),
    });
  }

  for (const method of cls.getMethods()) {
    if (!isPublic(method.getName())) continue;
    const params = method.getParameters().map(p => p.getText()).join(', ');
    const ret = method.getReturnTypeNode()?.getText() ?? 'void';
    entries.push({
      name: method.getName(),
      signature: `(${params}) => ${ret}`,
      player: spec.player,
      group: groups.get(method.getName()) ?? own,
      kind: 'method',
    });
  }

  return entries;
}

export function extractMethods(): MethodEntry[] {
  const groups = extractGroups();
  return PLAYERS.flatMap(spec => readClass(spec, groups));
}
