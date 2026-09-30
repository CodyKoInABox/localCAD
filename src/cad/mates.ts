import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { Document, Feature, Mate, Vec3, Xform } from './types.ts';
import { deg2rad, rad2deg } from './math.ts';

export type MateMap = Map<string, Mate[]>;

function featureOf(doc: Document, id: string): Feature | undefined {
  return doc.features.find((f) => f.id === id);
}

function basisFrom(xAxis: Vector3, zAxis: Vector3): Matrix4 {
  const z = zAxis.clone().normalize();
  const x = xAxis.clone();
  x.addScaledVector(z, -x.dot(z));
  if (x.lengthSq() < 1e-8) {
    const helper = Math.abs(z.z) < 0.9 ? new Vector3(0, 0, 1) : new Vector3(1, 0, 0);
    x.crossVectors(helper, z);
  }
  x.normalize();
  const y = new Vector3().crossVectors(z, x).normalize();
  return new Matrix4().makeBasis(x, y, z);
}

function rotationOf(t: Xform): Matrix4 {
  const e = new Euler(deg2rad(t.rotation[0]), deg2rad(t.rotation[1]), deg2rad(t.rotation[2]), 'ZYX');
  return new Matrix4().makeRotationFromEuler(e);
}

function worldFrame(t: Xform, mate: Mate): { origin: Vector3; x: Vector3; z: Vector3 } {
  const R = rotationOf(t);
  const S = new Matrix4().makeScale(t.scale[0], t.scale[1], t.scale[2]);
  const RS = new Matrix4().multiplyMatrices(R, S);
  const origin = new Vector3(...mate.origin).applyMatrix4(RS).add(new Vector3(...t.position));
  const z = new Vector3(...mate.axis).applyMatrix4(RS);
  const x = new Vector3(...mate.xAxis).applyMatrix4(RS);
  return { origin, x, z };
}

function eulerOf(m: Matrix4): Vec3 {
  const q = new Quaternion().setFromRotationMatrix(m);
  const e = new Euler().setFromQuaternion(q, 'ZYX');
  return [rad2deg(e.x), rad2deg(e.y), rad2deg(e.z)];
}

export function solveMates(doc: Document, mates: MateMap): string[] {
  const warnings: string[] = [];
  const live = doc.mates.filter((m) => m.live);
  const pending = [...live];
  const done = new Set<string>();
  let guard = 0;
  while (pending.length && guard++ < pending.length * 4) {
    let progress = false;
    for (let i = 0; i < pending.length; i++) {
      const mate = pending[i];
      if (done.has(mate.id)) continue;
      const fixedDriven = live.some((m) => m.movingId === mate.fixedId && !done.has(m.id) && m.id !== mate.id);
      if (fixedDriven) continue;
      const moving = featureOf(doc, mate.movingId);
      const fixed = featureOf(doc, mate.fixedId);
      if (!moving || !fixed) {
        warnings.push('A mate points at a missing part.');
        done.add(mate.id);
        progress = true;
        continue;
      }
      if (moving.locked) {
        done.add(mate.id);
        progress = true;
        continue;
      }
      const movingDef = (mates.get(moving.id) ?? []).find((m) => m.id === mate.movingMate);
      const fixedDef = (mates.get(fixed.id) ?? []).find((m) => m.id === mate.fixedMate);
      if (!movingDef || !fixedDef) {
        warnings.push(`Mate frames are missing on ${moving.name} or ${fixed.name}.`);
        done.add(mate.id);
        progress = true;
        continue;
      }
      const fixedFrame = worldFrame(fixed.transform, fixedDef);
      const local = worldFrame({ ...moving.transform, position: [0, 0, 0], rotation: [0, 0, 0] }, movingDef);
      const tz = fixedFrame.z.clone().normalize();
      const tx = fixedFrame.x.clone();
      if (mate.flip) tz.negate();
      tx.addScaledVector(tz, -tx.dot(tz));
      if (tx.lengthSq() < 1e-8) tx.set(1, 0, 0);
      tx.normalize();
      tx.applyAxisAngle(tz, deg2rad(mate.spin));
      const target = basisFrom(tx, tz);
      const source = basisFrom(local.x, local.z);
      const R = new Matrix4().multiplyMatrices(target, source.clone().invert());
      const scaledOrigin = new Vector3(...movingDef.origin);
      scaledOrigin.x *= moving.transform.scale[0];
      scaledOrigin.y *= moving.transform.scale[1];
      scaledOrigin.z *= moving.transform.scale[2];
      const rotated = scaledOrigin.clone().applyMatrix4(R);
      const origin = fixedFrame.origin.clone().addScaledVector(tz, mate.distance);
      moving.transform.rotation = eulerOf(R);
      moving.transform.position = [origin.x - rotated.x, origin.y - rotated.y, origin.z - rotated.z];
      done.add(mate.id);
      progress = true;
    }
    if (!progress) break;
  }
  if (pending.some((m) => !done.has(m.id))) warnings.push('A mate loop was left unsolved.');
  return warnings;
}
