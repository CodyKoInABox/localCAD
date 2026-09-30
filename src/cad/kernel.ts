import type { MeshData, Vec2, Vec3, Xform } from './types.ts';

type Manifold = {
  delete(): void;
  isEmpty(): boolean;
  status(): string;
  volume(): number;
  boundingBox(): { min: number[]; max: number[] };
  getMesh(): { numProp: number; vertProperties: Float32Array; triVerts: Uint32Array };
  translate(v: Vec3): Manifold;
  rotate(v: Vec3): Manifold;
  scale(v: Vec3 | number): Manifold;
  mirror(normal: Vec3): Manifold;
  add(other: Manifold): Manifold;
  subtract(other: Manifold): Manifold;
  intersect(other: Manifold): Manifold;
};

type Profile = {
  delete(): void;
  extrude(height: number, nDivisions?: number, twistDegrees?: number, scaleTop?: Vec2 | number, center?: boolean): Manifold;
  revolve(circularSegments?: number, revolveDegrees?: number): Manifold;
  add(other: Profile): Profile;
  subtract(other: Profile): Profile;
  offset(delta: number, joinType?: 'Square' | 'Round' | 'Miter', miterLimit?: number, circularSegments?: number): Profile;
  rotate(degrees: number): Profile;
  translate(v: Vec2): Profile;
};

type Api = {
  Manifold: {
    cube(size: Vec3 | number, center?: boolean): Manifold;
    cylinder(height: number, radiusLow: number, radiusHigh?: number, circularSegments?: number, center?: boolean): Manifold;
    sphere(radius: number, circularSegments?: number): Manifold;
    hull(parts: Manifold[]): Manifold;
    new (mesh: unknown): Manifold;
  };
  CrossSection: {
    new (contours: Vec2[] | Vec2[][]): Profile;
    square(size: Vec2 | number, center?: boolean): Profile;
    circle(radius: number, circularSegments?: number): Profile;
  };
  Mesh: new (options: { numProp: number; vertProperties: Float32Array; triVerts: Uint32Array }) => unknown;
  setup(): void;
  setMinCircularAngle(angle: number): void;
  setMinCircularEdgeLength(length: number): void;
};

let api: Api | null = null;

export async function initKernel(locateFile?: () => string): Promise<void> {
  if (api) return;
  const Module = (await import('manifold-3d')).default;
  const mod = (await Module(locateFile ? { locateFile } : undefined)) as unknown as Api;
  mod.setup();
  mod.setMinCircularAngle(4);
  mod.setMinCircularEdgeLength(0.25);
  api = mod;
}

function A(): Api {
  if (!api) throw new Error('CAD kernel is not ready');
  return api;
}

export type Solid = Manifold;
export type Section = Profile;

function swap<T>(prev: T, next: T): T {
  if (prev !== next && prev && typeof (prev as { delete?: () => void }).delete === 'function') {
    (prev as unknown as { delete: () => void }).delete();
  }
  return next;
}

export function box(size: Vec3, center = false): Solid {
  return A().Manifold.cube(size, center);
}

export function cylinder(height: number, radius: number, radiusTop = radius, segments = 0, center = false): Solid {
  return A().Manifold.cylinder(Math.max(height, 0.02), Math.max(radius, 0.01), Math.max(radiusTop, 0), segments, center);
}

export function sphere(radius: number, segments = 0): Solid {
  return A().Manifold.sphere(Math.max(radius, 0.01), segments);
}

export function section(points: Vec2[]): Section {
  return new (A().CrossSection)(points);
}

export function sections(rings: Vec2[][]): Section {
  return new (A().CrossSection)(rings);
}

export function circle(radius: number, segments = 0): Section {
  return A().CrossSection.circle(Math.max(radius, 0.01), segments);
}

export function square(width: number, height: number, center = true): Section {
  return A().CrossSection.square([width, height], center);
}

export function roundedRect(width: number, height: number, radius: number): Section {
  const r = Math.max(0, Math.min(radius, width / 2 - 0.02, height / 2 - 0.02));
  if (r < 0.04) return square(width, height, true);
  const inner = square(Math.max(0.05, width - 2 * r), Math.max(0.05, height - 2 * r), true);
  const out = inner.offset(r, 'Round', 2, 12);
  inner.delete();
  return out;
}

export function extrude(profile: Section, height: number, divisions = 0, twist = 0, scaleTop: Vec2 | number = [1, 1], center = false): Solid {
  const solid = profile.extrude(Math.max(height, 0.02), divisions, twist, scaleTop, center);
  profile.delete();
  return solid;
}

export function revolve(profile: Section, segments = 0, degrees = 360): Solid {
  const solid = profile.revolve(segments, degrees);
  profile.delete();
  return solid;
}

export function profileAdd(a: Section, b: Section): Section {
  const n = a.add(b);
  a.delete();
  b.delete();
  return n;
}

export function profileSub(a: Section, b: Section): Section {
  const n = a.subtract(b);
  a.delete();
  b.delete();
  return n;
}

export function profileRotate(a: Section, degrees: number): Section {
  return swap(a, a.rotate(degrees));
}

export function moved(s: Solid, v: Vec3): Solid {
  return swap(s, s.translate(v));
}

export function turned(s: Solid, v: Vec3): Solid {
  return swap(s, s.rotate(v));
}

export function scaled(s: Solid, v: Vec3): Solid {
  return swap(s, s.scale(v));
}

export function mirrored(s: Solid, normal: Vec3): Solid {
  return swap(s, s.mirror(normal));
}

export function cloneSolid(s: Solid): Solid {
  return s.translate([0, 0, 0]);
}

export function dispose(s: { delete(): void } | null | undefined): void {
  s?.delete();
}

export function union(parts: Solid[]): Solid {
  const live = parts.filter((p) => {
    if (p.isEmpty()) {
      p.delete();
      return false;
    }
    return true;
  });
  if (live.length === 0) return box([0.2, 0.2, 0.2], true);
  let acc = live[0];
  for (let i = 1; i < live.length; i++) {
    const next = acc.add(live[i]);
    acc.delete();
    live[i].delete();
    acc = next;
  }
  return acc;
}

export function subtract(base: Solid, tools: Solid[]): Solid {
  let acc = base;
  for (const tool of tools) {
    if (tool.isEmpty()) {
      tool.delete();
      continue;
    }
    const next = acc.subtract(tool);
    acc.delete();
    tool.delete();
    acc = next;
  }
  return acc;
}

export function intersect(parts: Solid[]): Solid {
  const live = parts.filter((p) => {
    if (p.isEmpty()) {
      p.delete();
      return false;
    }
    return true;
  });
  if (live.length === 0) return box([0.2, 0.2, 0.2], true);
  let acc = live[0];
  for (let i = 1; i < live.length; i++) {
    const next = acc.intersect(live[i]);
    acc.delete();
    live[i].delete();
    acc = next;
  }
  return acc;
}

export function hull(parts: Solid[]): Solid {
  const h = A().Manifold.hull(parts);
  for (const p of parts) p.delete();
  return h;
}

export function applyTransform(solid: Solid, t: Xform): Solid {
  let acc = scaled(solid, t.scale);
  acc = turned(acc, t.rotation);
  acc = moved(acc, t.position);
  return acc;
}

export function applyInverse(solid: Solid, t: Xform): Solid {
  let acc = moved(solid, [-t.position[0], -t.position[1], -t.position[2]]);
  acc = turned(acc, [0, 0, -t.rotation[2]]);
  acc = turned(acc, [0, -t.rotation[1], 0]);
  acc = turned(acc, [-t.rotation[0], 0, 0]);
  const sx = Math.abs(t.scale[0]) < 1e-6 ? 1 : 1 / t.scale[0];
  const sy = Math.abs(t.scale[1]) < 1e-6 ? 1 : 1 / t.scale[1];
  const sz = Math.abs(t.scale[2]) < 1e-6 ? 1 : 1 / t.scale[2];
  acc = scaled(acc, [sx, sy, sz]);
  return acc;
}

export function fromIndexed(positions: Float32Array, indices: Uint32Array): Solid {
  const mesh = new (A().Mesh)({ numProp: 3, vertProperties: positions, triVerts: indices });
  return new (A().Manifold)(mesh);
}

export function meshOf(solid: Solid): MeshData {
  const mesh = solid.getMesh();
  const tv = mesh.triVerts;
  const vp = mesh.vertProperties;
  const np = mesh.numProp;
  const positions = new Float32Array(tv.length * 3);
  for (let i = 0; i < tv.length; i++) {
    const o = tv[i] * np;
    positions[i * 3] = vp[o];
    positions[i * 3 + 1] = vp[o + 1];
    positions[i * 3 + 2] = vp[o + 2];
  }
  const bb = solid.boundingBox();
  return {
    positions,
    triangles: tv.length / 3,
    volume: solid.volume(),
    bbox: {
      min: [bb.min[0], bb.min[1], bb.min[2]],
      max: [bb.max[0], bb.max[1], bb.max[2]],
    },
  };
}

export function solidStatus(solid: Solid): string {
  return solid.status();
}
