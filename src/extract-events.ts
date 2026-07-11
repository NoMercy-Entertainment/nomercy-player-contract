import { InterfaceDeclaration, Project, SyntaxKind } from 'ts-morph';

import { PACKAGES } from './paths';

export interface EventEntry {
  name: string;
  payload: string;
  map: 'base' | 'video' | 'music';
}

interface MapSpec {
  tsconfig: string;
  file: string;
  iface: string;
  map: EventEntry['map'];
}

const MAPS: MapSpec[] = [
  { tsconfig: `${PACKAGES.core}/tsconfig.json`, file: `${PACKAGES.core}/src/types/events.ts`, iface: 'BaseEventMap', map: 'base' },
  { tsconfig: `${PACKAGES.video}/tsconfig.json`, file: `${PACKAGES.video}/src/types.ts`, iface: 'VideoEventMap', map: 'video' },
  { tsconfig: `${PACKAGES.music}/tsconfig.json`, file: `${PACKAGES.music}/src/types.ts`, iface: 'MusicEventMap', map: 'music' },
];

function readInterface(spec: MapSpec): EventEntry[] {
  const project: Project = new Project({ tsConfigFilePath: spec.tsconfig, skipAddingFilesFromTsConfig: true });
  const source = project.addSourceFileAtPath(spec.file);
  const iface: InterfaceDeclaration = source.getInterfaceOrThrow(spec.iface);

  return iface.getProperties().map((prop): EventEntry => {
    const nameNode = prop.getNameNode();
    // Event keys are string literals ('stream:error') or identifiers (play).
    const name = nameNode.getKind() === SyntaxKind.StringLiteral
      ? nameNode.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralValue()
      : prop.getName();

    return { name, payload: prop.getTypeNode()?.getText() ?? 'unknown', map: spec.map };
  });
}

export function extractEvents(): EventEntry[] {
  return MAPS.flatMap(readInterface);
}
