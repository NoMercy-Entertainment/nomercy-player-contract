import { ClassDeclaration, Project } from 'ts-morph';

import { PACKAGES } from './paths';

export interface MethodEntry {
  name: string;
  signature: string;
  player: 'video' | 'music';
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

function readClass(spec: PlayerSpec): MethodEntry[] {
  const project: Project = new Project({ tsConfigFilePath: spec.tsconfig, skipAddingFilesFromTsConfig: true });
  const source = project.addSourceFileAtPath(spec.file);
  const cls: ClassDeclaration = source.getClassOrThrow(spec.cls);

  const entries: MethodEntry[] = [];

  for (const prop of cls.getProperties()) {
    if (!isPublic(prop.getName())) continue;
    entries.push({ name: prop.getName(), signature: prop.getTypeNode()?.getText() ?? 'unknown', player: spec.player });
  }

  for (const method of cls.getMethods()) {
    if (!isPublic(method.getName())) continue;
    const params = method.getParameters().map(p => p.getText()).join(', ');
    const ret = method.getReturnTypeNode()?.getText() ?? 'void';
    entries.push({ name: method.getName(), signature: `(${params}) => ${ret}`, player: spec.player });
  }

  return entries;
}

export function extractMethods(): MethodEntry[] {
  return PLAYERS.flatMap(readClass);
}
