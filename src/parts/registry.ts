import type { Params, PartModule } from '../cad/types.ts';
import { primitiveParts } from './primitives.ts';
import { gearParts } from './gears.ts';
import { shaftParts } from './shafts.ts';
import { fastenerParts } from './fasteners.ts';
import { electronicParts } from './electronics.ts';
import { wheelParts } from './wheels.ts';
import { marineParts } from './marine.ts';
import { structureParts } from './structures.ts';

export const PARTS: PartModule[] = [
  ...primitiveParts,
  ...gearParts,
  ...shaftParts,
  ...fastenerParts,
  ...electronicParts,
  ...wheelParts,
  ...marineParts,
  ...structureParts,
];

const byId = new Map(PARTS.map((part) => [part.id, part]));

export function partById(id: string): PartModule | undefined {
  return byId.get(id);
}

export function defaultParams(part: PartModule): Params {
  const params: Params = {};
  for (const spec of part.params) params[spec.key] = spec.default;
  return params;
}

export function categories(): string[] {
  const seen: string[] = [];
  for (const part of PARTS) {
    if (!seen.includes(part.category)) seen.push(part.category);
  }
  return seen;
}
