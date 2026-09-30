import { initKernel, box, applyTransform, meshOf } from '../src/cad/kernel.ts';
import { transformPoint } from '../src/cad/math.ts';
import { rebuild } from '../src/cad/rebuild.ts';
import { stlBinary } from '../src/cad/export.ts';
import { visibleBodies } from '../src/cad/export.ts';
import { PARTS, defaultParams } from '../src/parts/registry.ts';
import { gearboxProject, rcBoatProject, rcCarProject } from '../src/templates.ts';
import type { Document, Feature } from '../src/cad/types.ts';
import { identityTransform } from '../src/cad/types.ts';

const failures: string[] = [];

function expect(cond: boolean, message: string) {
  if (!cond) failures.push(message);
}

await initKernel();

const marker = box([0.4, 0.4, 0.4], true);
const xform = { position: [12, -4, 7] as [number, number, number], rotation: [20, 35, -50] as [number, number, number], scale: [1.2, 0.8, 1.5] as [number, number, number] };
const moved = applyTransform(marker, xform);
const mesh = meshOf(moved);
moved.delete();
let sx = 0;
let sy = 0;
let sz = 0;
const count = mesh.positions.length / 3;
for (let i = 0; i < mesh.positions.length; i += 3) {
  sx += mesh.positions[i];
  sy += mesh.positions[i + 1];
  sz += mesh.positions[i + 2];
}
const predicted = transformPoint(0, 0, 0, xform);
expect(Math.abs(sx / count - predicted[0]) < 0.05, `transform X ${sx / count} vs ${predicted[0]}`);
expect(Math.abs(sy / count - predicted[1]) < 0.05, `transform Y ${sy / count} vs ${predicted[1]}`);
expect(Math.abs(sz / count - predicted[2]) < 0.05, `transform Z ${sz / count} vs ${predicted[2]}`);

for (const part of PARTS) {
  const feature: Feature = {
    kind: 'part',
    id: part.id,
    name: part.name,
    visible: true,
    locked: false,
    suppressed: false,
    color: part.color,
    generator: part.id,
    params: defaultParams(part),
    transform: identityTransform(),
  };
  const doc: Document = {
    format: 'platen',
    version: 1,
    name: part.name,
    unit: 'mm',
    features: [feature],
    mates: [],
    bed: { x: 220, y: 220, visible: true },
    material: 'pla',
  };
  try {
    const built = rebuild(doc);
    const mesh = built.features[0];
    expect(!!mesh?.positions && mesh.triangles > 0 && mesh.volume > 0 && !mesh.error, `${part.id} failed: ${mesh?.error ?? 'empty'} tris=${mesh?.triangles} vol=${mesh?.volume}`);
    if (mesh?.positions && mesh.volume < 0.01) failures.push(`${part.id} volume too small ${mesh.volume}`);
  } catch (error) {
    failures.push(`${part.id} threw ${error instanceof Error ? error.message : error}`);
  }
}

for (const project of [gearboxProject(), rcCarProject(), rcBoatProject()]) {
  try {
    const built = rebuild(project);
    const bad = built.features.filter((feature) => feature.error || !feature.positions || feature.volume <= 0);
    expect(bad.length === 0, `${project.name} bad parts: ${bad.map((feature) => `${feature.id}:${feature.error ?? 'empty'}`).join(', ')}`);
    const bodies = visibleBodies(project, built);
    const stl = stlBinary(bodies);
    expect(stl.byteLength > 84, `${project.name} STL empty`);
  } catch (error) {
    failures.push(`${project.name} threw ${error instanceof Error ? error.message : error}`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  throw new Error(`${failures.length} checks failed`);
}
console.log(`Platen check ok: ${PARTS.length} parts, 3 kits, transform match.`);
