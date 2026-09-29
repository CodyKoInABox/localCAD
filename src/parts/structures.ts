import type { Mate, Params, PartModule } from '../cad/types.ts';
import { axisMate, bool, clamp, hexPoly, int, num, seg, str } from '../cad/math.ts';
import * as K from '../cad/kernel.ts';

export const mountingPlate: PartModule = {
  id: 'mounting-plate',
  name: 'Hole plate',
  category: 'Structures',
  blurb: 'Rounded plate with a rectangular hole grid.',
  help: 'Origin is the center of the underside. Holes are through. Pitch is the spacing.',
  tags: ['plate', 'holes', 'grid'],
  color: '#c4b8a5',
  params: [
    { key: 'length', label: 'Length', type: 'number', default: 60, min: 10, max: 300, step: 1, unit: 'mm' },
    { key: 'width', label: 'Width', type: 'number', default: 40, min: 10, max: 300, step: 1, unit: 'mm' },
    { key: 'thick', label: 'Thickness', type: 'number', default: 3, min: 1, max: 12, step: 0.2, unit: 'mm' },
    { key: 'pitch', label: 'Hole pitch', type: 'number', default: 10, min: 4, max: 40, step: 1, unit: 'mm' },
    { key: 'hole', label: 'Hole diameter', type: 'number', default: 3.2, min: 1, max: 10, step: 0.1, unit: 'mm' },
    { key: 'radius', label: 'Corner radius', type: 'number', default: 3, min: 0, max: 20, step: 0.5, unit: 'mm' },
  ],
  build: (p) => {
    const L = clamp(num(p, 'length', 60), 8, 400);
    const W = clamp(num(p, 'width', 40), 8, 400);
    const t = clamp(num(p, 'thick', 3), 0.8, 20);
    const pitch = clamp(num(p, 'pitch', 10), 3, 50);
    const hole = clamp(num(p, 'hole', 3.2), 0.6, pitch - 1);
    const radius = clamp(num(p, 'radius', 3), 0, Math.min(L, W) / 2);
    let solid = K.extrude(K.roundedRect(L, W, radius), t);
    const holes: K.Solid[] = [];
    const nx = Math.max(1, Math.floor((L - hole * 2) / pitch));
    const ny = Math.max(1, Math.floor((W - hole * 2) / pitch));
    for (let ix = 0; ix < nx; ix++) {
      for (let iy = 0; iy < ny; iy++) {
        const x = -((nx - 1) * pitch) / 2 + ix * pitch;
        const y = -((ny - 1) * pitch) / 2 + iy * pitch;
        holes.push(K.moved(K.cylinder(t + 2, hole / 2, hole / 2, seg(hole / 2)), [x, y, -1]));
      }
    }
    solid = K.subtract(solid, holes);
    return { solid, mates: [axisMate('top', 'Top center', [0, 0, t], [0, 0, 1])] };
  },
};

export const chassisPlate: PartModule = {
  id: 'chassis-plate',
  name: 'Chassis plate',
  category: 'Structures',
  blurb: 'RC chassis with wheelbase holes, rails, and a battery pocket.',
  help: 'Origin is the center of the underside. +X is forward. Wheelbase and track place four axle holes. Rails are optional side walls.',
  tags: ['chassis', 'rc', 'car', 'plate'],
  color: '#b7aa96',
  params: [
    { key: 'length', label: 'Length', type: 'number', default: 200, min: 60, max: 400, step: 2, unit: 'mm' },
    { key: 'width', label: 'Width', type: 'number', default: 90, min: 40, max: 220, step: 2, unit: 'mm' },
    { key: 'thick', label: 'Thickness', type: 'number', default: 3.5, min: 2, max: 8, step: 0.1, unit: 'mm' },
    { key: 'wheelbase', label: 'Wheelbase', type: 'number', default: 140, min: 40, max: 280, step: 2, unit: 'mm' },
    { key: 'track', label: 'Mount track', type: 'number', default: 70, min: 20, max: 180, step: 2, unit: 'mm' },
    { key: 'hole', label: 'Hole diameter', type: 'number', default: 3.2, min: 2, max: 8, step: 0.1, unit: 'mm' },
    { key: 'rails', label: 'Side rails', type: 'bool', default: true },
    { key: 'bay', label: 'Battery bay', type: 'bool', default: true },
  ],
  build: (p) => {
    const L = clamp(num(p, 'length', 200), 40, 450);
    const W = clamp(num(p, 'width', 90), 30, 250);
    const t = clamp(num(p, 'thick', 3.5), 1.6, 10);
    const wb = clamp(num(p, 'wheelbase', 140), 20, L - 10);
    const track = clamp(num(p, 'track', 70), 10, W - 8);
    const hole = clamp(num(p, 'hole', 3.2), 1.5, 10);
    let solid = K.extrude(K.roundedRect(L, W, 6), t);
    const holes: K.Solid[] = [];
    for (const x of [-wb / 2, wb / 2]) {
      for (const y of [-track / 2, track / 2]) {
        holes.push(K.moved(K.cylinder(t + 2, hole / 2, hole / 2, 20), [x, y, -1]));
      }
    }
    solid = K.subtract(solid, holes);
    if (bool(p, 'bay', true)) {
      const bay = K.moved(K.box([L * 0.38, W * 0.55, 1.4], false), [-L * 0.19, -W * 0.275, t - 1.2]);
      solid = K.subtract(solid, [bay]);
    }
    if (bool(p, 'rails', true)) {
      const railH = 6;
      const rail = K.box([L * 0.7, 2.4, railH], false);
      solid = K.union([
        solid,
        K.moved(K.cloneSolid(rail), [-L * 0.35, W / 2 - 3, t - 0.1]),
        K.moved(rail, [-L * 0.35, -W / 2 + 0.6, t - 0.1]),
      ]);
    }
    const mates: Mate[] = [axisMate('deck', 'Deck center', [0, 0, t], [0, 0, 1])];
    let n = 1;
    for (const x of [-wb / 2, wb / 2]) {
      for (const y of [-track / 2, track / 2]) {
        mates.push(axisMate(`axle-${n}`, `Axle hole ${n}`, [x, y, t], [0, 0, 1]));
        n++;
      }
    }
    return { solid, mates };
  },
};

export const lBracket: PartModule = {
  id: 'l-bracket',
  name: 'L bracket',
  category: 'Structures',
  blurb: 'Two-hole angle bracket.',
  help: 'The upright is the YZ face. Holes are centered on each leg.',
  tags: ['bracket', 'angle'],
  color: '#c4b8a5',
  params: [
    { key: 'leg', label: 'Leg length', type: 'number', default: 24, min: 10, max: 80, step: 1, unit: 'mm' },
    { key: 'width', label: 'Width', type: 'number', default: 16, min: 8, max: 40, step: 1, unit: 'mm' },
    { key: 'thick', label: 'Thickness', type: 'number', default: 3, min: 1.6, max: 8, step: 0.2, unit: 'mm' },
    { key: 'hole', label: 'Hole', type: 'number', default: 3.2, min: 1.5, max: 8, step: 0.1, unit: 'mm' },
  ],
  build: (p) => {
    const leg = clamp(num(p, 'leg', 24), 8, 100);
    const width = clamp(num(p, 'width', 16), 6, 60);
    const thick = clamp(num(p, 'thick', 3), 1.2, 10);
    const hole = clamp(num(p, 'hole', 3.2), 1, width - 2);
    const a = K.box([leg, width, thick], false);
    const b = K.box([thick, width, leg], false);
    let solid = K.union([a, b]);
    solid = K.subtract(solid, [
      K.moved(K.cylinder(thick + 2, hole / 2, hole / 2, 18), [leg * 0.65, width / 2, -1]),
      K.moved(K.turned(K.cylinder(thick + 2, hole / 2, hole / 2, 18), [0, 90, 0]), [-1, width / 2, leg * 0.65]),
    ]);
    return { solid, mates: [axisMate('corner', 'Inside corner', [thick, width / 2, thick], [0, 0, 1])] };
  },
};

export const motorMount: PartModule = {
  id: 'motor-mount',
  name: 'Motor mount',
  category: 'Structures',
  blurb: 'Clamp or face mount for an N20, 130, or 540.',
  help: 'The cradle opens upward. Bolt the base to a plate. The bore is a clearance hole for the can, not a press on the shaft.',
  tags: ['motor', 'mount', 'n20', '540'],
  color: '#c4b8a5',
  params: [
    { key: 'style', label: 'Motor', type: 'select', default: 'n20', options: [
      { value: 'n20', label: 'N20' },
      { value: '130', label: '130' },
      { value: '540', label: '540' },
    ] },
  ],
  build: (p) => {
    const style = str(p, 'style', 'n20');
    const spec = style === '540' ? { d: 36.2, w: 20, base: 52 } : style === '130' ? { d: 21, w: 16, base: 36 } : { d: 12.4, w: 14, base: 28 };
    const base = K.box([spec.base, spec.w + 10, 3], false);
    const cradle = K.moved(K.cylinder(spec.w, spec.d / 2 + 2.5, spec.d / 2 + 2.5, seg(spec.d / 2), true), [spec.base / 2, spec.w / 2 + 5, spec.d / 2 + 3]);
    const cut = K.moved(K.cylinder(spec.w + 2, spec.d / 2, spec.d / 2, seg(spec.d / 2), true), [spec.base / 2, spec.w / 2 + 5, spec.d / 2 + 3]);
    const open = K.moved(K.box([spec.d, spec.w + 2, spec.d], false), [spec.base / 2 - spec.d / 2, spec.w / 2 + 4, spec.d / 2 + 4]);
    let solid = K.subtract(K.union([K.moved(base, [0, 0, 0]), cradle]), [cut, open]);
    solid = K.subtract(solid, [
      K.moved(K.cylinder(6, 1.6, 1.6, 14), [6, (spec.w + 10) / 2, -1]),
      K.moved(K.cylinder(6, 1.6, 1.6, 14), [spec.base - 6, (spec.w + 10) / 2, -1]),
    ]);
    return { solid, mates: [axisMate('base', 'Base', [spec.base / 2, (spec.w + 10) / 2, 0], [0, 0, 1])] };
  },
};

export const servoBracket: PartModule = {
  id: 'servo-bracket',
  name: 'Servo bracket',
  category: 'Structures',
  blurb: 'Drop-in tray for an SG90 or a standard servo.',
  help: 'The servo drops in from +Z. Floor holes match the ear spacing. Walls keep the body from twisting.',
  tags: ['servo', 'bracket', 'sg90'],
  color: '#c4b8a5',
  params: [
    { key: 'style', label: 'Servo', type: 'select', default: 'sg90', options: [
      { value: 'sg90', label: 'SG90' },
      { value: 'standard', label: 'Standard' },
    ] },
  ],
  build: (p) => {
    const sg = str(p, 'style', 'sg90') === 'sg90';
    const span = sg ? 32.8 : 54.4;
    const bodyL = sg ? 23.6 : 41;
    const bodyW = sg ? 12.8 : 20.6;
    const wall = 2.4;
    const floor = 2.2;
    const H = sg ? 16 : 22;
    const outerL = span + wall * 2;
    const outerW = bodyW + wall * 2;
    let solid = K.box([outerL, outerW, H], false);
    solid = K.subtract(solid, [K.moved(K.box([span - 0.4, bodyW, H], false), [wall + 0.2, wall, floor])]);
    solid = K.subtract(solid, [K.moved(K.box([bodyL, bodyW, H], false), [(outerL - bodyL) / 2, wall, floor])]);
    const holeD = sg ? 1.6 : 2.2;
    solid = K.subtract(solid, [
      K.moved(K.cylinder(floor + 2, holeD, holeD, 14), [(outerL - (sg ? 28 : 49)) / 2, outerW / 2, -1]),
      K.moved(K.cylinder(floor + 2, holeD, holeD, 14), [(outerL + (sg ? 28 : 49)) / 2, outerW / 2, -1]),
    ]);
    return { solid, mates: [axisMate('deck', 'Deck', [outerL / 2, outerW / 2, 0], [0, 0, 1])] };
  },
};

export const batteryTray: PartModule = {
  id: 'battery-tray',
  name: 'Battery tray',
  category: 'Structures',
  blurb: 'Strap tray sized around a LiPo brick.',
  help: 'Inside dimensions are the pack. Walls and a strap slot keep it on a chassis.',
  tags: ['battery', 'tray', 'lipo'],
  color: '#c4b8a5',
  params: [
    { key: 'length', label: 'Inside length', type: 'number', default: 72, min: 30, max: 180, step: 1, unit: 'mm' },
    { key: 'width', label: 'Inside width', type: 'number', default: 36, min: 16, max: 90, step: 1, unit: 'mm' },
    { key: 'height', label: 'Wall height', type: 'number', default: 12, min: 4, max: 40, step: 1, unit: 'mm' },
  ],
  build: (p) => {
    const L = clamp(num(p, 'length', 72), 20, 220);
    const W = clamp(num(p, 'width', 36), 12, 120);
    const H = clamp(num(p, 'height', 12), 3, 50);
    const wall = 2.4;
    const floor = 2;
    let solid = K.box([L + wall * 2, W + wall * 2, H], false);
    solid = K.subtract(solid, [K.moved(K.box([L, W, H], false), [wall, wall, floor])]);
    solid = K.subtract(solid, [K.moved(K.box([10, W + wall * 2 + 2, 3], false), [(L + wall * 2) / 2 - 5, -1, H - 4])]);
    return { solid, mates: [axisMate('deck', 'Deck', [(L + wall * 2) / 2, (W + wall * 2) / 2, 0], [0, 0, 1])] };
  },
};

export const hinge: PartModule = {
  id: 'hinge',
  name: 'Print-in-place hinge',
  category: 'Structures',
  blurb: 'Two leaves and a captured pin with clearance.',
  help: 'Leaves are separated by the clearance gap. Print it flat. Do not scale it or the pin will fuse.',
  tags: ['hinge', 'print-in-place'],
  color: '#c4b8a5',
  params: [
    { key: 'length', label: 'Leaf length', type: 'number', default: 28, min: 16, max: 60, step: 1, unit: 'mm' },
    { key: 'width', label: 'Leaf width', type: 'number', default: 16, min: 10, max: 40, step: 1, unit: 'mm' },
    { key: 'gap', label: 'Clearance', type: 'number', default: 0.35, min: 0.2, max: 0.55, step: 0.05, unit: 'mm' },
  ],
  build: (p) => {
    const length = clamp(num(p, 'length', 28), 12, 80);
    const width = clamp(num(p, 'width', 16), 8, 50);
    const gap = clamp(num(p, 'gap', 0.35), 0.15, 0.7);
    const t = 3;
    const pinR = 1.8;
    const leafA = K.box([length, width, t], false);
    const leafB = K.moved(K.box([length, width, t], false), [length + gap + pinR * 2, 0, 0]);
    const knuckles: K.Solid[] = [];
    const barrels = 5;
    const bw = width / barrels;
    for (let i = 0; i < barrels; i++) {
      const x = i % 2 === 0 ? length - 1 : length + gap + pinR * 2 - 1;
      const knuckle = K.moved(K.turned(K.cylinder(bw - gap, pinR + 2.1, pinR + 2.1, 20), [90, 0, 0]), [x, i * bw + gap / 2, t]);
      knuckles.push(knuckle);
    }
    let pin = K.turned(K.cylinder(width - gap, pinR, pinR, 18), [90, 0, 0]);
    pin = K.moved(pin, [length + gap / 2 + pinR, gap / 2, t + pinR + 1.4]);
    const capA = K.moved(K.cylinder(1.2, pinR + 1.3, pinR + 1.3, 16, true), [length + gap / 2 + pinR, gap / 2, t + pinR + 1.4]);
    const capB = K.moved(K.cylinder(1.2, pinR + 1.3, pinR + 1.3, 16, true), [length + gap / 2 + pinR, width - gap / 2, t + pinR + 1.4]);
    let solid = K.union([leafA, leafB, ...knuckles, pin, K.turned(capA, [90, 0, 0]), K.turned(capB, [90, 0, 0])]);
    const bore = K.moved(K.turned(K.cylinder(width + 4, pinR + gap, pinR + gap, 16), [90, 0, 0]), [length + gap / 2 + pinR, -2, t + pinR + 1.4]);
    solid = K.subtract(solid, [bore]);
    return { solid, mates: [axisMate('a', 'Leaf A', [length / 2, width / 2, 0], [0, 0, 1])] };
  },
};

export const gearCase: PartModule = {
  id: 'gear-case',
  name: 'Gear case',
  category: 'Structures',
  blurb: 'Two-shaft gearbox shell from center distance and face width.',
  help: 'Size it from the gears: center distance = module × (teeth A + teeth B) / 2. Bearing bores are the holes. The case is open on +Z so you can drop the gears in.',
  tags: ['gearbox', 'case', 'gears'],
  color: '#b7aa96',
  params: [
    { key: 'center', label: 'Center distance', type: 'number', default: 28, min: 10, max: 80, step: 0.5, unit: 'mm' },
    { key: 'face', label: 'Gear thickness', type: 'number', default: 6, min: 2, max: 20, step: 0.5, unit: 'mm' },
    { key: 'bore', label: 'Shaft bore', type: 'number', default: 4.2, min: 2, max: 12, step: 0.1, unit: 'mm' },
  ],
  build: (p) => {
    const center = clamp(num(p, 'center', 28), 8, 100);
    const face = clamp(num(p, 'face', 6), 2, 30);
    const bore = clamp(num(p, 'bore', 4.2), 1.5, 16);
    const wall = 3;
    const pad = 10;
    const L = center + pad * 2;
    const W = pad * 2;
    const H = face + wall + 6;
    let solid = K.box([L, W, H], false);
    solid = K.subtract(solid, [K.moved(K.box([L - wall * 2, W - wall * 2, H], false), [wall, wall, wall])]);
    solid = K.subtract(solid, [
      K.moved(K.cylinder(wall + 2, bore / 2, bore / 2, seg(bore / 2)), [pad, W / 2, -1]),
      K.moved(K.cylinder(wall + 2, bore / 2, bore / 2, seg(bore / 2)), [pad + center, W / 2, -1]),
    ]);
    return {
      solid,
      mates: [
        axisMate('shaft-a', 'Shaft A', [pad, W / 2, wall], [0, 0, 1]),
        axisMate('shaft-b', 'Shaft B', [pad + center, W / 2, wall], [0, 0, 1]),
      ],
    };
  },
};

export const steeringKnuckle: PartModule = {
  id: 'steering-knuckle',
  name: 'Steering knuckle',
  category: 'Structures',
  blurb: 'Upright with a kingpin, a stub axle, and a steering arm.',
  help: 'Kingpin is vertical (+Z). Stub axle points along +Y for the wheel. The arm hole takes a tie rod. Dimensions are a small RC car, not a full-size upright.',
  tags: ['steering', 'knuckle', 'rc', 'car'],
  color: '#c4b8a5',
  params: [
    { key: 'axle', label: 'Stub axle diameter', type: 'number', default: 4, min: 2, max: 8, step: 0.1, unit: 'mm' },
    { key: 'axleLen', label: 'Stub axle length', type: 'number', default: 14, min: 6, max: 30, step: 1, unit: 'mm' },
    { key: 'kingpin', label: 'Kingpin hole', type: 'number', default: 3.2, min: 2, max: 6, step: 0.1, unit: 'mm' },
  ],
  build: (p) => {
    const axle = clamp(num(p, 'axle', 4), 2, 10);
    const axleLen = clamp(num(p, 'axleLen', 14), 4, 40);
    const king = clamp(num(p, 'kingpin', 3.2), 1.6, 8);
    const block = K.box([10, 14, 22], false);
    const stub = K.moved(K.turned(K.cylinder(axleLen, axle / 2, axle / 2, seg(axle / 2)), [90, 0, 0]), [5, 14, 11]);
    const arm = K.moved(K.box([16, 6, 3], false), [10, 4, 4]);
    let solid = K.union([K.moved(block, [-5, 0, 0]), stub, arm]);
    solid = K.subtract(solid, [
      K.moved(K.cylinder(26, king / 2, king / 2, 16), [0, 7, -2]),
      K.moved(K.cylinder(8, 1.3, 1.3, 12), [22, 7, 2]),
    ]);
    return {
      solid,
      mates: [
        axisMate('kingpin', 'Kingpin', [0, 7, 11], [0, 0, 1]),
        axisMate('axle', 'Stub axle', [5, 14, 11], [0, 1, 0], [0, 0, 1]),
        axisMate('arm', 'Tie rod', [22, 7, 5.5], [0, 0, 1]),
      ],
    };
  },
};

export const pillowBlock: PartModule = {
  id: 'pillow-block',
  name: 'Pillow block',
  category: 'Structures',
  blurb: 'Shaft stand with a bore at a set height.',
  help: 'Bore axis is +Y so it matches a transverse axle. Height is from the base to the bore center. Two screw holes sit in the feet.',
  tags: ['bearing', 'stand', 'axle', 'pillow'],
  color: '#c4b8a5',
  params: [
    { key: 'height', label: 'Center height', type: 'number', default: 32, min: 8, max: 80, step: 1, unit: 'mm' },
    { key: 'bore', label: 'Bore', type: 'number', default: 4.2, min: 2, max: 16, step: 0.1, unit: 'mm' },
    { key: 'width', label: 'Width along shaft', type: 'number', default: 8, min: 4, max: 24, step: 1, unit: 'mm' },
  ],
  build: (p) => {
    const height = clamp(num(p, 'height', 32), 6, 100);
    const bore = clamp(num(p, 'bore', 4.2), 1.5, 20);
    const width = clamp(num(p, 'width', 8), 3, 30);
    const foot = 28;
    const base = K.box([foot, width, 3], false);
    const upright = K.moved(K.box([bore + 8, width, height], false), [(foot - (bore + 8)) / 2, 0, 0]);
    let solid = K.union([base, upright]);
    const hole = K.moved(K.turned(K.cylinder(width + 2, bore / 2, bore / 2, seg(bore / 2)), [90, 0, 0]), [foot / 2, -1, height]);
    solid = K.subtract(solid, [
      hole,
      K.moved(K.cylinder(6, 1.6, 1.6, 14), [5, width / 2, -1]),
      K.moved(K.cylinder(6, 1.6, 1.6, 14), [foot - 5, width / 2, -1]),
    ]);
    return { solid, mates: [axisMate('bore', 'Bore', [foot / 2, width / 2, height], [0, 1, 0], [0, 0, 1])] };
  },
};

export const rodEnd: PartModule = {
  id: 'rod-end',
  name: 'Tie rod',
  category: 'Structures',
  blurb: 'Straight link with a hole at each end.',
  help: 'Holes are vertical. Length is center to center. Use it as a steering link or a pushrod.',
  tags: ['rod', 'link', 'steering'],
  color: '#c4b8a5',
  params: [
    { key: 'length', label: 'Center distance', type: 'number', default: 40, min: 12, max: 160, step: 1, unit: 'mm' },
    { key: 'hole', label: 'Hole', type: 'number', default: 2.2, min: 1, max: 6, step: 0.1, unit: 'mm' },
    { key: 'width', label: 'Width', type: 'number', default: 6, min: 3, max: 14, step: 0.2, unit: 'mm' },
  ],
  build: (p) => {
    const length = clamp(num(p, 'length', 40), 8, 200);
    const hole = clamp(num(p, 'hole', 2.2), 0.8, 8);
    const width = clamp(num(p, 'width', 6), hole + 1.5, 20);
    const profile = K.profileAdd(
      K.profileAdd(K.square(Math.max(0.4, length - width), width * 0.55, true), K.circle(width / 2, 20).translate([-length / 2, 0] as unknown as [number, number])),
      K.circle(width / 2, 20).translate([length / 2, 0] as unknown as [number, number]),
    );
    let solid = K.extrude(profile, 2.4);
    solid = K.subtract(solid, [
      K.moved(K.cylinder(5, hole / 2, hole / 2, 14), [-length / 2, 0, -1]),
      K.moved(K.cylinder(5, hole / 2, hole / 2, 14), [length / 2, 0, -1]),
    ]);
    return {
      solid,
      mates: [
        axisMate('a', 'End A', [-length / 2, 0, 1.2], [0, 0, 1]),
        axisMate('b', 'End B', [length / 2, 0, 1.2], [0, 0, 1]),
      ],
    };
  },
};

void hexPoly;
void int;

export const structureParts: PartModule[] = [
  mountingPlate,
  chassisPlate,
  lBracket,
  motorMount,
  servoBracket,
  batteryTray,
  hinge,
  gearCase,
  steeringKnuckle,
  pillowBlock,
  rodEnd,
];
