import type { Box, BooleanFeature, Document, Feature, Mate, MeshData, PatternFeature, Xform } from './types.ts';
import { boundsOf, transformPositions } from './math.ts';
import * as K from './kernel.ts';
import { partById, defaultParams } from '../parts/registry.ts';
import { solveMates } from './mates.ts';

export type BuiltFeature = {
  id: string;
  positions: Float32Array | null;
  volume: number;
  triangles: number;
  bbox: Box | null;
  world: Box | null;
  error?: string;
};

export type Rebuild = {
  features: BuiltFeature[];
  mates: Map<string, Mate[]>;
  warnings: string[];
};

function emptyBox(): Box {
  return { min: [0, 0, 0], max: [0, 0, 0] };
}

function asBuilt(value: { solid: unknown; mates: Mate[] }): { solid: K.Solid; mates: Mate[] } {
  return value as { solid: K.Solid; mates: Mate[] };
}

export function rebuild(doc: Document): Rebuild {
  const warnings: string[] = [];
  const mates = new Map<string, Mate[]>();
  const locals = new Map<string, K.Solid>();
  const errors = new Map<string, string>();

  for (const feature of doc.features) {
    if (feature.kind !== 'part') continue;
    const mod = partById(feature.generator);
    if (!mod) {
      errors.set(feature.id, `Unknown part “${feature.generator}”.`);
      continue;
    }
    try {
      const params = { ...defaultParams(mod), ...feature.params };
      const built = asBuilt(mod.build(params));
      if (built.solid.isEmpty() || built.solid.status() !== 'NoError') {
        built.solid.delete();
        errors.set(feature.id, 'This part did not produce a solid.');
        continue;
      }
      locals.set(feature.id, built.solid);
      mates.set(feature.id, built.mates);
    } catch (error) {
      errors.set(feature.id, error instanceof Error ? error.message : 'Part failed.');
    }
  }

  warnings.push(...solveMates(doc, mates));

  const order = topo(doc.features);
  for (const feature of order) {
    if (feature.kind === 'part' || locals.has(feature.id) || errors.has(feature.id)) continue;
    try {
      const solid = feature.kind === 'boolean' ? buildBoolean(feature, doc, locals) : buildPattern(feature, doc, locals);
      if (solid.isEmpty() || solid.status() !== 'NoError') {
        solid.delete();
        errors.set(feature.id, 'The boolean did not produce a solid. Check that the pieces overlap.');
        continue;
      }
      locals.set(feature.id, solid);
    } catch (error) {
      errors.set(feature.id, error instanceof Error ? error.message : 'Operation failed.');
    }
  }

  const features: BuiltFeature[] = doc.features.map((feature) => {
    const solid = locals.get(feature.id);
    if (!solid) {
      return {
        id: feature.id,
        positions: null,
        volume: 0,
        triangles: 0,
        bbox: null,
        world: null,
        error: errors.get(feature.id) ?? 'Nothing to show.',
      };
    }
    const mesh = K.meshOf(solid);
    solid.delete();
    const worldPositions = transformPositions(mesh.positions, feature.transform);
    return {
      id: feature.id,
      positions: mesh.positions,
      volume: Math.abs(mesh.volume),
      triangles: mesh.triangles,
      bbox: mesh.bbox,
      world: boundsOf(worldPositions),
      error: errors.get(feature.id),
    };
  });

  return { features, mates, warnings };
}

function topo(features: Feature[]): Feature[] {
  const map = new Map(features.map((f) => [f.id, f]));
  const seen = new Set<string>();
  const out: Feature[] = [];
  const visit = (feature: Feature, stack: Set<string>) => {
    if (seen.has(feature.id)) return;
    if (stack.has(feature.id)) return;
    stack.add(feature.id);
    const deps = feature.kind === 'boolean' ? feature.sources : feature.kind === 'pattern' ? [feature.source] : [];
    for (const id of deps) {
      const dep = map.get(id);
      if (dep) visit(dep, stack);
    }
    stack.delete(feature.id);
    seen.add(feature.id);
    out.push(feature);
  };
  for (const feature of features) visit(feature, new Set());
  return out;
}

function buildBoolean(feature: BooleanFeature, doc: Document, locals: Map<string, K.Solid>): K.Solid {
  const pieces: K.Solid[] = [];
  for (const id of feature.sources) {
    const source = doc.features.find((f) => f.id === id);
    const solid = locals.get(id);
    if (!source || !solid) throw new Error('A boolean source is missing.');
    pieces.push(K.applyTransform(K.cloneSolid(solid), source.transform));
  }
  let world: K.Solid;
  if (feature.op === 'union') world = K.union(pieces);
  else if (feature.op === 'intersect') world = K.intersect(pieces);
  else {
    const [base, ...tools] = pieces;
    if (!base) throw new Error('Subtract needs a base solid.');
    world = K.subtract(base, tools);
  }
  return K.applyInverse(world, feature.transform);
}

function buildPattern(feature: PatternFeature, doc: Document, locals: Map<string, K.Solid>): K.Solid {
  const source = doc.features.find((f) => f.id === feature.source);
  const solid = locals.get(feature.source);
  if (!source || !solid) throw new Error('Pattern source is missing.');
  if (feature.mode === 'mirror') {
    const copy = K.applyTransform(K.cloneSolid(solid), source.transform);
    const normal = feature.plane === 'yz' ? [1, 0, 0] : feature.plane === 'zx' ? [0, 1, 0] : [0, 0, 1];
    const reflected = K.mirrored(K.cloneSolid(copy), normal as Xform['rotation']);
    return K.applyInverse(K.union([copy, reflected]), feature.transform);
  }
  const count = Math.max(1, Math.min(24, Math.round(feature.count)));
  const copies: K.Solid[] = [];
  for (let i = 0; i < count; i++) {
    let copy = K.applyTransform(K.cloneSolid(solid), source.transform);
    if (feature.mode === 'linear') {
      copy = K.moved(copy, [feature.spacing[0] * i, feature.spacing[1] * i, feature.spacing[2] * i]);
    } else {
      const angle = feature.stepAngle * i;
      const axis = feature.axis === 'x' ? [angle, 0, 0] : feature.axis === 'y' ? [0, angle, 0] : [0, 0, angle];
      copy = K.turned(copy, axis as Xform['rotation']);
    }
    copies.push(copy);
  }
  return K.applyInverse(K.union(copies), feature.transform);
}

export function assemblyBounds(doc: Document, built: Rebuild): Box {
  let box = emptyBox();
  let any = false;
  for (const feature of doc.features) {
    if (!feature.visible || feature.suppressed) continue;
    const mesh = built.features.find((f) => f.id === feature.id);
    if (!mesh?.world) continue;
    if (!any) {
      box = { min: [...mesh.world.min], max: [...mesh.world.max] };
      any = true;
    } else {
      for (let i = 0; i < 3; i++) {
        box.min[i] = Math.min(box.min[i], mesh.world.min[i]);
        box.max[i] = Math.max(box.max[i], mesh.world.max[i]);
      }
    }
  }
  return box;
}

export type { MeshData };
