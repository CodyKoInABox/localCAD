import type { Mate, Params, PartModule, Vec2 } from '../cad/types.ts';
import { axisMate, clamp, int, num, seg, str } from '../cad/math.ts';
import * as K from '../cad/kernel.ts';

function tireProfile(inner: number, outer: number, width: number, shoulder: number): Vec2[] {
  const y0 = -width / 2;
  const y1 = width / 2;
  return [
    [inner, y0],
    [outer - shoulder, y0],
    [outer, y0 + shoulder],
    [outer, y1 - shoulder],
    [outer - shoulder, y1],
    [inner, y1],
  ];
}

export const rcWheel: PartModule = {
  id: 'rc-wheel',
  name: 'RC wheel',
  category: 'Wheels',
  blurb: 'Tire plus rim. Round bore or 12 mm hex.',
  help: 'Axle axis is +Y so the wheel stands up for a car. Origin is the hub center. Hex across-flats is the drive size. Tread can be slick, rib, or knobby.',
  tags: ['wheel', 'tire', 'rc', 'hex'],
  color: '#2c2c2c',
  params: [
    { key: 'od', label: 'Tire diameter', type: 'number', default: 64, min: 20, max: 140, step: 1, unit: 'mm' },
    { key: 'width', label: 'Width', type: 'number', default: 26, min: 8, max: 60, step: 1, unit: 'mm' },
    { key: 'bore', label: 'Bore', type: 'number', default: 4.2, min: 0, max: 16, step: 0.1, unit: 'mm' },
    { key: 'hex', label: 'Hex across flats', type: 'number', default: 0, min: 0, max: 17, step: 0.5, unit: 'mm', help: '0 uses the round bore.' },
    { key: 'tread', label: 'Tread', type: 'select', default: 'slick', options: [
      { value: 'slick', label: 'Slick' },
      { value: 'rib', label: 'Rib' },
      { value: 'knobby', label: 'Knobby' },
    ] },
  ],
  build: (p) => {
    const od = clamp(num(p, 'od', 64), 16, 160);
    const width = clamp(num(p, 'width', 26), 6, 70);
    const bore = clamp(num(p, 'bore', 4.2), 0, od / 3);
    const hex = clamp(num(p, 'hex', 0), 0, od / 3);
    const tread = str(p, 'tread', 'slick');
    const outer = od / 2;
    const inner = outer * 0.62;
    const shoulder = Math.max(1.2, width * 0.12);
    let tire = K.revolve(K.section(tireProfile(inner - 0.6, outer, width, shoulder)), seg(outer));
    const rimPts: Vec2[] = [
      [Math.max(bore, hex / Math.sqrt(3)) + 1.2, -width * 0.32],
      [inner + 0.4, -width * 0.32],
      [inner + 0.8, -width * 0.42],
      [inner + 0.8, width * 0.42],
      [inner + 0.4, width * 0.32],
      [Math.max(bore, hex / Math.sqrt(3)) + 1.2, width * 0.32],
    ];
    const rim = K.revolve(K.section(rimPts), seg(inner));
    let solid = K.union([tire, rim]);
    if (hex > 1) {
      const hole = K.turned(K.extrude(K.section(hexagon(hex)), width + 4), [90, 0, 0]);
      solid = K.subtract(solid, [K.moved(hole, [0, -width / 2 - 2, 0])]);
    } else if (bore > 0.3) {
      const hole = K.turned(K.cylinder(width + 4, bore / 2, bore / 2, seg(bore / 2)), [90, 0, 0]);
      solid = K.subtract(solid, [K.moved(hole, [0, -width / 2 - 2, 0])]);
    }
    if (tread === 'rib') {
      const rib = K.revolve(
        K.section([
          [outer - 0.2, -1],
          [outer + 0.7, -0.6],
          [outer + 0.7, 0.6],
          [outer - 0.2, 1],
        ]),
        seg(outer),
      );
      solid = K.union([solid, rib]);
    } else if (tread === 'knobby') {
      const knobs: K.Solid[] = [];
      const count = Math.max(8, Math.round(outer * 0.7));
      for (let row = -1; row <= 1; row += 2) {
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2 + (row > 0 ? 0.15 : 0);
          const knob = K.box([3.2, 4.2, 2.2], true);
          let placed = K.moved(knob, [outer - 0.2, row * width * 0.22, 0]);
          placed = K.turned(placed, [0, 0, (a * 180) / Math.PI]);
          knobs.push(placed);
        }
      }
      solid = K.union([solid, ...knobs]);
    }
    solid = K.turned(solid, [-90, 0, 0]);
    const mates: Mate[] = [
      axisMate('axle', 'Axle', [0, 0, 0], [0, 1, 0], [0, 0, 1]),
      axisMate('left', 'Left face', [0, -width / 2, 0], [0, -1, 0], [1, 0, 0]),
      axisMate('right', 'Right face', [0, width / 2, 0], [0, 1, 0], [1, 0, 0]),
    ];
    return { solid, mates };
  },
};

function hexagon(acrossFlats: number): [number, number][] {
  const r = acrossFlats / Math.sqrt(3);
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

export const hexHub: PartModule = {
  id: 'hex-hub',
  name: 'Hex hub',
  category: 'Wheels',
  blurb: '12 mm hex adapter from a round shaft.',
  help: 'Hex axis is +Z. The round bore goes all the way through, with a set-screw hole.',
  tags: ['hex', 'hub', 'wheel'],
  color: '#b7b1a8',
  params: [
    { key: 'hex', label: 'Hex across flats', type: 'number', default: 12, min: 7, max: 17, step: 0.5, unit: 'mm' },
    { key: 'length', label: 'Length', type: 'number', default: 12, min: 4, max: 30, step: 0.5, unit: 'mm' },
    { key: 'bore', label: 'Shaft bore', type: 'number', default: 4, min: 2, max: 8, step: 0.1, unit: 'mm' },
  ],
  build: (p) => {
    const hex = clamp(num(p, 'hex', 12), 6, 20);
    const length = clamp(num(p, 'length', 12), 3, 40);
    const bore = clamp(num(p, 'bore', 4), 1.5, hex - 2);
    let solid = K.extrude(K.section(hexagon(hex)), length);
    solid = K.subtract(solid, [
      K.moved(K.cylinder(length + 2, bore / 2, bore / 2, seg(bore / 2)), [0, 0, -1]),
      K.moved(K.turned(K.cylinder(hex, 1.2, 1.2, 16), [0, 90, 0]), [0, 0, length / 2]),
    ]);
    return { solid, mates: [axisMate('axis', 'Axis', [0, 0, length / 2], [0, 0, 1])] };
  },
};

export const casterWheel: PartModule = {
  id: 'caster',
  name: 'Swivel caster',
  category: 'Wheels',
  blurb: 'Print-in-place swivel caster with a captured pin.',
  help: 'The fork can spin on the kingpin because of the clearance gap. Do not scale the part after placing it.',
  tags: ['caster', 'wheel', 'print-in-place'],
  color: '#3a3a3a',
  params: [
    { key: 'diameter', label: 'Wheel diameter', type: 'number', default: 30, min: 16, max: 60, step: 1, unit: 'mm' },
    { key: 'gap', label: 'Clearance', type: 'number', default: 0.35, min: 0.2, max: 0.6, step: 0.05, unit: 'mm' },
  ],
  build: (p) => {
    const d = clamp(num(p, 'diameter', 30), 14, 70);
    const gap = clamp(num(p, 'gap', 0.35), 0.15, 0.7);
    const plate = K.cylinder(3, 12, 12, 32);
    const pin = K.moved(K.cylinder(14, 2.2, 2.2, 20), [0, 0, 3]);
    const cap = K.moved(K.cylinder(1.4, 4, 4, 20), [0, 0, 16.2]);
    const forkH = d / 2 + 8;
    let fork = K.moved(K.box([8, 22, forkH], false), [-4, -11, 3]);
    fork = K.subtract(fork, [
      K.moved(K.cylinder(10, 2.2 + gap, 2.2 + gap, 20), [0, 0, 2]),
      K.moved(K.box([10, 10, forkH], false), [-5, -5, 6]),
    ]);
    const axle = K.moved(K.turned(K.cylinder(20, 1.6, 1.6, 16, true), [90, 0, 0]), [0, 0, 4 + d / 2]);
    const wheel = K.moved(K.turned(K.cylinder(6, d / 2, d / 2, seg(d / 2), true), [90, 0, 0]), [0, 0, 4 + d / 2]);
    const wheelHole = K.moved(K.turned(K.cylinder(8, 1.6 + gap, 1.6 + gap, 16, true), [90, 0, 0]), [0, 0, 4 + d / 2]);
    const wheelSolid = K.subtract(wheel, [wheelHole]);
    return {
      solid: K.union([plate, pin, cap, fork, axle, wheelSolid]),
      mates: [axisMate('plate', 'Plate', [0, 0, 0], [0, 0, 1])],
    };
  },
};

export const omniWheel: PartModule = {
  id: 'omni-wheel',
  name: 'Omni wheel',
  category: 'Wheels',
  blurb: 'Hub with captive rollers around the rim.',
  help: 'Rollers have clearance so they are separate shells in the export. Axis +Y. A small count prints faster.',
  tags: ['omni', 'roller', 'wheel'],
  color: '#444',
  params: [
    { key: 'diameter', label: 'Diameter', type: 'number', default: 48, min: 30, max: 80, step: 1, unit: 'mm' },
    { key: 'rollers', label: 'Rollers', type: 'int', default: 8, min: 6, max: 12 },
    { key: 'bore', label: 'Bore', type: 'number', default: 4, min: 2, max: 10, step: 0.1, unit: 'mm' },
  ],
  build: (p) => {
    const d = clamp(num(p, 'diameter', 48), 24, 90);
    const n = clamp(int(p, 'rollers', 8), 5, 14);
    const bore = clamp(num(p, 'bore', 4), 1.5, 12);
    const gap = 0.4;
    let hub = K.turned(K.cylinder(8, d * 0.28, d * 0.28, seg(d * 0.28), true), [-90, 0, 0]);
    hub = K.subtract(hub, [K.turned(K.cylinder(12, bore / 2, bore / 2, seg(bore / 2), true), [-90, 0, 0])]);
    const rollers: K.Solid[] = [];
    const rollerR = Math.max(2, d * 0.07);
    const rollerLen = Math.max(4, (Math.PI * d) / n - gap * 3);
    const orbit = d / 2 - rollerR;
    for (let i = 0; i < n; i++) {
      let roller = K.cylinder(rollerLen, rollerR, rollerR, 14, true);
      roller = K.moved(roller, [orbit, 0, 0]);
      roller = K.turned(roller, [0, (360 / n) * i, 0]);
      rollers.push(roller);
    }
    return { solid: K.union([hub, ...rollers]), mates: [axisMate('axle', 'Axle', [0, 0, 0], [0, 1, 0], [0, 0, 1])] };
  },
};

export const wheelParts: PartModule[] = [rcWheel, hexHub, casterWheel, omniWheel];
