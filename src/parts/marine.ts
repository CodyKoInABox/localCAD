import type { Mate, Params, PartModule, Vec2, Vec3 } from '../cad/types.ts';
import { axisMate, bool, clamp, int, num, seg, str } from '../cad/math.ts';
import * as K from '../cad/kernel.ts';
import { loftSolid } from './loft.ts';

type HullParams = {
  length: number;
  beam: number;
  depth: number;
  deadrise: number;
  rocker: number;
  wall: number;
  style: string;
  openDeck: boolean;
  skeg: boolean;
};

function ringAt(t: number, hp: HullParams, mode: 'outer' | 'inner'): Vec3[] {
  const bowStart = 0.6;
  let beamFactor = 0.82 + 0.18 * Math.sin((Math.min(t, bowStart) / bowStart) * Math.PI);
  if (t > bowStart) {
    const k = (t - bowStart) / (1 - bowStart);
    beamFactor *= Math.max(0.04, 1 - k * k);
  }
  let half = (hp.beam / 2) * beamFactor;
  half = Math.max(mode === 'outer' ? 1.2 : 1, half);
  let zKeel = hp.rocker * Math.pow(t, 1.3);
  const deadrise = (hp.deadrise * Math.PI) / 180;
  let zChine = zKeel + (hp.style === 'displacement' ? half * 0.15 : Math.tan(deadrise) * half * 0.72);
  let zSheer = Math.max(zChine + 3, hp.depth * (1 - 0.22 * Math.pow(Math.max(0, (t - 0.72) / 0.28), 1.1)));
  let ySheer = half * (hp.style === 'displacement' ? 0.78 : 0.92);
  let camber = Math.min(4, hp.beam * 0.03);
  let zDeck = zSheer + camber;
  const x0 = mode === 'inner' ? hp.wall : 0;
  const x1 = hp.length - (mode === 'inner' ? hp.wall : 0);
  const x = x0 + t * (x1 - x0);

  if (mode === 'inner') {
    const inset = hp.wall;
    half = Math.max(1.2, half - inset);
    ySheer = Math.max(1.1, ySheer - inset);
    zKeel += inset;
    zChine = zKeel + Math.max(1, zChine - (hp.rocker * Math.pow(t, 1.3)) - inset * 0.2);
    zSheer = Math.max(zChine + 2, zSheer - inset * 0.2);
    zDeck = hp.openDeck ? hp.depth + inset + 3 : zSheer + camber - inset;
  }

  if (hp.style === 'displacement') {
    const pts: Vec3[] = [];
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const s = i / steps;
      const y = half * Math.sin((s * Math.PI) / 2);
      const z = zKeel + (zSheer - zKeel) * (1 - Math.cos((s * Math.PI) / 2));
      pts.push([x, y, z]);
    }
    pts.push([x, ySheer * 0.4, zDeck]);
    pts.push([x, 0, zDeck + (mode === 'inner' && hp.openDeck ? 0 : camber * 0.2)]);
    pts.push([x, -ySheer * 0.4, zDeck]);
    for (let i = steps; i >= 0; i--) {
      const s = i / steps;
      const y = -half * Math.sin((s * Math.PI) / 2);
      const z = zKeel + (zSheer - zKeel) * (1 - Math.cos((s * Math.PI) / 2));
      pts.push([x, y, z]);
    }
    return pts;
  }

  return [
    [x, 0, zKeel],
    [x, half * 0.45, zKeel + (zChine - zKeel) * 0.5],
    [x, half, zChine],
    [x, ySheer, zSheer],
    [x, ySheer * 0.45, zDeck],
    [x, 0, zDeck],
    [x, -ySheer * 0.45, zDeck],
    [x, -ySheer, zSheer],
    [x, -half, zChine],
    [x, -half * 0.45, zKeel + (zChine - zKeel) * 0.5],
  ];
}

function hullSolid(hp: HullParams): K.Solid {
  const stations = hp.style === 'displacement' ? 22 : 26;
  const outer: Vec3[][] = [];
  const inner: Vec3[][] = [];
  for (let i = 0; i <= stations; i++) {
    const t = i / stations;
    outer.push(ringAt(t, hp, 'outer'));
    inner.push(ringAt(t, hp, 'inner'));
  }
  let solid = loftSolid(outer);
  try {
    const cavity = loftSolid(inner);
    solid = K.subtract(solid, [cavity]);
  } catch {
    /* keep a solid plug if the cavity is not manifold */
  }
  if (hp.skeg) {
    const finH = Math.max(6, hp.depth * 0.22);
    const fin = K.moved(K.box([hp.length * 0.22, Math.max(2.4, hp.wall), finH], false), [hp.wall, -hp.wall / 2, 0]);
    const cut = K.moved(K.box([hp.length * 0.22, hp.wall + 2, finH], false), [hp.length * 0.16, -1, -finH * 0.55]);
    solid = K.union([solid, K.subtract(fin, [cut])]);
  }
  return solid;
}

export const boatHull: PartModule = {
  id: 'boat-hull',
  name: 'Boat hull',
  category: 'Marine',
  blurb: 'Shelled planing or displacement hull with an open deck.',
  help: 'Stern is x = 0, bow is +X, keel on the bed. Wall thickness is a real shell, so the STL is a printable tub. Deadrise is the V angle. Rocker lifts the bow.',
  tags: ['hull', 'boat', 'rc', 'planing'],
  color: '#c4553a',
  params: [
    { key: 'style', label: 'Style', type: 'select', default: 'planing', options: [
      { value: 'planing', label: 'Planing V' },
      { value: 'displacement', label: 'Round bilge' },
    ] },
    { key: 'length', label: 'Length', type: 'number', default: 280, min: 80, max: 600, step: 5, unit: 'mm' },
    { key: 'beam', label: 'Beam', type: 'number', default: 110, min: 40, max: 260, step: 2, unit: 'mm' },
    { key: 'depth', label: 'Depth', type: 'number', default: 52, min: 20, max: 140, step: 1, unit: 'mm' },
    { key: 'deadrise', label: 'Deadrise', type: 'number', default: 16, min: 0, max: 35, step: 1, unit: '°' },
    { key: 'rocker', label: 'Bow rocker', type: 'number', default: 10, min: 0, max: 40, step: 1, unit: 'mm' },
    { key: 'wall', label: 'Wall', type: 'number', default: 2.4, min: 1.2, max: 6, step: 0.1, unit: 'mm' },
    { key: 'openDeck', label: 'Open deck', type: 'bool', default: true },
    { key: 'skeg', label: 'Skeg', type: 'bool', default: true },
  ],
  build: (p) => {
    const hp: HullParams = {
      length: clamp(num(p, 'length', 280), 60, 700),
      beam: clamp(num(p, 'beam', 110), 30, 300),
      depth: clamp(num(p, 'depth', 52), 16, 160),
      deadrise: clamp(num(p, 'deadrise', 16), 0, 40),
      rocker: clamp(num(p, 'rocker', 10), 0, 50),
      wall: clamp(num(p, 'wall', 2.4), 1, 8),
      style: str(p, 'style', 'planing'),
      openDeck: bool(p, 'openDeck', true),
      skeg: bool(p, 'skeg', true),
    };
    return {
      solid: hullSolid(hp),
      mates: [
        axisMate('stern', 'Stern center', [0, 0, hp.depth], [1, 0, 0], [0, 0, 1]),
        axisMate('keel', 'Keel origin', [0, 0, 0], [0, 0, 1]),
      ],
    };
  },
};

export const rudder: PartModule = {
  id: 'rudder',
  name: 'Rudder',
  category: 'Marine',
  blurb: 'Foil rudder with a round stock and tiller flat.',
  help: 'Stock axis is +Z. The blade hangs in −Z if you place the stock at the deck, or flip it. Default blade is below the stock shoulder.',
  tags: ['rudder', 'boat'],
  color: '#b7b1a8',
  params: [
    { key: 'span', label: 'Blade span', type: 'number', default: 45, min: 15, max: 120, step: 1, unit: 'mm' },
    { key: 'chord', label: 'Chord', type: 'number', default: 28, min: 10, max: 70, step: 1, unit: 'mm' },
    { key: 'stock', label: 'Stock diameter', type: 'number', default: 4, min: 2, max: 10, step: 0.1, unit: 'mm' },
  ],
  build: (p) => {
    const span = clamp(num(p, 'span', 45), 10, 140);
    const chord = clamp(num(p, 'chord', 28), 8, 80);
    const stock = clamp(num(p, 'stock', 4), 2, 12);
    const foil: Vec2[] = [
      [0, 0],
      [chord * 0.15, stock * 0.55],
      [chord * 0.7, stock * 0.35],
      [chord, 0],
      [chord * 0.7, -stock * 0.35],
      [chord * 0.15, -stock * 0.55],
    ];
    const blade = K.moved(K.extrude(K.section(foil), span), [-chord * 0.25, 0, 0]);
    const post = K.moved(K.cylinder(span * 0.45, stock / 2, stock / 2, seg(stock / 2)), [0, 0, span - 2]);
    const tiller = K.moved(K.box([chord * 0.8, stock, 3], false), [-2, -stock / 2, span + span * 0.35]);
    return {
      solid: K.union([blade, post, tiller]),
      mates: [axisMate('stock', 'Stock', [0, 0, span + span * 0.2], [0, 0, 1])],
    };
  },
};

export const propeller: PartModule = {
  id: 'propeller',
  name: 'Propeller',
  category: 'Marine',
  blurb: '2, 3, or 4 blade prop with a bored hub.',
  help: 'Pitch is the advance per turn. Hub axis is +Z, which becomes the shaft direction. Bore is clearance for the prop shaft.',
  tags: ['prop', 'propeller', 'boat'],
  color: '#d0a24a',
  params: [
    { key: 'diameter', label: 'Diameter', type: 'number', default: 32, min: 16, max: 80, step: 1, unit: 'mm' },
    { key: 'blades', label: 'Blades', type: 'int', default: 3, min: 2, max: 4 },
    { key: 'pitch', label: 'Pitch', type: 'number', default: 28, min: 8, max: 80, step: 1, unit: 'mm' },
    { key: 'bore', label: 'Bore', type: 'number', default: 3.2, min: 1.5, max: 8, step: 0.1, unit: 'mm' },
  ],
  build: (p) => {
    const diameter = clamp(num(p, 'diameter', 32), 12, 100);
    const blades = clamp(int(p, 'blades', 3), 2, 4);
    const pitch = clamp(num(p, 'pitch', 28), 6, 100);
    const bore = clamp(num(p, 'bore', 3.2), 1, 12);
    const hubR = Math.max(bore / 2 + 1.6, diameter * 0.12);
    const hubL = Math.max(6, diameter * 0.22);
    let hub = K.cylinder(hubL, hubR, hubR * 0.8, seg(hubR));
    hub = K.subtract(hub, [K.moved(K.cylinder(hubL + 2, bore / 2, bore / 2, seg(bore / 2)), [0, 0, -1])]);
    const span = diameter / 2 - hubR;
    const chord = diameter * 0.2;
    const thick = Math.max(0.8, diameter * 0.035);
    const rMid = hubR + span * 0.65;
    const angle = (Math.atan2(pitch, 2 * Math.PI * rMid) * 180) / Math.PI;
    const bladesolids: K.Solid[] = [];
    const foil: Vec2[] = [
      [-chord / 2, 0],
      [-chord * 0.2, thick / 2],
      [chord * 0.35, thick * 0.35],
      [chord / 2, 0],
      [chord * 0.35, -thick * 0.35],
      [-chord * 0.2, -thick / 2],
    ];
    for (let i = 0; i < blades; i++) {
      let blade = K.extrude(K.section(foil), span, 2, 0, [0.45, 0.45]);
      blade = K.turned(blade, [0, -90, 0]);
      blade = K.moved(blade, [hubR - 0.2, 0, hubL / 2]);
      blade = K.turned(blade, [0, angle, 0]);
      blade = K.turned(blade, [0, 0, (360 / blades) * i]);
      bladesolids.push(blade);
    }
    return { solid: K.union([hub, ...bladesolids]), mates: [axisMate('hub', 'Hub', [0, 0, hubL / 2], [0, 0, 1])] };
  },
};

export const sternTube: PartModule = {
  id: 'stern-tube',
  name: 'Stern tube',
  category: 'Marine',
  blurb: 'Stuffing tube with a flange for the prop shaft.',
  help: 'The bore is the shaft clearance. Axis +Z. Mount the flange on the transom or a bulkhead.',
  tags: ['stern', 'shaft', 'boat'],
  color: '#8d97a3',
  params: [
    { key: 'length', label: 'Length', type: 'number', default: 40, min: 15, max: 120, step: 1, unit: 'mm' },
    { key: 'bore', label: 'Shaft bore', type: 'number', default: 3.2, min: 2, max: 8, step: 0.1, unit: 'mm' },
    { key: 'od', label: 'Tube OD', type: 'number', default: 8, min: 4, max: 16, step: 0.2, unit: 'mm' },
  ],
  build: (p) => {
    const length = clamp(num(p, 'length', 40), 10, 150);
    const bore = clamp(num(p, 'bore', 3.2), 1.5, 12);
    const od = clamp(num(p, 'od', 8), bore + 2, 24);
    let tube = K.cylinder(length, od / 2, od / 2, seg(od / 2));
    tube = K.subtract(tube, [K.moved(K.cylinder(length + 2, bore / 2, bore / 2, seg(bore / 2)), [0, 0, -1])]);
    let flange = K.cylinder(2.4, od * 0.9, od * 0.9, seg(od));
    flange = K.subtract(flange, [K.moved(K.cylinder(4, bore / 2, bore / 2, seg(bore / 2)), [0, 0, -1])]);
    const holes: K.Solid[] = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      holes.push(K.moved(K.cylinder(4, 1.1, 1.1, 12), [Math.cos(a) * od * 0.62, Math.sin(a) * od * 0.62, -0.8]));
    }
    flange = K.subtract(flange, holes);
    return { solid: K.union([tube, flange]), mates: [axisMate('flange', 'Flange', [0, 0, 0], [0, 0, 1]), axisMate('end', 'Aft end', [0, 0, length], [0, 0, 1])] };
  },
};

export const skeg: PartModule = {
  id: 'skeg',
  name: 'Skeg',
  category: 'Marine',
  blurb: 'Separate fin if you do not want it built into the hull.',
  help: 'Leading edge is +X. Sit the base on the keel.',
  tags: ['skeg', 'keel', 'fin'],
  color: '#9aa3ad',
  params: [
    { key: 'length', label: 'Length', type: 'number', default: 50, min: 15, max: 140, step: 1, unit: 'mm' },
    { key: 'height', label: 'Height', type: 'number', default: 18, min: 6, max: 50, step: 1, unit: 'mm' },
    { key: 'thick', label: 'Thickness', type: 'number', default: 3, min: 1.2, max: 8, step: 0.1, unit: 'mm' },
  ],
  build: (p) => {
    const length = clamp(num(p, 'length', 50), 10, 180);
    const height = clamp(num(p, 'height', 18), 4, 70);
    const thick = clamp(num(p, 'thick', 3), 1, 10);
    const fin = K.box([length, thick, height], false);
    const rake = K.moved(K.box([length * 0.45, thick + 1, height], false), [length * 0.62, -0.5, -height * 0.45]);
    return {
      solid: K.moved(K.subtract(fin, [rake]), [0, -thick / 2, 0]),
      mates: [axisMate('base', 'Base', [length / 2, 0, 0], [0, 0, 1])],
    };
  },
};

export const cleat: PartModule = {
  id: 'cleat',
  name: 'Bow cleat',
  category: 'Marine',
  blurb: 'Two-horn cleat with screw holes.',
  help: 'Screw holes are vertical. Sit it on the deck.',
  tags: ['cleat', 'deck'],
  color: '#d7d2c8',
  params: [
    { key: 'length', label: 'Length', type: 'number', default: 28, min: 16, max: 50, step: 1, unit: 'mm' },
  ],
  build: (p) => {
    const length = clamp(num(p, 'length', 28), 12, 60);
    const base = K.box([length, 8, 3], false);
    const horn = K.moved(K.box([length * 0.72, 4, 5], false), [length * 0.14, 2, 3]);
    const tipA = K.moved(K.cylinder(8, 2.2, 2.2, 16, true), [2, 4, 6]);
    const tipB = K.moved(K.cylinder(8, 2.2, 2.2, 16, true), [length - 2, 4, 6]);
    let solid = K.union([K.moved(base, [0, -4, 0]), horn, K.turned(tipA, [90, 0, 0]), K.turned(tipB, [90, 0, 0])]);
    solid = K.subtract(solid, [
      K.moved(K.cylinder(6, 1.2, 1.2, 12), [length * 0.25, 0, -1]),
      K.moved(K.cylinder(6, 1.2, 1.2, 12), [length * 0.75, 0, -1]),
    ]);
    return { solid, mates: [axisMate('deck', 'Deck', [length / 2, 0, 0], [0, 0, 1])] };
  },
};

export const deckHatch: PartModule = {
  id: 'deck-hatch',
  name: 'Deck hatch',
  category: 'Marine',
  blurb: 'Frame and a loose lid with print clearance.',
  help: 'The lid is a separate shell in the same part, gapped by 0.4 mm, so you can print them together and lift the lid off.',
  tags: ['hatch', 'lid', 'deck'],
  color: '#c47b55',
  params: [
    { key: 'length', label: 'Opening length', type: 'number', default: 60, min: 20, max: 160, step: 1, unit: 'mm' },
    { key: 'width', label: 'Opening width', type: 'number', default: 40, min: 16, max: 100, step: 1, unit: 'mm' },
  ],
  build: (p) => {
    const L = clamp(num(p, 'length', 60), 16, 180);
    const W = clamp(num(p, 'width', 40), 12, 120);
    const wall = 4;
    const frameH = 6;
    let frame = K.box([L + wall * 2, W + wall * 2, frameH], false);
    frame = K.subtract(frame, [K.moved(K.box([L, W, frameH + 2], false), [wall, wall, 2])]);
    const lid = K.moved(K.box([L - 0.8, W - 0.8, 2.4], false), [wall + 0.4, wall + 0.4, frameH + 0.4]);
    const lip = K.moved(K.box([L - 2.4, W - 2.4, 2.2], false), [wall + 1.2, wall + 1.2, frameH - 1.6]);
    const handle = K.moved(K.box([12, 4, 3], false), [(L + wall * 2) / 2 - 6, (W + wall * 2) / 2 - 2, frameH + 2.6]);
    return {
      solid: K.union([frame, lid, lip, handle]),
      mates: [axisMate('deck', 'Deck', [(L + wall * 2) / 2, (W + wall * 2) / 2, 0], [0, 0, 1])],
    };
  },
};

export const motorBulkhead: PartModule = {
  id: 'motor-bulkhead',
  name: 'Motor bulkhead',
  category: 'Marine',
  blurb: 'Transverse plate with a motor hole and shaft angle.',
  help: 'The plate is in the YZ plane, thickness along X. The motor hole axis is tilted in XZ by the shaft angle so a stern tube can pass.',
  tags: ['bulkhead', 'motor', 'boat'],
  color: '#c4b8a5',
  params: [
    { key: 'width', label: 'Width', type: 'number', default: 80, min: 30, max: 200, step: 1, unit: 'mm' },
    { key: 'height', label: 'Height', type: 'number', default: 40, min: 16, max: 100, step: 1, unit: 'mm' },
    { key: 'thick', label: 'Thickness', type: 'number', default: 3, min: 1.6, max: 8, step: 0.2, unit: 'mm' },
    { key: 'hole', label: 'Motor hole', type: 'number', default: 22, min: 6, max: 50, step: 0.5, unit: 'mm' },
    { key: 'angle', label: 'Shaft angle', type: 'number', default: 8, min: 0, max: 25, step: 1, unit: '°' },
  ],
  build: (p) => {
    const width = clamp(num(p, 'width', 80), 20, 240);
    const height = clamp(num(p, 'height', 40), 12, 120);
    const thick = clamp(num(p, 'thick', 3), 1.2, 10);
    const hole = clamp(num(p, 'hole', 22), 4, Math.min(width, height) - 6);
    const angle = clamp(num(p, 'angle', 8), 0, 30);
    let plate = K.box([thick, width, height], false);
    let cutter = K.cylinder(thick + 16, hole / 2, hole / 2, seg(hole / 2));
    cutter = K.turned(cutter, [0, -angle, 0]);
    cutter = K.moved(cutter, [thick / 2, width / 2, height * 0.45]);
    plate = K.subtract(K.moved(plate, [0, 0, 0]), [cutter]);
    return { solid: plate, mates: [axisMate('face', 'Aft face', [thick, width / 2, height / 2], [1, 0, 0], [0, 0, 1])] };
  },
};

export const marineParts: PartModule[] = [boatHull, rudder, propeller, sternTube, skeg, cleat, deckHatch, motorBulkhead];
