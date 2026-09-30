import type { Box, Vec2, Vec3, Xform } from './types.ts';

export function clamp(n: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, n));
}

export function num(p: Record<string, number | boolean | string>, key: string, fallback = 0): number {
  const v = p[key];
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export function int(p: Record<string, number | boolean | string>, key: string, fallback = 0): number {
  return Math.round(num(p, key, fallback));
}

export function bool(p: Record<string, number | boolean | string>, key: string, fallback = false): boolean {
  const v = p[key];
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return fallback;
}

export function str(p: Record<string, number | boolean | string>, key: string, fallback = ''): string {
  const v = p[key];
  return typeof v === 'string' ? v : fallback;
}

export function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}

export function rad2deg(r: number): number {
  return (r * 180) / Math.PI;
}

/** Right-handed X then Y then Z, matching Manifold.rotate and Three.js Euler order ZYX. */
export function transformPoint(x: number, y: number, z: number, t: Xform): Vec3 {
  let X = x * t.scale[0];
  let Y = y * t.scale[1];
  let Z = z * t.scale[2];
  const rx = deg2rad(t.rotation[0]);
  const ry = deg2rad(t.rotation[1]);
  const rz = deg2rad(t.rotation[2]);
  const cx = Math.cos(rx);
  const sx = Math.sin(rx);
  const y1 = Y * cx - Z * sx;
  const z1 = Y * sx + Z * cx;
  Y = y1;
  Z = z1;
  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  const x2 = X * cy + Z * sy;
  const z2 = -X * sy + Z * cy;
  X = x2;
  Z = z2;
  const cz = Math.cos(rz);
  const sz = Math.sin(rz);
  const x3 = X * cz - Y * sz;
  const y3 = X * sz + Y * cz;
  return [x3 + t.position[0], y3 + t.position[1], Z + t.position[2]];
}

export function transformPositions(src: Float32Array, t: Xform): Float32Array {
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i += 3) {
    const p = transformPoint(src[i], src[i + 1], src[i + 2], t);
    out[i] = p[0];
    out[i + 1] = p[1];
    out[i + 2] = p[2];
  }
  return out;
}

export function boundsOf(positions: Float32Array): Box {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }
  if (!Number.isFinite(minX)) {
    return { min: [0, 0, 0], max: [0, 0, 0] };
  }
  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
}

export function worldBounds(positions: Float32Array, t: Xform): Box {
  return boundsOf(transformPositions(positions, t));
}

export function rot2(p: Vec2, radians: number): Vec2 {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
}

export function seg(radius: number): number {
  const edge = 0.55;
  const n = Math.ceil((2 * Math.PI * Math.max(radius, 0.4)) / edge);
  const rounded = Math.ceil(n / 4) * 4;
  return clamp(rounded, 16, 128);
}

export function circlePoly(r: number, n = 0, cx = 0, cy = 0): Vec2[] {
  const count = n || seg(r);
  const pts: Vec2[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

export function hexPoly(acrossFlats: number): Vec2[] {
  const r = acrossFlats / Math.sqrt(3);
  const pts: Vec2[] = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

export function obround(length: number, width: number, steps = 8): Vec2[] {
  const r = width / 2;
  const span = Math.max(0, length / 2 - r);
  const pts: Vec2[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / steps;
    pts.push([span + Math.cos(a) * r, Math.sin(a) * r]);
  }
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / steps;
    pts.push([-span + Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

export function zMates(length: number): import('./types.ts').Mate[] {
  return [
    { id: 'start', label: 'Start', origin: [0, 0, 0], axis: [0, 0, 1], xAxis: [1, 0, 0] },
    { id: 'mid', label: 'Middle', origin: [0, 0, length / 2], axis: [0, 0, 1], xAxis: [1, 0, 0] },
    { id: 'end', label: 'End', origin: [0, 0, length], axis: [0, 0, 1], xAxis: [1, 0, 0] },
  ];
}

export function axisMate(id: string, label: string, origin: Vec3, axis: Vec3, xAxis: Vec3 = [1, 0, 0]) {
  return { id, label, origin, axis, xAxis };
}
