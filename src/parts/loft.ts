import type { Vec3 } from '../cad/types.ts';
import * as K from '../cad/kernel.ts';

export function loftSolid(rings: Vec3[][]): K.Solid {
  const m = rings[0].length;
  if (rings.some((r) => r.length !== m)) throw new Error('Loft rings must share a point count');
  const n = rings.length;
  const pos = new Float32Array(n * m * 3);
  let w = 0;
  for (const ring of rings) {
    for (const p of ring) {
      pos[w++] = p[0];
      pos[w++] = p[1];
      pos[w++] = p[2];
    }
  }
  const idx: number[] = [];
  const vi = (i: number, j: number) => i * m + (j % m);
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < m; j++) {
      const a = vi(i, j);
      const b = vi(i, j + 1);
      const c = vi(i + 1, j + 1);
      const d = vi(i + 1, j);
      idx.push(a, d, b, b, d, c);
    }
  }
  for (let j = 1; j < m - 1; j++) idx.push(0, j, j + 1);
  const last = (n - 1) * m;
  for (let j = 1; j < m - 1; j++) idx.push(last, last + j + 1, last + j);

  if (signedVolume(pos, idx) < 0) {
    for (let i = 0; i < idx.length; i += 3) {
      const tmp = idx[i + 1];
      idx[i + 1] = idx[i + 2];
      idx[i + 2] = tmp;
    }
  }
  return K.fromIndexed(pos, new Uint32Array(idx));
}

function signedVolume(pos: Float32Array, idx: number[]): number {
  let v = 0;
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3;
    const b = idx[i + 1] * 3;
    const c = idx[i + 2] * 3;
    const ax = pos[a];
    const ay = pos[a + 1];
    const az = pos[a + 2];
    v += ax * (pos[b + 1] * pos[c + 2] - pos[b + 2] * pos[c + 1]);
    v -= ay * (pos[b] * pos[c + 2] - pos[b + 2] * pos[c]);
    v += az * (pos[b] * pos[c + 1] - pos[b + 1] * pos[c]);
  }
  return v / 6;
}
