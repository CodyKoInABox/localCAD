import type { Mate, Params, PartModule } from '../cad/types.ts';
import { bool, clamp, hexPoly, int, num, seg, zMates } from '../cad/math.ts';
import * as K from '../cad/kernel.ts';

function boreCut(length: number, diameter: number): K.Solid {
  return K.moved(K.cylinder(length + 2, diameter / 2, diameter / 2, seg(diameter / 2)), [0, 0, -1]);
}

export const straightShaft: PartModule = {
  id: 'straight-shaft',
  name: 'Straight shaft',
  category: 'Shafts',
  blurb: 'Round shaft with optional flats and a cross hole.',
  help: 'Axis +Z from the bed. A flat is for a set screw. Rotate −90° about X to lay it along +Y for an axle.',
  tags: ['shaft', 'axle', 'rod'],
  color: '#8d97a3',
  params: [
    { key: 'diameter', label: 'Diameter', type: 'number', default: 4, min: 1, max: 30, step: 0.1, unit: 'mm' },
    { key: 'length', label: 'Length', type: 'number', default: 40, min: 2, max: 300, step: 1, unit: 'mm' },
    { key: 'flats', label: 'Flats', type: 'int', default: 0, min: 0, max: 2 },
    { key: 'flatDepth', label: 'Flat depth', type: 'number', default: 0.5, min: 0.1, max: 5, step: 0.1, unit: 'mm' },
    { key: 'flatLen', label: 'Flat length', type: 'number', default: 10, min: 1, max: 80, step: 0.5, unit: 'mm' },
    { key: 'crossHole', label: 'Cross hole', type: 'number', default: 0, min: 0, max: 8, step: 0.1, unit: 'mm', help: '0 disables it. Drilled through Y at mid length.' },
    { key: 'chamfer', label: 'End chamfer', type: 'number', default: 0.3, min: 0, max: 2, step: 0.1, unit: 'mm' },
  ],
  build: (p) => {
    const d = clamp(num(p, 'diameter', 4), 1, 40);
    const length = clamp(num(p, 'length', 40), 1, 400);
    const flats = clamp(int(p, 'flats', 0), 0, 2);
    const flatDepth = clamp(num(p, 'flatDepth', 0.5), 0.05, d / 2);
    const flatLen = clamp(num(p, 'flatLen', 10), 0.5, length);
    const cross = clamp(num(p, 'crossHole', 0), 0, d * 0.8);
    const chamfer = clamp(num(p, 'chamfer', 0.3), 0, d / 3);
    let solid = K.cylinder(length, d / 2, d / 2, seg(d / 2));
    if (chamfer > 0.05) {
      const c1 = K.cylinder(chamfer + 0.1, d / 2 + 0.2, d / 2 - chamfer, seg(d / 2));
      const c2 = K.moved(K.cylinder(chamfer + 0.1, d / 2 - chamfer, d / 2 + 0.2, seg(d / 2)), [0, 0, length - chamfer]);
      solid = K.subtract(solid, [K.moved(c1, [0, 0, -0.05]), c2]);
    }
    for (let i = 0; i < flats; i++) {
      const cutter = K.box([d + 2, d, flatLen], false);
      const y = d / 2 - flatDepth;
      let piece = K.moved(cutter, [-d / 2 - 1, y, (length - flatLen) / 2]);
      if (i === 1) piece = K.moved(piece, [0, -(d - 2 * flatDepth), 0]);
      solid = K.subtract(solid, [piece]);
    }
    if (cross > 0.2) {
      const hole = K.turned(K.cylinder(d + 4, cross / 2, cross / 2, seg(cross / 2), true), [90, 0, 0]);
      solid = K.subtract(solid, [K.moved(hole, [0, 0, length / 2])]);
    }
    return { solid, mates: zMates(length) };
  },
};

export const steppedShaft: PartModule = {
  id: 'stepped-shaft',
  name: 'Stepped shaft',
  category: 'Shafts',
  blurb: 'Three diameters for bearings, gears, and a shoulder.',
  help: 'Sections stack along +Z: A at the bed, then B, then C. Shoulders locate bearings and gears.',
  tags: ['shaft', 'stepped', 'shoulder'],
  color: '#7f8b99',
  params: [
    { key: 'd1', label: 'Diameter A', type: 'number', default: 4, min: 1, max: 30, step: 0.1, unit: 'mm' },
    { key: 'l1', label: 'Length A', type: 'number', default: 8, min: 1, max: 120, step: 0.5, unit: 'mm' },
    { key: 'd2', label: 'Diameter B', type: 'number', default: 6, min: 1, max: 40, step: 0.1, unit: 'mm' },
    { key: 'l2', label: 'Length B', type: 'number', default: 16, min: 1, max: 120, step: 0.5, unit: 'mm' },
    { key: 'd3', label: 'Diameter C', type: 'number', default: 4, min: 1, max: 30, step: 0.1, unit: 'mm' },
    { key: 'l3', label: 'Length C', type: 'number', default: 8, min: 1, max: 120, step: 0.5, unit: 'mm' },
  ],
  build: (p) => {
    const ds = [clamp(num(p, 'd1', 4), 1, 40), clamp(num(p, 'd2', 6), 1, 50), clamp(num(p, 'd3', 4), 1, 40)];
    const ls = [clamp(num(p, 'l1', 8), 0.5, 150), clamp(num(p, 'l2', 16), 0.5, 150), clamp(num(p, 'l3', 8), 0.5, 150)];
    let z = 0;
    const parts: K.Solid[] = [];
    for (let i = 0; i < 3; i++) {
      parts.push(K.moved(K.cylinder(ls[i] + 0.04, ds[i] / 2, ds[i] / 2, seg(ds[i] / 2)), [0, 0, z]));
      z += ls[i];
    }
    return { solid: K.union(parts), mates: zMates(ls[0] + ls[1] + ls[2]) };
  },
};

export const dShaft: PartModule = {
  id: 'd-shaft',
  name: 'D shaft',
  category: 'Shafts',
  blurb: 'Round shaft with one full-length flat.',
  help: 'The flat clocks gears and wheels. Depth is how far the flat cuts in from the outside.',
  tags: ['shaft', 'd', 'flat'],
  color: '#8d97a3',
  params: [
    { key: 'diameter', label: 'Diameter', type: 'number', default: 5, min: 2, max: 20, step: 0.1, unit: 'mm' },
    { key: 'length', label: 'Length', type: 'number', default: 30, min: 4, max: 200, step: 1, unit: 'mm' },
    { key: 'flat', label: 'Flat depth', type: 'number', default: 0.6, min: 0.15, max: 4, step: 0.05, unit: 'mm' },
  ],
  build: (p) => {
    const d = clamp(num(p, 'diameter', 5), 1.5, 30);
    const length = clamp(num(p, 'length', 30), 2, 250);
    const flat = clamp(num(p, 'flat', 0.6), 0.1, d / 2 - 0.2);
    let solid = K.cylinder(length, d / 2, d / 2, seg(d / 2));
    const cutter = K.moved(K.box([d + 2, d, length + 2], false), [-1 - d / 2, d / 2 - flat, -1]);
    solid = K.subtract(solid, [cutter]);
    return { solid, mates: zMates(length) };
  },
};

export const keyedShaft: PartModule = {
  id: 'keyed-shaft',
  name: 'Keyed shaft',
  category: 'Shafts',
  blurb: 'Shaft with a sled keyseat.',
  help: 'The keyseat is a pocket, not a through slot. Pair it with a gear that has a keyway of the same width.',
  tags: ['shaft', 'key', 'keyseat'],
  color: '#808a96',
  params: [
    { key: 'diameter', label: 'Diameter', type: 'number', default: 8, min: 3, max: 30, step: 0.1, unit: 'mm' },
    { key: 'length', label: 'Length', type: 'number', default: 40, min: 8, max: 200, step: 1, unit: 'mm' },
    { key: 'keyW', label: 'Key width', type: 'number', default: 2, min: 0.8, max: 8, step: 0.1, unit: 'mm' },
    { key: 'keyD', label: 'Key depth', type: 'number', default: 1.2, min: 0.3, max: 5, step: 0.1, unit: 'mm' },
    { key: 'keyL', label: 'Key length', type: 'number', default: 12, min: 2, max: 80, step: 0.5, unit: 'mm' },
  ],
  build: (p) => {
    const d = clamp(num(p, 'diameter', 8), 3, 40);
    const length = clamp(num(p, 'length', 40), 4, 250);
    const keyW = clamp(num(p, 'keyW', 2), 0.5, d);
    const keyD = clamp(num(p, 'keyD', 1.2), 0.2, d / 2);
    const keyL = clamp(num(p, 'keyL', 12), 1, length);
    let solid = K.cylinder(length, d / 2, d / 2, seg(d / 2));
    const seat = K.moved(K.box([keyD + 0.2, keyW, keyL], false), [d / 2 - keyD, -keyW / 2, (length - keyL) / 2]);
    solid = K.subtract(solid, [seat]);
    return { solid, mates: zMates(length) };
  },
};

export const splineShaft: PartModule = {
  id: 'spline-shaft',
  name: 'Spline shaft',
  category: 'Shafts',
  blurb: 'Six-spline shaft for a printed hub.',
  help: 'The mate hub should use a matching spline bore. Root diameter is the round core; the spline adds on top.',
  tags: ['shaft', 'spline'],
  color: '#97a0aa',
  params: [
    { key: 'root', label: 'Root diameter', type: 'number', default: 6, min: 3, max: 20, step: 0.1, unit: 'mm' },
    { key: 'length', label: 'Length', type: 'number', default: 25, min: 4, max: 120, step: 1, unit: 'mm' },
    { key: 'teeth', label: 'Splines', type: 'int', default: 6, min: 4, max: 8 },
    { key: 'height', label: 'Spline height', type: 'number', default: 0.8, min: 0.3, max: 2, step: 0.1, unit: 'mm' },
  ],
  build: (p) => {
    const root = clamp(num(p, 'root', 6), 2, 30);
    const length = clamp(num(p, 'length', 25), 3, 160);
    const teeth = clamp(int(p, 'teeth', 6), 4, 8);
    const height = clamp(num(p, 'height', 0.8), 0.2, 3);
    const parts: K.Solid[] = [K.cylinder(length, root / 2, root / 2, seg(root / 2))];
    const toothW = (Math.PI * root) / teeth * 0.38;
    for (let i = 0; i < teeth; i++) {
      const tooth = K.moved(K.box([height + 0.05, toothW, length], false), [root / 2 - 0.05, -toothW / 2, 0]);
      parts.push(K.turned(tooth, [0, 0, (360 / teeth) * i]));
    }
    return { solid: K.union(parts), mates: zMates(length) };
  },
};

export const groovedShaft: PartModule = {
  id: 'grooved-shaft',
  name: 'Grooved shaft',
  category: 'Shafts',
  blurb: 'Shaft with circlip grooves.',
  help: 'Grooves are sized for a printed ring or an E-clip. Two grooves by default, inset from the ends.',
  tags: ['shaft', 'circlip', 'e-clip', 'axle'],
  color: '#8d97a3',
  params: [
    { key: 'diameter', label: 'Diameter', type: 'number', default: 5, min: 2, max: 20, step: 0.1, unit: 'mm' },
    { key: 'length', label: 'Length', type: 'number', default: 50, min: 10, max: 200, step: 1, unit: 'mm' },
    { key: 'grooveD', label: 'Groove depth', type: 'number', default: 0.4, min: 0.15, max: 2, step: 0.05, unit: 'mm' },
    { key: 'grooveW', label: 'Groove width', type: 'number', default: 0.8, min: 0.3, max: 3, step: 0.1, unit: 'mm' },
    { key: 'inset', label: 'Inset from ends', type: 'number', default: 2, min: 0.4, max: 30, step: 0.2, unit: 'mm' },
  ],
  build: (p) => {
    const d = clamp(num(p, 'diameter', 5), 2, 30);
    const length = clamp(num(p, 'length', 50), 6, 250);
    const depth = clamp(num(p, 'grooveD', 0.4), 0.1, d / 3);
    const width = clamp(num(p, 'grooveW', 0.8), 0.2, 4);
    const inset = clamp(num(p, 'inset', 2), 0.3, length / 3);
    let solid = K.cylinder(length, d / 2, d / 2, seg(d / 2));
    const groove = (z: number) => {
      let ring = K.cylinder(width, d / 2 + 0.2, d / 2 + 0.2, seg(d / 2));
      ring = K.subtract(ring, [K.moved(K.cylinder(width + 1, d / 2 - depth, d / 2 - depth, seg(d / 2)), [0, 0, -0.5])]);
      return K.moved(ring, [0, 0, z]);
    };
    solid = K.subtract(solid, [groove(inset), groove(length - inset - width)]);
    return { solid, mates: zMates(length) };
  },
};

function threadProfile(minorR: number, majorR: number, pitch: number) {
  const half = pitch * 0.2;
  const bump: [number, number][] = [
    [minorR, -half],
    [majorR, -half * 0.4],
    [majorR, half * 0.4],
    [minorR, half],
  ];
  return K.profileAdd(K.circle(minorR, seg(minorR)), K.section(bump));
}

export function threadedCylinder(major: number, pitch: number, length: number, bore = 0): K.Solid {
  const minor = Math.max(0.6, major - pitch * 0.85);
  const turns = Math.max(1, length / pitch);
  const div = clamp(Math.ceil(turns * 14), 8, 180);
  let solid = K.extrude(threadProfile(minor / 2, major / 2, pitch), length, div, turns * 360);
  if (bore > 0.2) solid = K.subtract(solid, [boreCut(length, bore)]);
  return solid;
}

export const threadedRod: PartModule = {
  id: 'threaded-rod',
  name: 'Threaded rod',
  category: 'Shafts',
  blurb: 'Cosmetic metric thread you can actually print coarse.',
  help: 'Pitch follows the selected metric size. Fine pitches under 0.6 mm will look faceted. Axis +Z.',
  tags: ['thread', 'rod', 'metric'],
  color: '#aeb6bf',
  params: [
    { key: 'size', label: 'Size', type: 'select', default: 'M4', options: ['M3', 'M4', 'M5', 'M6', 'M8'].map((v) => ({ value: v, label: v })) },
    { key: 'length', label: 'Length', type: 'number', default: 20, min: 4, max: 80, step: 1, unit: 'mm' },
  ],
  build: (p) => {
    const size = strSize(p);
    const length = clamp(num(p, 'length', 20), 3, 100);
    return { solid: threadedCylinder(size.d, size.pitch, length), mates: zMates(length) };
  },
};

export const dowel: PartModule = {
  id: 'dowel-pin',
  name: 'Dowel pin',
  category: 'Shafts',
  blurb: 'Plain pin with chamfered ends.',
  help: 'Use it as a hinge pin or a locating dowel. Axis +Z.',
  tags: ['pin', 'dowel'],
  color: '#c5ccd3',
  params: [
    { key: 'diameter', label: 'Diameter', type: 'number', default: 3, min: 1, max: 12, step: 0.1, unit: 'mm' },
    { key: 'length', label: 'Length', type: 'number', default: 16, min: 2, max: 80, step: 0.5, unit: 'mm' },
  ],
  build: (p) => {
    const d = clamp(num(p, 'diameter', 3), 0.8, 16);
    const length = clamp(num(p, 'length', 16), 2, 100);
    const c = Math.min(0.4, d * 0.15);
    let solid = K.cylinder(length, d / 2, d / 2, seg(d / 2));
    solid = K.subtract(solid, [
      K.moved(K.cylinder(c + 0.05, d / 2 + 0.1, d / 2 - c, seg(d / 2)), [0, 0, -0.02]),
      K.moved(K.cylinder(c + 0.05, d / 2 - c, d / 2 + 0.1, seg(d / 2)), [0, 0, length - c]),
    ]);
    return { solid, mates: zMates(length) };
  },
};

export function metricSize(name: string): { d: number; pitch: number; head: number; headH: number; hex: number; nutH: number; washerOD: number; washerT: number; socket: number; cs: number; csH: number } {
  const table: Record<string, [number, number, number, number, number, number, number, number, number, number, number]> = {
    M2: [2, 0.4, 3.8, 2, 4, 1.6, 5, 0.3, 1.5, 3.8, 1.2],
    M2_5: [2.5, 0.45, 4.5, 2.5, 5, 2, 6.5, 0.5, 2, 4.7, 1.5],
    M3: [3, 0.5, 5.5, 3, 5.5, 2.4, 7, 0.5, 2.5, 5.6, 1.65],
    M4: [4, 0.7, 7, 4, 7, 3.2, 9, 0.8, 3, 7.5, 2.2],
    M5: [5, 0.8, 8.5, 5, 8, 4.7, 10, 1, 4, 9.2, 2.5],
    M6: [6, 1, 10, 6, 10, 5.2, 12, 1.6, 5, 11, 3.3],
    M8: [8, 1.25, 13, 8, 13, 6.8, 16, 1.6, 6, 14.5, 4.4],
  };
  const key = name === 'M2.5' ? 'M2_5' : name;
  const row = table[key] ?? table.M3;
  return { d: row[0], pitch: row[1], head: row[2], headH: row[3], hex: row[4], nutH: row[5], washerOD: row[6], washerT: row[7], socket: row[8], cs: row[9], csH: row[10] };
}

function strSize(p: Params) {
  return metricSize(String(p.size ?? 'M4'));
}

export const shaftParts: PartModule[] = [straightShaft, steppedShaft, dShaft, keyedShaft, splineShaft, groovedShaft, threadedRod, dowel];

export { hexPoly };
