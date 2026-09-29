import type { Mate, Params, PartModule } from '../cad/types.ts';
import { axisMate, bool, clamp, hexPoly, num, seg, str } from '../cad/math.ts';
import * as K from '../cad/kernel.ts';
import { metricSize, threadedCylinder } from './shafts.ts';

const SIZES = ['M2', 'M2.5', 'M3', 'M4', 'M5', 'M6', 'M8'].map((v) => ({ value: v, label: v }));

function sizeOf(p: Params) {
  return metricSize(str(p, 'size', 'M3'));
}

function shank(d: number, length: number, threaded: boolean, pitch: number): K.Solid {
  if (!threaded || length < pitch * 2) return K.cylinder(length, d / 2, d / 2, seg(d / 2));
  return threadedCylinder(d, pitch, length);
}

export const socketScrew: PartModule = {
  id: 'socket-screw',
  name: 'Socket head screw',
  category: 'Fasteners',
  blurb: 'ISO-ish socket cap screw. Head on the bed, shank up.',
  help: 'Length is the shank under the head. Seat mate is the bearing face, axis pointing along the shank. Turn threads off for a fast clearance model.',
  tags: ['bolt', 'screw', 'socket', 'm3'],
  color: '#6e7f8d',
  params: [
    { key: 'size', label: 'Size', type: 'select', default: 'M3', options: SIZES },
    { key: 'length', label: 'Shank length', type: 'number', default: 10, min: 3, max: 50, step: 1, unit: 'mm' },
    { key: 'threads', label: 'Model threads', type: 'bool', default: false },
  ],
  build: (p) => {
    const s = sizeOf(p);
    const length = clamp(num(p, 'length', 10), 2, 60);
    const head = K.cylinder(s.headH, s.head / 2, s.head / 2, seg(s.head / 2));
    let socket = K.extrude(K.section(hexPoly(s.socket)), s.headH * 0.55 + 0.2);
    socket = K.moved(socket, [0, 0, -0.1]);
    const headCut = K.subtract(head, [socket]);
    const body = K.moved(shank(s.d, length + 0.05, bool(p, 'threads', false), s.pitch), [0, 0, s.headH - 0.05]);
    const mates: Mate[] = [
      axisMate('seat', 'Seat', [0, 0, s.headH], [0, 0, 1]),
      axisMate('head', 'Head top', [0, 0, 0], [0, 0, -1], [1, 0, 0]),
    ];
    return { solid: K.union([headCut, body]), mates };
  },
};

export const hexBolt: PartModule = {
  id: 'hex-bolt',
  name: 'Hex bolt',
  category: 'Fasteners',
  blurb: 'Hex head bolt, head on the bed.',
  help: 'Across-flats follows the metric size. Length is under the head.',
  tags: ['bolt', 'hex'],
  color: '#7d8b98',
  params: [
    { key: 'size', label: 'Size', type: 'select', default: 'M4', options: SIZES },
    { key: 'length', label: 'Shank length', type: 'number', default: 12, min: 4, max: 60, step: 1, unit: 'mm' },
    { key: 'threads', label: 'Model threads', type: 'bool', default: false },
  ],
  build: (p) => {
    const s = sizeOf(p);
    const length = clamp(num(p, 'length', 12), 2, 70);
    const head = K.extrude(K.section(hexPoly(s.hex)), s.headH * 0.7);
    const body = K.moved(shank(s.d, length + 0.05, bool(p, 'threads', false), s.pitch), [0, 0, s.headH * 0.7 - 0.05]);
    return { solid: K.union([head, body]), mates: [axisMate('seat', 'Seat', [0, 0, s.headH * 0.7], [0, 0, 1])] };
  },
};

export const countersunk: PartModule = {
  id: 'countersunk-screw',
  name: 'Countersunk screw',
  category: 'Fasteners',
  blurb: 'Flat head screw. The head is included in the overall length.',
  help: 'Origin is the top of the head, on the bed if you flip it. Axis +Z goes through the head into the shank.',
  tags: ['screw', 'countersunk', 'flathead'],
  color: '#738290',
  params: [
    { key: 'size', label: 'Size', type: 'select', default: 'M3', options: SIZES },
    { key: 'length', label: 'Overall length', type: 'number', default: 12, min: 4, max: 50, step: 1, unit: 'mm' },
  ],
  build: (p) => {
    const s = sizeOf(p);
    const length = clamp(num(p, 'length', 12), s.csH + 2, 60);
    const head = K.cylinder(s.csH, s.cs / 2, s.d / 2, seg(s.cs / 2));
    const body = K.moved(K.cylinder(length - s.csH + 0.05, s.d / 2, s.d / 2, seg(s.d / 2)), [0, 0, s.csH - 0.05]);
    return { solid: K.union([head, body]), mates: [axisMate('top', 'Head top', [0, 0, 0], [0, 0, 1])] };
  },
};

export const grubScrew: PartModule = {
  id: 'grub-screw',
  name: 'Grub screw',
  category: 'Fasteners',
  blurb: 'Headless set screw with a hex socket.',
  help: 'Socket depth is about half the length. Use it in the coupler set-screw hole.',
  tags: ['setscrew', 'grub'],
  color: '#667584',
  params: [
    { key: 'size', label: 'Size', type: 'select', default: 'M3', options: SIZES },
    { key: 'length', label: 'Length', type: 'number', default: 4, min: 2, max: 20, step: 0.5, unit: 'mm' },
  ],
  build: (p) => {
    const s = sizeOf(p);
    const length = clamp(num(p, 'length', 4), 2, 25);
    let solid = K.cylinder(length, s.d / 2, s.d / 2, seg(s.d / 2));
    const socket = K.moved(K.extrude(K.section(hexPoly(s.socket)), Math.min(length * 0.55, s.d)), [0, 0, length - Math.min(length * 0.5, s.d * 0.9)]);
    solid = K.subtract(solid, [socket]);
    return { solid, mates: [axisMate('tip', 'Tip', [0, 0, 0], [0, 0, 1])] };
  },
};

export const hexNut: PartModule = {
  id: 'hex-nut',
  name: 'Hex nut',
  category: 'Fasteners',
  blurb: 'Hex nut with a clearance or printed thread.',
  help: 'Across-flats is the wrench size. The hole is the nominal diameter plus a hair unless threads are on.',
  tags: ['nut', 'hex'],
  color: '#7b8792',
  params: [
    { key: 'size', label: 'Size', type: 'select', default: 'M3', options: SIZES },
    { key: 'threads', label: 'Model threads', type: 'bool', default: false },
  ],
  build: (p) => {
    const s = sizeOf(p);
    let solid = K.extrude(K.section(hexPoly(s.hex)), s.nutH);
    const hole = bool(p, 'threads', false)
      ? K.moved(threadedCylinder(s.d, s.pitch, s.nutH + 2), [0, 0, -1])
      : K.moved(K.cylinder(s.nutH + 2, s.d / 2 + 0.15, s.d / 2 + 0.15, seg(s.d / 2)), [0, 0, -1]);
    solid = K.subtract(solid, [hole]);
    return { solid, mates: [axisMate('axis', 'Axis', [0, 0, s.nutH / 2], [0, 0, 1])] };
  },
};

export const washer: PartModule = {
  id: 'washer',
  name: 'Washer',
  category: 'Fasteners',
  blurb: 'Plain washer for the selected metric size.',
  help: 'Inside diameter is the nominal screw plus clearance.',
  tags: ['washer'],
  color: '#b7c0c8',
  params: [{ key: 'size', label: 'Size', type: 'select', default: 'M3', options: SIZES }],
  build: (p) => {
    const s = sizeOf(p);
    let solid = K.cylinder(s.washerT, s.washerOD / 2, s.washerOD / 2, seg(s.washerOD / 2));
    solid = K.subtract(solid, [K.moved(K.cylinder(s.washerT + 2, s.d / 2 + 0.2, s.d / 2 + 0.2, seg(s.d / 2)), [0, 0, -1])]);
    return { solid, mates: [axisMate('axis', 'Axis', [0, 0, s.washerT / 2], [0, 0, 1])] };
  },
};

const HEATSET: Record<string, { od: number; len: number }> = {
  M2: { od: 3.5, len: 3 },
  'M2.5': { od: 4.2, len: 3.5 },
  M3: { od: 4.6, len: 4 },
  M4: { od: 6.3, len: 5 },
  M5: { od: 7.1, len: 6.5 },
};

export const heatset: PartModule = {
  id: 'heatset-insert',
  name: 'Heat-set insert',
  category: 'Fasteners',
  blurb: 'Brass-insert envelope for fit checks.',
  help: 'This is the insert itself, not the hole. Use the heat-set cavity and subtract that from the plastic.',
  tags: ['heatset', 'insert', 'brass'],
  color: '#c4a574',
  params: [{ key: 'size', label: 'Size', type: 'select', default: 'M3', options: SIZES.filter((s) => s.value !== 'M6' && s.value !== 'M8') }],
  build: (p) => {
    const spec = HEATSET[str(p, 'size', 'M3')] ?? HEATSET.M3;
    const s = sizeOf(p);
    let solid = K.cylinder(spec.len, spec.od / 2, spec.od / 2 - 0.15, seg(spec.od / 2));
    solid = K.subtract(solid, [K.moved(K.cylinder(spec.len + 2, s.d / 2, s.d / 2, seg(s.d / 2)), [0, 0, -1])]);
    return { solid, mates: [axisMate('top', 'Top', [0, 0, spec.len], [0, 0, 1])] };
  },
};

export const heatsetCavity: PartModule = {
  id: 'heatset-cavity',
  name: 'Heat-set cavity',
  category: 'Fasteners',
  blurb: 'Tapered hole to subtract for a brass insert.',
  help: 'Place it, mate it into the boss, then Subtract with the plastic as the base. The taper is wider at the top.',
  tags: ['heatset', 'cavity', 'subtract'],
  color: '#d07a45',
  params: [{ key: 'size', label: 'Size', type: 'select', default: 'M3', options: SIZES.filter((s) => s.value !== 'M6' && s.value !== 'M8') }],
  build: (p) => {
    const spec = HEATSET[str(p, 'size', 'M3')] ?? HEATSET.M3;
    const top = spec.od / 2 + 0.15;
    const bot = spec.od / 2 - 0.05;
    const solid = K.cylinder(spec.len + 0.6, bot, top, seg(top));
    return { solid, mates: [axisMate('top', 'Top (wide)', [0, 0, spec.len + 0.6], [0, 0, 1])] };
  },
};

export const nutTrap: PartModule = {
  id: 'nut-trap',
  name: 'Nut trap',
  category: 'Fasteners',
  blurb: 'Hex pocket plus a through hole. Subtract it.',
  help: 'The hex opens on +Z. Depth of the pocket is the nut height plus 0.2 mm. The through hole continues for the screw.',
  tags: ['nut', 'trap', 'subtract', 'hex'],
  color: '#d07a45',
  params: [
    { key: 'size', label: 'Size', type: 'select', default: 'M3', options: SIZES },
    { key: 'through', label: 'Through length', type: 'number', default: 8, min: 1, max: 40, step: 0.5, unit: 'mm' },
  ],
  build: (p) => {
    const s = sizeOf(p);
    const through = clamp(num(p, 'through', 8), 0.5, 50);
    const pocket = K.extrude(K.section(hexPoly(s.hex + 0.3)), s.nutH + 0.25);
    const hole = K.moved(K.cylinder(through + s.nutH + 2, s.d / 2 + 0.15, s.d / 2 + 0.15, seg(s.d / 2)), [0, 0, -through]);
    return { solid: K.union([pocket, hole]), mates: [axisMate('face', 'Pocket face', [0, 0, 0], [0, 0, 1])] };
  },
};

export const standoff: PartModule = {
  id: 'standoff',
  name: 'Standoff',
  category: 'Fasteners',
  blurb: 'Hex female-female spacer.',
  help: 'Both ends are tapped visually as clearance holes so a screw can pass. Length is the spacer body.',
  tags: ['standoff', 'spacer'],
  color: '#8b97a3',
  params: [
    { key: 'size', label: 'Screw', type: 'select', default: 'M3', options: SIZES },
    { key: 'length', label: 'Length', type: 'number', default: 10, min: 3, max: 50, step: 1, unit: 'mm' },
  ],
  build: (p) => {
    const s = sizeOf(p);
    const length = clamp(num(p, 'length', 10), 2, 60);
    const af = s.hex;
    let solid = K.extrude(K.section(hexPoly(af)), length);
    solid = K.subtract(solid, [K.moved(K.cylinder(length + 2, s.d / 2, s.d / 2, seg(s.d / 2)), [0, 0, -1])]);
    return { solid, mates: [axisMate('a', 'End A', [0, 0, 0], [0, 0, -1], [1, 0, 0]), axisMate('b', 'End B', [0, 0, length], [0, 0, 1])] };
  },
};

const BEARINGS: Record<string, [number, number, number]> = {
  '623': [3, 10, 4],
  '693': [3, 8, 4],
  '624': [4, 13, 5],
  '625': [5, 16, 5],
  '695': [5, 13, 4],
  MR105: [5, 10, 4],
  MR115: [5, 11, 4],
  '606': [6, 17, 6],
  MR126: [6, 12, 4],
  '608': [8, 22, 7],
  '6000': [10, 26, 8],
  '6001': [12, 28, 8],
};

const BEARING_OPTIONS = Object.keys(BEARINGS).map((v) => ({ value: v, label: v }));

function bearingNums(p: Params): { id: number; od: number; w: number } {
  const preset = str(p, 'preset', '608');
  if (preset !== 'custom' && BEARINGS[preset]) {
    const row = BEARINGS[preset];
    return { id: row[0], od: row[1], w: row[2] };
  }
  return { id: num(p, 'id', 8), od: num(p, 'od', 22), w: num(p, 'width', 7) };
}

export const bearing: PartModule = {
  id: 'bearing',
  name: 'Ball bearing',
  category: 'Fasteners',
  blurb: '608, 624, MR105 and other hobby sizes.',
  help: 'A fit model: outer race, inner race, and a ball groove. Drop it into a bearing pocket. Axis +Z.',
  tags: ['bearing', '608', '624', 'skate'],
  color: '#c5ccd4',
  params: [
    { key: 'preset', label: 'Preset', type: 'select', default: '608', options: [...BEARING_OPTIONS, { value: 'custom', label: 'Custom' }] },
    { key: 'id', label: 'Bore', type: 'number', default: 8, min: 2, max: 30, step: 0.1, unit: 'mm' },
    { key: 'od', label: 'Outside', type: 'number', default: 22, min: 6, max: 60, step: 0.1, unit: 'mm' },
    { key: 'width', label: 'Width', type: 'number', default: 7, min: 2, max: 20, step: 0.1, unit: 'mm' },
  ],
  onParam: (key, params) => {
    if (key !== 'preset') return;
    const row = BEARINGS[str(params, 'preset')];
    if (!row) return;
    params.id = row[0];
    params.od = row[1];
    params.width = row[2];
  },
  build: (p) => {
    const b = bearingNums(p);
    const id = clamp(b.id, 1, 40);
    const od = clamp(Math.max(b.od, id + 3), id + 3, 80);
    const w = clamp(b.w, 1.5, 30);
    const race = (od - id) / 6;
    const outer = K.subtract(K.cylinder(w, od / 2, od / 2, seg(od / 2)), [
      K.moved(K.cylinder(w + 2, od / 2 - race, od / 2 - race, seg(od / 2)), [0, 0, -1]),
    ]);
    const inner = K.subtract(K.cylinder(w, id / 2 + race, id / 2 + race, seg(id / 2)), [
      K.moved(K.cylinder(w + 2, id / 2, id / 2, seg(id / 2)), [0, 0, -1]),
    ]);
    const ballR = Math.max(0.6, (od / 2 - race - (id / 2 + race)) * 0.45);
    const ballOrbit = (id / 2 + race + od / 2 - race) / 2;
    const balls: K.Solid[] = [];
    const n = Math.max(6, Math.round((Math.PI * ballOrbit) / (ballR * 2.2)));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      balls.push(K.moved(K.sphere(ballR, 16), [Math.cos(a) * ballOrbit, Math.sin(a) * ballOrbit, w / 2]));
    }
    return { solid: K.union([outer, inner, ...balls]), mates: [axisMate('axis', 'Axis', [0, 0, w / 2], [0, 0, 1])] };
  },
};

export const bearingPocket: PartModule = {
  id: 'bearing-pocket',
  name: 'Bearing pocket',
  category: 'Fasteners',
  blurb: 'Round pocket to subtract so a bearing presses in.',
  help: 'Diameter is the bearing OD plus clearance. Depth defaults to the bearing width. Open on +Z.',
  tags: ['bearing', 'pocket', 'subtract'],
  color: '#d07a45',
  params: [
    { key: 'preset', label: 'Bearing', type: 'select', default: '608', options: BEARING_OPTIONS },
    { key: 'clearance', label: 'Clearance', type: 'number', default: 0.15, min: 0, max: 0.6, step: 0.05, unit: 'mm' },
    { key: 'depth', label: 'Depth', type: 'number', default: 7, min: 1, max: 30, step: 0.1, unit: 'mm' },
    { key: 'through', label: 'Shaft through hole', type: 'number', default: 8.4, min: 0, max: 30, step: 0.1, unit: 'mm' },
  ],
  onParam: (key, params) => {
    if (key !== 'preset') return;
    const row = BEARINGS[str(params, 'preset')];
    if (!row) return;
    params.depth = row[2];
    params.through = row[0] + 0.4;
  },
  build: (p) => {
    const row = BEARINGS[str(p, 'preset', '608')] ?? BEARINGS['608'];
    const clearance = clamp(num(p, 'clearance', 0.15), 0, 1);
    const depth = clamp(num(p, 'depth', row[2]), 0.8, 40);
    const through = clamp(num(p, 'through', row[0] + 0.4), 0, row[1]);
    const od = row[1] + clearance * 2;
    let solid = K.cylinder(depth, od / 2, od / 2, seg(od / 2));
    if (through > 0.3) {
      solid = K.union([solid, K.moved(K.cylinder(depth + 12, through / 2, through / 2, seg(through / 2)), [0, 0, -12])]);
    }
    return { solid, mates: [axisMate('face', 'Open face', [0, 0, depth], [0, 0, 1])] };
  },
};

export const boltHole: PartModule = {
  id: 'bolt-hole',
  name: 'Bolt hole',
  category: 'Fasteners',
  blurb: 'Clearance hole with optional counterbore or countersink.',
  help: 'Subtract this from a plate. The open face is +Z. Counterbore accepts a socket head. Countersink accepts a flat head.',
  tags: ['hole', 'counterbore', 'countersink', 'subtract'],
  color: '#d07a45',
  params: [
    { key: 'size', label: 'Screw', type: 'select', default: 'M3', options: SIZES },
    { key: 'depth', label: 'Depth', type: 'number', default: 8, min: 1, max: 40, step: 0.5, unit: 'mm' },
    { key: 'head', label: 'Head', type: 'select', default: 'none', options: [
      { value: 'none', label: 'Plain' },
      { value: 'socket', label: 'Counterbore' },
      { value: 'flat', label: 'Countersink' },
    ] },
    { key: 'clearance', label: 'Clearance', type: 'number', default: 0.25, min: 0, max: 1, step: 0.05, unit: 'mm' },
  ],
  build: (p) => {
    const s = sizeOf(p);
    const depth = clamp(num(p, 'depth', 8), 0.8, 60);
    const clearance = clamp(num(p, 'clearance', 0.25), 0, 1.5);
    const head = str(p, 'head', 'none');
    let solid = K.cylinder(depth, s.d / 2 + clearance, s.d / 2 + clearance, seg(s.d / 2));
    if (head === 'socket') {
      const cb = K.moved(K.cylinder(s.headH + 0.2, s.head / 2 + 0.2, s.head / 2 + 0.2, seg(s.head / 2)), [0, 0, depth - s.headH]);
      solid = K.union([solid, cb]);
    } else if (head === 'flat') {
      const cs = K.moved(K.cylinder(s.csH, s.d / 2 + clearance, s.cs / 2 + 0.2, seg(s.cs / 2)), [0, 0, depth - s.csH]);
      solid = K.union([solid, cs]);
    }
    return { solid, mates: [axisMate('top', 'Top', [0, 0, depth], [0, 0, 1])] };
  },
};

export const fastenerParts: PartModule[] = [
  socketScrew,
  hexBolt,
  countersunk,
  grubScrew,
  hexNut,
  washer,
  heatset,
  heatsetCavity,
  nutTrap,
  standoff,
  bearing,
  bearingPocket,
  boltHole,
];
