import type { Mate, Params, PartModule, Vec2 } from '../cad/types.ts';
import { axisMate, bool, circlePoly, clamp, int, num, rot2, seg, str } from '../cad/math.ts';
import * as K from '../cad/kernel.ts';

function spurPolygon(module: number, teeth: number, pressure: number, backlash: number): Vec2[] {
  const pa = (pressure * Math.PI) / 180;
  const rp = (module * teeth) / 2;
  const rb = rp * Math.cos(pa);
  const ra = rp + module * (teeth < 12 ? 0.9 : 1);
  const rd = Math.max(module * 0.35, rp - module * 1.25);
  const halfThick = Math.PI / (2 * teeth) - backlash / (2 * rp);
  const pitchInv = Math.tan(pa) - pa;
  const steps = 5;

  const flank = (sign: number): Vec2[] => {
    const pts: Vec2[] = [];
    const rStart = Math.max(rd, rb);
    if (rd < rb - 1e-4) {
      const theta = sign * (halfThick + pitchInv);
      pts.push([rd * Math.cos(theta), rd * Math.sin(theta)]);
    }
    for (let i = 0; i <= steps; i++) {
      const r = rStart + ((ra - rStart) * i) / steps;
      const phi = Math.acos(clamp(rb / r, -1, 1));
      const inv = Math.tan(phi) - phi;
      const theta = sign * (halfThick + pitchInv - inv);
      pts.push([r * Math.cos(theta), r * Math.sin(theta)]);
    }
    return pts;
  };

  const pts: Vec2[] = [];
  const pitch = (2 * Math.PI) / teeth;
  const right0 = flank(-1);
  const left0 = flank(1);
  const tooth = [...right0, ...left0.slice().reverse()];
  for (let i = 0; i < teeth; i++) {
    const rot = i * pitch;
    for (const p of tooth) pts.push(rot2(p, rot));
    const end = rot2(tooth[tooth.length - 1], rot);
    const startNext = rot2(right0[0], rot + pitch);
    let a0 = Math.atan2(end[1], end[0]);
    let a1 = Math.atan2(startNext[1], startNext[0]);
    let sweep = a1 - a0;
    while (sweep <= 0) sweep += Math.PI * 2;
    if (sweep < Math.PI) {
      const rRoot = Math.hypot(end[0], end[1]);
      for (let k = 1; k <= 2; k++) {
        const a = a0 + (sweep * k) / 3;
        pts.push([rRoot * Math.cos(a), rRoot * Math.sin(a)]);
      }
    }
  }
  return pts;
}

function gearSolid(p: Params, kind: 'spur' | 'helical' | 'herringbone'): { solid: K.Solid; mates: Mate[] } {
  const module = clamp(num(p, 'module', 1), 0.3, 8);
  const teeth = clamp(int(p, 'teeth', 30), 8, 120);
  const thickness = clamp(num(p, 'thickness', 6), 0.6, 80);
  const pressure = clamp(num(p, 'pressure', 20), 14, 30);
  const backlash = clamp(num(p, 'backlash', 0.12), 0, module);
  const bore = clamp(num(p, 'bore', 4), 0, module * teeth * 0.45);
  const hubD = clamp(num(p, 'hubD', 0), 0, module * teeth);
  const hubH = clamp(num(p, 'hubH', 0), 0, 40);
  const helix = kind === 'spur' ? 0 : clamp(num(p, 'helix', 20), -45, 45);
  const keyW = bool(p, 'keyway', false) ? clamp(num(p, 'keyW', 2), 0.4, bore) : 0;
  const keyD = clamp(num(p, 'keyD', 1), 0.2, bore);

  const poly = spurPolygon(module, teeth, pressure, backlash);
  let profile = K.section(poly);
  const rp = (module * teeth) / 2;
  const twist = (thickness * Math.tan((helix * Math.PI) / 180)) / rp * (180 / Math.PI);
  const div = Math.max(1, Math.ceil(Math.abs(twist) / 6));

  let solid: K.Solid;
  if (kind === 'herringbone') {
    const half = thickness / 2 + 0.05;
    const halfTwist = twist / 2;
    const halfDiv = Math.max(1, Math.ceil(Math.abs(halfTwist) / 6));
    const bottom = K.extrude(K.section(poly), half, halfDiv, halfTwist);
    const top = K.moved(
      K.extrude(K.profileRotate(K.section(poly), halfTwist), half, halfDiv, -halfTwist),
      [0, 0, thickness / 2 - 0.05],
    );
    profile.delete();
    solid = K.union([bottom, top]);
  } else {
    solid = K.extrude(profile, thickness, kind === 'helical' ? div : 0, kind === 'helical' ? twist : 0);
  }

  if (hubD > bore + 0.4 && hubH > 0.2) {
    const hub = K.moved(K.cylinder(thickness + hubH, hubD / 2, hubD / 2, seg(hubD / 2), false), [0, 0, -hubH / 2]);
    solid = K.union([solid, hub]);
  }
  const span = thickness + hubH + 2;
  if (bore > 0.3) {
    solid = K.subtract(solid, [K.moved(K.cylinder(span, bore / 2, bore / 2, seg(bore / 2), false), [0, 0, -1])]);
  }
  if (keyW > 0 && bore > 0.3) {
    const cutter = K.box([keyD + 0.4, keyW, span], false);
    solid = K.subtract(solid, [K.moved(cutter, [bore / 2 - 0.2, -keyW / 2, -1])]);
  }

  const mates: Mate[] = [
    axisMate('center', 'Center', [0, 0, thickness / 2], [0, 0, 1]),
    axisMate('back', 'Back face', [0, 0, 0], [0, 0, 1]),
    axisMate('front', 'Front face', [0, 0, thickness], [0, 0, 1]),
  ];
  return { solid, mates };
}

const gearParams: PartModule['params'] = [
  { key: 'module', label: 'Module', type: 'number', default: 1, min: 0.4, max: 5, step: 0.1, unit: 'mm' },
  { key: 'teeth', label: 'Teeth', type: 'int', default: 30, min: 8, max: 100 },
  { key: 'thickness', label: 'Thickness', type: 'number', default: 6, min: 1, max: 40, step: 0.2, unit: 'mm' },
  { key: 'bore', label: 'Bore', type: 'number', default: 4, min: 0, max: 30, step: 0.1, unit: 'mm' },
  { key: 'pressure', label: 'Pressure angle', type: 'number', default: 20, min: 14, max: 25, step: 1, unit: '°' },
  { key: 'backlash', label: 'Backlash', type: 'number', default: 0.12, min: 0, max: 1, step: 0.01, unit: 'mm', help: 'Gap so printed teeth do not fuse.' },
  { key: 'hubD', label: 'Hub diameter', type: 'number', default: 0, min: 0, max: 60, step: 0.5, unit: 'mm' },
  { key: 'hubH', label: 'Hub extra height', type: 'number', default: 0, min: 0, max: 20, step: 0.5, unit: 'mm' },
  { key: 'keyway', label: 'Keyway', type: 'bool', default: false },
  { key: 'keyW', label: 'Key width', type: 'number', default: 2, min: 0.5, max: 8, step: 0.1, unit: 'mm' },
  { key: 'keyD', label: 'Key depth', type: 'number', default: 1, min: 0.3, max: 4, step: 0.1, unit: 'mm' },
];

export const spurGear: PartModule = {
  id: 'spur-gear',
  name: 'Spur gear',
  category: 'Gears',
  blurb: 'Involute spur gear with bore, hub, and keyway.',
  help: 'Center distance to a mate is module × (teeth + mate teeth) / 2. Origin is the bore center on the back face. Axis +Z.',
  tags: ['gear', 'spur', 'involute', 'drivetrain'],
  color: '#d08a3a',
  params: gearParams,
  build: (p) => gearSolid(p, 'spur'),
};

export const helicalGear: PartModule = {
  id: 'helical-gear',
  name: 'Helical gear',
  category: 'Gears',
  blurb: 'Twisted spur for quieter mesh. Needs a thrust surface.',
  help: 'Opposite hands mesh: use a positive helix on one gear and the negative on its mate. Axis +Z.',
  tags: ['gear', 'helical'],
  color: '#e0a15a',
  params: [...gearParams, { key: 'helix', label: 'Helix angle', type: 'number', default: 18, min: -40, max: 40, step: 1, unit: '°' }],
  build: (p) => gearSolid(p, 'helical'),
};

export const herringboneGear: PartModule = {
  id: 'herringbone-gear',
  name: 'Herringbone gear',
  category: 'Gears',
  blurb: 'Double helical. Prints without a side load and stays on the shaft.',
  help: 'Pair two herringbones of opposite... both can use the same sign; the V cancels thrust. Keep helix under 25° so the midplane prints cleanly.',
  tags: ['gear', 'herringbone', 'print'],
  color: '#c9843a',
  params: [...gearParams, { key: 'helix', label: 'Helix angle', type: 'number', default: 18, min: 8, max: 35, step: 1, unit: '°' }],
  build: (p) => gearSolid(p, 'herringbone'),
};

export const bevelGear: PartModule = {
  id: 'bevel-gear',
  name: 'Bevel gear',
  category: 'Gears',
  blurb: 'Straight bevel for a 90° shaft pair.',
  help: 'Set mate teeth to the other gear. Pitch angles add to 90°. Put the big end (heel) on the bed. Axis +Z, heel at z = 0.',
  tags: ['gear', 'bevel', '90'],
  color: '#b87432',
  params: [
    { key: 'module', label: 'Module at heel', type: 'number', default: 1, min: 0.5, max: 4, step: 0.1, unit: 'mm' },
    { key: 'teeth', label: 'Teeth', type: 'int', default: 24, min: 10, max: 80 },
    { key: 'mateTeeth', label: 'Mate teeth', type: 'int', default: 24, min: 10, max: 80 },
    { key: 'face', label: 'Face width', type: 'number', default: 8, min: 2, max: 30, step: 0.5, unit: 'mm' },
    { key: 'bore', label: 'Bore', type: 'number', default: 4, min: 0, max: 20, step: 0.1, unit: 'mm' },
    { key: 'backlash', label: 'Backlash', type: 'number', default: 0.15, min: 0, max: 1, step: 0.01, unit: 'mm' },
  ],
  build: (p) => {
    const module = clamp(num(p, 'module', 1), 0.4, 5);
    const teeth = clamp(int(p, 'teeth', 24), 10, 80);
    const mate = clamp(int(p, 'mateTeeth', 24), 10, 80);
    const face = clamp(num(p, 'face', 8), 2, 40);
    const bore = clamp(num(p, 'bore', 4), 0, 30);
    const backlash = clamp(num(p, 'backlash', 0.15), 0, 1);
    const pitchAngle = Math.atan(teeth / mate);
    const rp = (module * teeth) / 2;
    const toeR = Math.max(rp * 0.35, rp - face * Math.sin(pitchAngle));
    const scale = toeR / rp;
    const height = Math.max(1, face * Math.cos(pitchAngle));
    const poly = spurPolygon(module, teeth, 20, backlash);
    let solid = K.extrude(K.section(poly), height, 2, 0, [scale, scale]);
    if (bore > 0.3) {
      solid = K.subtract(solid, [K.moved(K.cylinder(height + 2, bore / 2, bore / 2, seg(bore / 2)), [0, 0, -1])]);
    }
    return {
      solid,
      mates: [
        axisMate('heel', 'Heel', [0, 0, 0], [0, 0, 1]),
        axisMate('toe', 'Toe', [0, 0, height], [0, 0, 1]),
      ],
    };
  },
};

export const ringGear: PartModule = {
  id: 'ring-gear',
  name: 'Internal ring gear',
  category: 'Gears',
  blurb: 'Internal involute ring for a planetary or idler.',
  help: 'Mesh a spur pinion inside it. The pinion tooth count must be smaller, and the center distance is module × (ring teeth − pinion teeth) / 2.',
  tags: ['gear', 'internal', 'planetary'],
  color: '#a86b2d',
  params: [
    { key: 'module', label: 'Module', type: 'number', default: 1, min: 0.5, max: 3, step: 0.1, unit: 'mm' },
    { key: 'teeth', label: 'Teeth', type: 'int', default: 48, min: 20, max: 120 },
    { key: 'thickness', label: 'Thickness', type: 'number', default: 6, min: 1, max: 30, step: 0.2, unit: 'mm' },
    { key: 'rim', label: 'Rim thickness', type: 'number', default: 4, min: 1.5, max: 15, step: 0.2, unit: 'mm' },
    { key: 'backlash', label: 'Backlash', type: 'number', default: 0.15, min: 0, max: 1, step: 0.01, unit: 'mm' },
  ],
  build: (p) => {
    const module = clamp(num(p, 'module', 1), 0.4, 4);
    const teeth = clamp(int(p, 'teeth', 48), 20, 140);
    const thickness = clamp(num(p, 'thickness', 6), 1, 40);
    const rim = clamp(num(p, 'rim', 4), 1.2, 20);
    const backlash = clamp(num(p, 'backlash', 0.15), 0, 1);
    const rp = (module * teeth) / 2;
    const tipR = rp - module;
    const rootR = rp + module * 1.15;
    const outer = rootR + rim;
    const poly = spurPolygon(module, teeth, 20, backlash);
    const cutter = K.extrude(K.section(poly), thickness + 2, 0, 0);
    const blank = K.extrude(K.profileSub(K.circle(outer, seg(outer)), K.circle(Math.max(0.5, tipR - module * 0.15), seg(tipR))), thickness);
    const solid = K.subtract(blank, [K.moved(cutter, [0, 0, -1])]);
    return { solid, mates: [axisMate('center', 'Center', [0, 0, thickness / 2], [0, 0, 1])] };
  },
};

export const gearRack: PartModule = {
  id: 'gear-rack',
  name: 'Gear rack',
  category: 'Gears',
  blurb: 'Straight rack that meshes with a spur of the same module.',
  help: 'Tooth pitch is π × module. The pitch line is z = 0 in the profile; the solid sits with the pitch line at the top of the root. Length runs along X. Mate a spur so its pitch circle is tangent to the pitch line.',
  tags: ['gear', 'rack', 'linear'],
  color: '#c47b38',
  params: [
    { key: 'module', label: 'Module', type: 'number', default: 1, min: 0.5, max: 4, step: 0.1, unit: 'mm' },
    { key: 'teeth', label: 'Teeth', type: 'int', default: 16, min: 3, max: 80 },
    { key: 'thickness', label: 'Thickness', type: 'number', default: 6, min: 1, max: 30, step: 0.2, unit: 'mm' },
    { key: 'height', label: 'Body height', type: 'number', default: 8, min: 3, max: 40, step: 0.5, unit: 'mm' },
    { key: 'backlash', label: 'Backlash', type: 'number', default: 0.1, min: 0, max: 1, step: 0.01, unit: 'mm' },
  ],
  build: (p) => {
    const module = clamp(num(p, 'module', 1), 0.4, 5);
    const teeth = clamp(int(p, 'teeth', 16), 2, 100);
    const thickness = clamp(num(p, 'thickness', 6), 1, 40);
    const height = clamp(num(p, 'height', 8), 2, 50);
    const backlash = clamp(num(p, 'backlash', 0.1), 0, 1);
    const pitch = Math.PI * module;
    const addendum = module;
    const dedendum = 1.25 * module;
    const pa = (20 * Math.PI) / 180;
    const halfTop = pitch / 4 - backlash / 2 - addendum * Math.tan(pa);
    const halfRoot = pitch / 4 - backlash / 2 + dedendum * Math.tan(pa);
    const pts: Vec2[] = [[0, 0], [0, height - dedendum]];
    for (let i = 0; i < teeth; i++) {
      const x = i * pitch;
      pts.push([x + pitch / 2 - halfRoot, height - dedendum]);
      pts.push([x + pitch / 2 - Math.max(0.15, halfTop), height + addendum]);
      pts.push([x + pitch / 2 + Math.max(0.15, halfTop), height + addendum]);
      pts.push([x + pitch / 2 + halfRoot, height - dedendum]);
    }
    const length = teeth * pitch;
    pts.push([length, height - dedendum], [length, 0]);
    pts.reverse();
    const solid = K.extrude(K.section(pts), thickness);
    return {
      solid,
      mates: [
        axisMate('pitch-start', 'Pitch start', [0, height, thickness / 2], [1, 0, 0], [0, 0, 1]),
        axisMate('center', 'Center', [length / 2, height / 2, thickness / 2], [0, 0, 1]),
      ],
    };
  },
};

export const worm: PartModule = {
  id: 'worm',
  name: 'Worm',
  category: 'Gears',
  blurb: 'Single-start worm. Drive a spur sideways for a big reduction.',
  help: 'Pitch equals π × module × teeth of a normal gear only if you use the axial pitch shown. Here the axial pitch is π × module so it can drive a spur of that module. Axis +Z.',
  tags: ['worm', 'gear', 'reduction'],
  color: '#8d6a45',
  params: [
    { key: 'module', label: 'Module', type: 'number', default: 1, min: 0.6, max: 3, step: 0.1, unit: 'mm' },
    { key: 'length', label: 'Length', type: 'number', default: 24, min: 8, max: 80, step: 1, unit: 'mm' },
    { key: 'bore', label: 'Bore', type: 'number', default: 4, min: 0, max: 12, step: 0.1, unit: 'mm' },
  ],
  build: (p) => {
    const module = clamp(num(p, 'module', 1), 0.5, 4);
    const length = clamp(num(p, 'length', 24), 6, 100);
    const bore = clamp(num(p, 'bore', 4), 0, 16);
    const root = Math.max(bore / 2 + 1.2, module * 3);
    const crest = root + module;
    const pitch = Math.PI * module;
    const half = pitch * 0.18;
    const bump: Vec2[] = [
      [root, -half],
      [crest, -half * 0.45],
      [crest, half * 0.45],
      [root, half],
    ];
    const profile = K.profileAdd(K.circle(root, seg(root)), K.section(bump));
    const turns = length / pitch;
    const div = clamp(Math.ceil(turns * 18), 8, 220);
    let solid = K.extrude(profile, length, div, turns * 360);
    if (bore > 0.3) {
      solid = K.subtract(solid, [K.moved(K.cylinder(length + 2, bore / 2, bore / 2, seg(bore / 2)), [0, 0, -1])]);
    }
    return { solid, mates: [axisMate('center', 'Center', [0, 0, length / 2], [0, 0, 1])] };
  },
};

export const gt2Pulley: PartModule = {
  id: 'gt2-pulley',
  name: 'GT2 pulley',
  category: 'Gears',
  blurb: '2 mm pitch timing pulley with optional flanges.',
  help: 'Pitch diameter is teeth × 2 / π. A 20 tooth pulley is the usual hobby size. Bore is centered. Axis +Z.',
  tags: ['pulley', 'gt2', 'belt', 'timing'],
  color: '#d7a15a',
  params: [
    { key: 'teeth', label: 'Teeth', type: 'int', default: 20, min: 10, max: 80 },
    { key: 'width', label: 'Belt width', type: 'number', default: 6, min: 3, max: 15, step: 0.5, unit: 'mm' },
    { key: 'bore', label: 'Bore', type: 'number', default: 5, min: 0, max: 16, step: 0.1, unit: 'mm' },
    { key: 'flanges', label: 'Flanges', type: 'bool', default: true },
  ],
  build: (p) => {
    const teeth = clamp(int(p, 'teeth', 20), 8, 90);
    const width = clamp(num(p, 'width', 6), 2, 20);
    const bore = clamp(num(p, 'bore', 5), 0, 20);
    const flanges = bool(p, 'flanges', true);
    const pitch = 2;
    const outer = (teeth * pitch) / (2 * Math.PI);
    const pts: Vec2[] = [];
    const samples = teeth * 8;
    for (let i = 0; i < samples; i++) {
      const u = (i % 8) / 8;
      const a = (i / samples) * Math.PI * 2;
      let radial = outer;
      if (u > 0.2 && u < 0.8) {
        const g = (u - 0.2) / 0.6;
        const depth = g < 0.18 ? g / 0.18 : g > 0.82 ? (1 - g) / 0.18 : 1;
        radial = outer - 0.75 * depth;
      }
      pts.push([Math.cos(a) * radial, Math.sin(a) * radial]);
    }
    let profile = K.section(pts);
    if (bore > 0.3) profile = K.profileSub(profile, K.circle(bore / 2, seg(bore / 2)));
    let solid = K.extrude(profile, width);
    if (flanges) {
      const flangeT = 1.1;
      const flangeR = outer + 1.3;
      let disk = K.circle(flangeR, seg(flangeR));
      if (bore > 0.3) disk = K.profileSub(disk, K.circle(bore / 2, seg(bore / 2)));
      const a = K.moved(K.extrude(disk, flangeT), [0, 0, -flangeT]);
      let disk2 = K.circle(flangeR, seg(flangeR));
      if (bore > 0.3) disk2 = K.profileSub(disk2, K.circle(bore / 2, seg(bore / 2)));
      const b = K.moved(K.extrude(disk2, flangeT), [0, 0, width]);
      solid = K.union([solid, a, b]);
    }
    return { solid, mates: [axisMate('center', 'Center', [0, 0, width / 2], [0, 0, 1])] };
  },
};

export const veePulley: PartModule = {
  id: 'vee-pulley',
  name: 'V pulley',
  category: 'Gears',
  blurb: 'Round-belt or O-ring pulley with a V groove.',
  help: 'Groove is sized for a 3–5 mm O-ring or a small round belt. Axis +Z.',
  tags: ['pulley', 'oring', 'belt'],
  color: '#c9c1b4',
  params: [
    { key: 'od', label: 'Outside diameter', type: 'number', default: 30, min: 10, max: 120, step: 1, unit: 'mm' },
    { key: 'width', label: 'Width', type: 'number', default: 8, min: 4, max: 30, step: 0.5, unit: 'mm' },
    { key: 'groove', label: 'Groove diameter', type: 'number', default: 3, min: 1.5, max: 8, step: 0.1, unit: 'mm' },
    { key: 'bore', label: 'Bore', type: 'number', default: 5, min: 0, max: 20, step: 0.1, unit: 'mm' },
  ],
  build: (p) => {
    const od = clamp(num(p, 'od', 30), 8, 140);
    const width = clamp(num(p, 'width', 8), 3, 40);
    const groove = clamp(num(p, 'groove', 3), 1, 10);
    const bore = clamp(num(p, 'bore', 5), 0, od / 2 - 2);
    const r = od / 2;
    const y0 = -width / 2;
    const y1 = width / 2;
    const mid = 0;
    const gr = groove / 2;
    const pts: Vec2[] = [
      [Math.max(bore / 2 + 1, r * 0.35), y0],
      [r, y0],
      [r, mid - gr],
      [r - gr, mid],
      [r, mid + gr],
      [r, y1],
      [Math.max(bore / 2 + 1, r * 0.35), y1],
    ];
    let solid = K.revolve(K.section(pts), seg(r));
    if (bore > 0.3) solid = K.subtract(solid, [K.cylinder(width + 2, bore / 2, bore / 2, seg(bore / 2), true)]);
    return { solid, mates: [axisMate('center', 'Center', [0, 0, 0], [0, 0, 1])] };
  },
};

export const shaftCoupler: PartModule = {
  id: 'shaft-coupler',
  name: 'Shaft coupler',
  category: 'Gears',
  blurb: 'Rigid coupler with two bores and set-screw holes.',
  help: 'Bores meet in the middle with a solid wall between them. Set screws are M3-sized radial holes. Axis +Z.',
  tags: ['coupler', 'shaft', 'setscrew'],
  color: '#8d97a3',
  params: [
    { key: 'od', label: 'Outside diameter', type: 'number', default: 16, min: 8, max: 40, step: 0.5, unit: 'mm' },
    { key: 'length', label: 'Length', type: 'number', default: 24, min: 10, max: 60, step: 1, unit: 'mm' },
    { key: 'boreA', label: 'Bore A', type: 'number', default: 5, min: 2, max: 16, step: 0.1, unit: 'mm' },
    { key: 'boreB', label: 'Bore B', type: 'number', default: 5, min: 2, max: 16, step: 0.1, unit: 'mm' },
    { key: 'setScrew', label: 'Set-screw holes', type: 'bool', default: true },
  ],
  build: (p) => {
    const od = clamp(num(p, 'od', 16), 6, 50);
    const length = clamp(num(p, 'length', 24), 8, 80);
    const boreA = clamp(num(p, 'boreA', 5), 1, od - 3);
    const boreB = clamp(num(p, 'boreB', 5), 1, od - 3);
    let solid = K.cylinder(length, od / 2, od / 2, seg(od / 2));
    const holeA = K.cylinder(length / 2 + 0.2, boreA / 2, boreA / 2, seg(boreA / 2));
    const holeB = K.moved(K.cylinder(length / 2 + 0.2, boreB / 2, boreB / 2, seg(boreB / 2)), [0, 0, length / 2 - 0.2]);
    solid = K.subtract(solid, [holeA, holeB]);
    if (bool(p, 'setScrew', true)) {
      const screw = K.turned(K.cylinder(od, 1.25, 1.25, 20), [0, 90, 0]);
      solid = K.subtract(solid, [
        K.moved(K.cloneSolid(screw), [0, 0, length * 0.22]),
        K.moved(screw, [0, 0, length * 0.78]),
      ]);
    }
    return {
      solid,
      mates: [
        axisMate('a', 'Bore A', [0, 0, 0], [0, 0, 1]),
        axisMate('b', 'Bore B', [0, 0, length], [0, 0, -1], [1, 0, 0]),
      ],
    };
  },
};

export const universalJoint: PartModule = {
  id: 'universal-joint',
  name: 'Universal joint',
  category: 'Gears',
  blurb: 'Print-in-place U-joint with clearance so the cross can turn.',
  help: 'Print with the bores vertical. Default gap is 0.35 mm. Do not scale it afterwards or the clearance closes. Two shaft mates sit on the bores.',
  tags: ['ujoint', 'print-in-place', 'shaft'],
  color: '#9aa3ad',
  params: [
    { key: 'bore', label: 'Bore', type: 'number', default: 4, min: 2, max: 10, step: 0.1, unit: 'mm' },
    { key: 'size', label: 'Swing diameter', type: 'number', default: 22, min: 14, max: 40, step: 1, unit: 'mm' },
    { key: 'gap', label: 'Clearance', type: 'number', default: 0.35, min: 0.2, max: 0.6, step: 0.05, unit: 'mm' },
  ],
  build: (p) => {
    const bore = clamp(num(p, 'bore', 4), 2, 12);
    const size = clamp(num(p, 'size', 22), 12, 48);
    const gap = clamp(num(p, 'gap', 0.35), 0.15, 0.8);
    const pin = Math.max(2.2, bore * 0.7);
    const yokeLen = size * 0.55;
    const armT = Math.max(3, pin + 1.6);
    const spread = pin + gap * 2 + armT;

    const hub = (z: number, dir: number) => {
      let h = K.cylinder(yokeLen, bore * 0.95, bore * 0.95, seg(bore));
      h = K.subtract(h, [K.moved(K.cylinder(yokeLen + 2, bore / 2, bore / 2, seg(bore / 2)), [0, 0, -1])]);
      h = K.moved(h, [0, 0, z]);
      const prongA = K.moved(K.box([armT, size * 0.42, armT], true), [0, spread / 2, z + dir * (yokeLen - armT / 2)]);
      const prongB = K.moved(K.box([armT, size * 0.42, armT], true), [0, -spread / 2, z + dir * (yokeLen - armT / 2)]);
      let yoke = K.union([h, prongA, prongB]);
      const pinHole = K.turned(K.cylinder(size, (pin + gap) / 2, (pin + gap) / 2, seg(pin)), [90, 0, 0]);
      yoke = K.subtract(yoke, [K.moved(pinHole, [0, 0, z + dir * (yokeLen - armT / 2)])]);
      return yoke;
    };

    const yokeA = hub(0, 1);
    let yokeB = hub(0, 1);
    yokeB = K.turned(yokeB, [0, 0, 90]);
    yokeB = K.turned(yokeB, [180, 0, 0]);
    yokeB = K.moved(yokeB, [0, 0, yokeLen * 2 - armT]);

    const crossZ = yokeLen - armT / 2;
    let cross = K.turned(K.cylinder(size * 0.7, pin / 2, pin / 2, seg(pin), true), [90, 0, 0]);
    const cross2 = K.turned(K.cylinder(size * 0.7, pin / 2, pin / 2, seg(pin), true), [0, 90, 0]);
    cross = K.union([cross, cross2, K.sphere(pin * 0.65, 24)]);
    cross = K.moved(cross, [0, 0, crossZ]);
    const caps = K.union([
      K.moved(K.cylinder(1.2, pin * 0.85, pin * 0.85, 20, true), [0, size * 0.32, crossZ]),
      K.moved(K.cylinder(1.2, pin * 0.85, pin * 0.85, 20, true), [0, -size * 0.32, crossZ]),
    ]);
    return {
      solid: K.union([yokeA, yokeB, cross, caps]),
      mates: [
        axisMate('a', 'Bore A', [0, 0, 0], [0, 0, -1], [1, 0, 0]),
        axisMate('b', 'Bore B', [0, 0, yokeLen * 2 - armT], [0, 0, 1]),
      ],
    };
  },
};

export const servoHorn: PartModule = {
  id: 'servo-horn',
  name: 'Servo horn',
  category: 'Gears',
  blurb: 'Arm, disc, or star horn with a spline bore.',
  help: 'The bore is a toothed socket for an SG90-style spline. It is a press fit at 4.6 mm. Axis +Z, sitting on the bed.',
  tags: ['servo', 'horn', 'sg90'],
  color: '#d7d2c8',
  params: [
    { key: 'style', label: 'Style', type: 'select', default: 'arm', options: [
      { value: 'arm', label: 'Single arm' },
      { value: 'disc', label: 'Disc' },
      { value: 'star', label: 'Four arm' },
    ] },
    { key: 'reach', label: 'Reach', type: 'number', default: 18, min: 8, max: 40, step: 0.5, unit: 'mm' },
    { key: 'thickness', label: 'Thickness', type: 'number', default: 2, min: 1.2, max: 4, step: 0.1, unit: 'mm' },
    { key: 'hole', label: 'Link hole', type: 'number', default: 1.6, min: 1, max: 3, step: 0.1, unit: 'mm' },
  ],
  build: (p) => {
    const style = str(p, 'style', 'arm');
    const reach = clamp(num(p, 'reach', 18), 6, 50);
    const thickness = clamp(num(p, 'thickness', 2), 1, 5);
    const hole = clamp(num(p, 'hole', 1.6), 0.8, 4);
    const spline = 4.7;
    const boss = K.cylinder(thickness + 1.5, 3.4, 3.4, 32);
    let plate: K.Solid;
    if (style === 'disc') {
      plate = K.cylinder(thickness, reach, reach, seg(reach));
    } else if (style === 'star') {
      const arms: K.Solid[] = [];
      for (let i = 0; i < 4; i++) {
        const arm = K.moved(K.box([reach, 5, thickness], false), [0, -2.5, 0]);
        arms.push(K.turned(arm, [0, 0, i * 90]));
      }
      plate = K.union(arms);
    } else {
      plate = K.moved(K.box([reach, 6, thickness], false), [0, -3, 0]);
    }
    let solid = K.union([plate, boss]);
    const teeth: K.Solid[] = [];
    const n = 20;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      teeth.push(K.moved(K.box([0.55, 0.7, thickness + 2], true), [Math.cos(a) * (spline / 2), Math.sin(a) * (spline / 2), thickness / 2]));
    }
    let socket = K.cylinder(thickness + 4, spline / 2 - 0.15, spline / 2 - 0.15, 28);
    socket = K.subtract(socket, teeth);
    solid = K.subtract(solid, [K.moved(socket, [0, 0, -1])]);
    const link = K.cylinder(thickness + 2, hole / 2, hole / 2, 16);
    if (style === 'disc') {
      solid = K.subtract(solid, [K.moved(K.cloneSolid(link), [reach * 0.7, 0, -1]), K.moved(link, [-reach * 0.7, 0, -1])]);
    } else if (style === 'star') {
      const holes: K.Solid[] = [];
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        holes.push(K.moved(K.cloneSolid(link), [Math.cos(a) * (reach - 3), Math.sin(a) * (reach - 3), -1]));
      }
      link.delete();
      solid = K.subtract(solid, holes);
    } else {
      solid = K.subtract(solid, [K.moved(link, [reach - 3, 0, -1])]);
    }
    return { solid, mates: [axisMate('spline', 'Spline', [0, 0, 0], [0, 0, 1])] };
  },
};

export const gearParts: PartModule[] = [
  spurGear,
  helicalGear,
  herringboneGear,
  bevelGear,
  ringGear,
  gearRack,
  worm,
  gt2Pulley,
  veePulley,
  shaftCoupler,
  universalJoint,
  servoHorn,
];
