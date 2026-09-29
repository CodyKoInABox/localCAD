import type { Mate, Params, PartModule, Vec3 } from '../cad/types.ts';
import { axisMate, bool, clamp, num, seg } from '../cad/math.ts';
import * as K from '../cad/kernel.ts';

function board(length: number, width: number, thick: number, holes: Vec3[], holeD: number): K.Solid {
  let solid = K.box([length, width, thick], false);
  const cuts = holes.map((h) => K.moved(K.cylinder(thick + 2, holeD / 2, holeD / 2, seg(holeD / 2)), [h[0], h[1], -1]));
  if (cuts.length) solid = K.subtract(solid, cuts);
  return solid;
}

function holeMates(holes: Vec3[], z: number): Mate[] {
  return holes.map((h, i) => axisMate(`hole-${i + 1}`, `Mount ${i + 1}`, [h[0], h[1], z], [0, 0, 1]));
}

export const arduinoUno: PartModule = {
  id: 'arduino-uno',
  name: 'Arduino Uno',
  category: 'Electronics',
  blurb: 'Uno R3 envelope with USB, barrel jack, headers, and mounting holes.',
  help: 'Holes are the real R3 pattern: 15.24,2.54 / 15.24,50.8 / 66.04,7.62 / 66.04,35.56 mm from the board corner. Origin is that corner on the bed. Use the hole mates for standoffs.',
  tags: ['arduino', 'uno', 'pcb'],
  color: '#2f6f4e',
  params: [
    { key: 'showHeaders', label: 'Headers and connectors', type: 'bool', default: true },
  ],
  build: (p) => {
    const L = 68.58;
    const W = 53.34;
    const T = 1.6;
    const holes: Vec3[] = [
      [15.24, 2.54, 0],
      [15.24, 50.8, 0],
      [66.04, 7.62, 0],
      [66.04, 35.56, 0],
    ];
    let solid = board(L, W, T, holes, 3.2);
    if (bool(p, 'showHeaders', true)) {
      const usb = K.moved(K.box([12, 11, 11], false), [-1.5, 32, T]);
      const jack = K.moved(K.turned(K.cylinder(11, 4.2, 4.2, 24), [0, 90, 0]), [9, 2, T + 6]);
      const digital = K.moved(K.box([50, 2.5, 8.5], false), [16, W - 2.5, T]);
      const power = K.moved(K.box([30, 2.5, 8.5], false), [24, 0, T]);
      solid = K.union([solid, usb, jack, digital, power]);
    }
    return {
      solid,
      mates: [...holeMates(holes, T), axisMate('corner', 'Corner', [0, 0, 0], [0, 0, 1])],
    };
  },
};

export const arduinoNano: PartModule = {
  id: 'arduino-nano',
  name: 'Arduino Nano',
  category: 'Electronics',
  blurb: 'Nano board, 18 × 45 mm, with USB and pin headers.',
  help: 'Origin is a corner on the bed. The USB end is −X. There are no factory mounting holes; the optional holes are a printed-bracket suggestion.',
  tags: ['arduino', 'nano', 'pcb'],
  color: '#2a7a55',
  params: [{ key: 'holes', label: 'Add corner holes', type: 'bool', default: false }],
  build: (p) => {
    const L = 45;
    const W = 18;
    const T = 1.6;
    const holes: Vec3[] = bool(p, 'holes', false)
      ? [
          [2.5, 2.5, 0],
          [2.5, W - 2.5, 0],
          [L - 2.5, 2.5, 0],
          [L - 2.5, W - 2.5, 0],
        ]
      : [];
    let solid = board(L, W, T, holes, 2.2);
    const usb = K.moved(K.box([8, 8, 4], false), [-6, 5, T]);
    const pinsA = K.moved(K.box([L - 6, 2.4, 8], false), [3, -0.4, T]);
    const pinsB = K.moved(K.box([L - 6, 2.4, 8], false), [3, W - 2, T]);
    solid = K.union([solid, usb, pinsA, pinsB]);
    return { solid, mates: [...holeMates(holes, T), axisMate('corner', 'Corner', [0, 0, 0], [0, 0, 1])] };
  },
};

export const arduinoMega: PartModule = {
  id: 'arduino-mega',
  name: 'Arduino Mega',
  category: 'Electronics',
  blurb: 'Mega 2560 envelope, 101.6 × 53.3 mm.',
  help: 'Mounting holes follow the common four-hole pattern used with the Uno spacing on the USB end, plus the far pair. Treat it as a keep-out and a hole pattern, not a fab drawing.',
  tags: ['arduino', 'mega'],
  color: '#347a58',
  params: [],
  build: () => {
    const L = 101.6;
    const W = 53.34;
    const T = 1.6;
    const holes: Vec3[] = [
      [15.24, 2.54, 0],
      [15.24, 50.8, 0],
      [96.52, 2.54, 0],
      [96.52, 50.8, 0],
    ];
    let solid = board(L, W, T, holes, 3.2);
    const usb = K.moved(K.box([12, 11, 11], false), [-1.5, 32, T]);
    const header = K.moved(K.box([82, 2.5, 8.5], false), [16, W - 2.5, T]);
    solid = K.union([solid, usb, header]);
    return { solid, mates: [...holeMates(holes, T), axisMate('corner', 'Corner', [0, 0, 0], [0, 0, 1])] };
  },
};

export const esp32: PartModule = {
  id: 'esp32-devkit',
  name: 'ESP32 DevKit',
  category: 'Electronics',
  blurb: '30-pin DevKit-style board with USB.',
  help: 'Envelope is 55 × 28 mm. Pin rows run along both long edges. Origin is a corner.',
  tags: ['esp32', 'wifi', 'pcb'],
  color: '#1f4d3a',
  params: [],
  build: () => {
    const L = 55;
    const W = 28;
    const T = 1.6;
    let solid = K.box([L, W, T], false);
    const usb = K.moved(K.box([8, 8, 3], false), [-5, 10, T]);
    const pinsA = K.moved(K.box([48, 2.5, 8], false), [3.5, -0.3, T]);
    const pinsB = K.moved(K.box([48, 2.5, 8], false), [3.5, W - 2.2, T]);
    const can = K.moved(K.box([18, 15, 2.5], false), [18, 6, T]);
    solid = K.union([solid, usb, pinsA, pinsB, can]);
    return { solid, mates: [axisMate('corner', 'Corner', [0, 0, 0], [0, 0, 1])] };
  },
};

function servo(body: { l: number; w: number; h: number; span: number; hole: number; holeD: number; shaft: number }): { solid: K.Solid; mates: Mate[] } {
  const { l, w, h, span, hole, holeD, shaft } = body;
  const core = K.moved(K.box([l, w, h], false), [-l / 2, -w / 2, 0]);
  const tabT = 2.4;
  const earL = (span - l) / 2;
  const earA = K.moved(K.box([earL, w, h * 0.55], false), [-span / 2, -w / 2, 0]);
  const earB = K.moved(K.box([earL, w, h * 0.55], false), [l / 2, -w / 2, 0]);
  let solid = K.union([core, earA, earB]);
  const holeA = K.cylinder(h, holeD / 2, holeD / 2, 16);
  solid = K.subtract(solid, [
    K.moved(K.cloneSolid(holeA), [-hole / 2, 0, -0.2]),
    K.moved(holeA, [hole / 2, 0, -0.2]),
  ]);
  const boss = K.moved(K.cylinder(3, shaft / 2 + 1.2, shaft / 2 + 1.2, 24), [0, 0, h]);
  const spline = K.moved(K.cylinder(4, shaft / 2, shaft / 2, 20), [0, 0, h]);
  const cable = K.moved(K.box([6, 4, 2], false), [-3, -2, 1]);
  solid = K.union([solid, boss, spline]);
  solid = K.subtract(solid, [K.moved(cable, [0, w / 2, 0])]);
  return {
    solid,
    mates: [
      axisMate('shaft', 'Output shaft', [0, 0, h + 4], [0, 0, 1]),
      axisMate('mount-a', 'Mount A', [-hole / 2, 0, 0], [0, 0, 1]),
      axisMate('mount-b', 'Mount B', [hole / 2, 0, 0], [0, 0, 1]),
    ],
  };
}

export const servoSg90: PartModule = {
  id: 'servo-sg90',
  name: 'SG90 servo',
  category: 'Electronics',
  blurb: '9 g micro servo. Body 23 × 12.2 × 22.5, mounts 28 mm apart.',
  help: 'Shaft axis is +Z. Mounting holes are vertical. The cable notch is on +Y. Pair it with the servo horn and the servo bracket.',
  tags: ['servo', 'sg90', 'rc'],
  color: '#3d6b8a',
  params: [],
  build: () => servo({ l: 23.2, w: 12.2, h: 22.5, span: 32.5, hole: 28, holeD: 2.1, shaft: 4.6 }),
};

export const servoMg996: PartModule = {
  id: 'servo-mg996',
  name: 'MG996R servo',
  category: 'Electronics',
  blurb: 'Standard-size servo for steering a heavier car.',
  help: 'Body about 40 × 20 × 36 mm. Mounting hole spacing 49 mm. Shaft +Z.',
  tags: ['servo', 'mg996', 'rc'],
  color: '#345e78',
  params: [],
  build: () => servo({ l: 40.5, w: 20, h: 36, span: 54, hole: 49, holeD: 4.2, shaft: 5.8 }),
};

export const motorN20: PartModule = {
  id: 'motor-n20',
  name: 'N20 gearmotor',
  category: 'Electronics',
  blurb: '10 × 12 mm micro gearmotor with a 3 mm shaft.',
  help: 'The gearbox face is +Z. Shaft sticks out of that face. Two M2 mount holes sit on the face. Rotate −90° about X to point the shaft along +Y.',
  tags: ['motor', 'n20', 'gearmotor'],
  color: '#c4553a',
  params: [
    { key: 'length', label: 'Body length', type: 'number', default: 26, min: 12, max: 40, step: 1, unit: 'mm' },
  ],
  build: (p) => {
    const length = clamp(num(p, 'length', 26), 10, 45);
    const body = K.box([12, 10, length], false);
    const centered = K.moved(body, [-6, -5, 0]);
    const shaft = K.moved(K.cylinder(10, 1.5, 1.5, 20), [0, 0, length]);
    const face = K.moved(K.box([12, 10, 1.2], false), [-6, -5, length - 0.2]);
    let solid = K.union([centered, shaft, face]);
    solid = K.subtract(solid, [
      K.moved(K.cylinder(6, 1, 1, 16), [-4, 0, length - 2]),
      K.moved(K.cylinder(6, 1, 1, 16), [4, 0, length - 2]),
    ]);
    return {
      solid,
      mates: [
        axisMate('shaft', 'Shaft', [0, 0, length], [0, 0, 1]),
        axisMate('face', 'Face', [0, 0, length], [0, 0, 1]),
      ],
    };
  },
};

export const motor130: PartModule = {
  id: 'motor-130',
  name: '130 motor',
  category: 'Electronics',
  blurb: 'Small can motor, about 20 × 15 mm body, 2 mm shaft.',
  help: 'Can axis is +Z. A flat mounting tab is optional. Shaft exits +Z.',
  tags: ['motor', '130', 'dc'],
  color: '#b7b1a8',
  params: [],
  build: () => {
    const can = K.cylinder(25, 10.2, 10.2, seg(10));
    const shaft = K.moved(K.cylinder(8, 1, 1, 16), [0, 0, 25]);
    const endcap = K.moved(K.cylinder(1.5, 10.6, 10.6, seg(10)), [0, 0, 24]);
    return { solid: K.union([can, shaft, endcap]), mates: [axisMate('shaft', 'Shaft', [0, 0, 25], [0, 0, 1])] };
  },
};

const CANS: Record<string, { d: number; l: number; shaft: number; shaftL: number }> = {
  '365': { d: 27.7, l: 38, shaft: 2.3, shaftL: 10 },
  '540': { d: 35.8, l: 52, shaft: 3.175, shaftL: 15 },
  '550': { d: 36, l: 57, shaft: 3.175, shaftL: 15 },
  '775': { d: 42, l: 67, shaft: 5, shaftL: 17 },
};

export const canMotor: PartModule = {
  id: 'can-motor',
  name: 'Can motor',
  category: 'Electronics',
  blurb: '365, 540, 550, or 775 brushed can.',
  help: 'Shaft exits +Z. The can sits on the bed. 540 is the usual RC car motor. Front face has two M3 holes on a 25 mm span for the 540 class.',
  tags: ['motor', '540', '550', '775'],
  color: '#d9d3c7',
  params: [
    { key: 'preset', label: 'Size', type: 'select', default: '540', options: ['365', '540', '550', '775'].map((v) => ({ value: v, label: v })) },
  ],
  build: (p) => {
    const spec = CANS[String(p.preset ?? '540')] ?? CANS['540'];
    const can = K.cylinder(spec.l, spec.d / 2, spec.d / 2, seg(spec.d / 2));
    const shaft = K.moved(K.cylinder(spec.shaftL, spec.shaft / 2, spec.shaft / 2, seg(spec.shaft / 2)), [0, 0, spec.l]);
    let solid = K.union([can, shaft]);
    if (spec.d > 30) {
      solid = K.subtract(solid, [
        K.moved(K.cylinder(6, 1.6, 1.6, 16), [12.5, 0, spec.l - 4]),
        K.moved(K.cylinder(6, 1.6, 1.6, 16), [-12.5, 0, spec.l - 4]),
      ]);
    }
    return { solid, mates: [axisMate('shaft', 'Shaft', [0, 0, spec.l], [0, 0, 1])] };
  },
};

export const stepper28: PartModule = {
  id: 'stepper-28byj',
  name: '28BYJ-48 stepper',
  category: 'Electronics',
  blurb: '28 mm hobby stepper with mounting ears and a flat shaft.',
  help: 'Mounting holes are 35 mm apart. Shaft is 5 mm with a flat. Axis +Z.',
  tags: ['stepper', '28byj'],
  color: '#cfc6b8',
  params: [],
  build: () => {
    const body = K.cylinder(19, 14, 14, seg(14));
    const ear = K.moved(K.box([42, 8, 1.2], false), [-21, -4, 18]);
    let solid = K.union([body, ear]);
    solid = K.subtract(solid, [
      K.moved(K.cylinder(4, 2.1, 2.1, 16), [-17.5, 0, 17]),
      K.moved(K.cylinder(4, 2.1, 2.1, 16), [17.5, 0, 17]),
    ]);
    let shaft = K.moved(K.cylinder(8, 2.5, 2.5, 20), [0, 0, 19]);
    shaft = K.subtract(shaft, [K.moved(K.box([3, 2, 8], false), [1.2, -1, 19])]);
    solid = K.union([solid, shaft]);
    return {
      solid,
      mates: [
        axisMate('shaft', 'Shaft', [0, 0, 19], [0, 0, 1]),
        axisMate('mount-a', 'Mount A', [-17.5, 0, 19], [0, 0, 1]),
        axisMate('mount-b', 'Mount B', [17.5, 0, 19], [0, 0, 1]),
      ],
    };
  },
};

export const cell18650: PartModule = {
  id: 'cell-18650',
  name: '18650 cell',
  category: 'Electronics',
  blurb: '18.4 × 65 mm cell for pack layout.',
  help: 'Axis +Z, standing up. Lay it flat with a rotation if the holder is horizontal.',
  tags: ['battery', '18650'],
  color: '#3a6ea5',
  params: [],
  build: () => {
    const body = K.cylinder(65, 9.2, 9.2, seg(9));
    const nipple = K.moved(K.cylinder(1.2, 3, 3, 16), [0, 0, 65]);
    return { solid: K.union([body, nipple]), mates: [axisMate('axis', 'Axis', [0, 0, 32.5], [0, 0, 1])] };
  },
};

export const holder18650: PartModule = {
  id: 'holder-18650',
  name: '18650 holder',
  category: 'Electronics',
  blurb: 'Clip holder for one or two cells, with wire slots.',
  help: 'Cells lie along X. Spring contact is a block at one end. Print the clips upright.',
  tags: ['battery', '18650', 'holder'],
  color: '#1f1f1f',
  params: [
    { key: 'count', label: 'Cells', type: 'int', default: 1, min: 1, max: 2 },
  ],
  build: (p) => {
    const count = clamp(Math.round(num(p, 'count', 1)), 1, 2);
    const pitch = 20;
    const length = 68;
    const parts: K.Solid[] = [];
    for (let i = 0; i < count; i++) {
      const y = (i - (count - 1) / 2) * pitch;
      const cradle = K.cylinder(length, 10, 10, seg(10));
      const cut = K.moved(K.box([length + 2, 20, 12], false), [-1, -10, 2]);
      let bay = K.subtract(cradle, [cut]);
      bay = K.moved(K.turned(bay, [0, 90, 0]), [0, y, 10]);
      const contactA = K.moved(K.box([3, 14, 12], false), [-1.5, y - 7, 0]);
      const contactB = K.moved(K.box([3, 14, 12], false), [length - 1.5, y - 7, 0]);
      parts.push(bay, contactA, contactB);
    }
    const base = K.box([length, pitch * count + 6, 2], false);
    parts.push(K.moved(base, [0, -(pitch * count + 6) / 2, 0]));
    return { solid: K.union(parts), mates: [axisMate('base', 'Base', [length / 2, 0, 0], [0, 0, 1])] };
  },
};

export const lipoPack: PartModule = {
  id: 'lipo-pack',
  name: 'LiPo pack',
  category: 'Electronics',
  blurb: 'Soft-pack brick with an XT60 bump.',
  help: 'Default is a small 2S pack, 70 × 35 × 18 mm. Resize to your pack. Origin is a corner on the bed.',
  tags: ['battery', 'lipo', 'rc'],
  color: '#d7e4c8',
  params: [
    { key: 'length', label: 'Length', type: 'number', default: 70, min: 30, max: 180, step: 1, unit: 'mm' },
    { key: 'width', label: 'Width', type: 'number', default: 35, min: 15, max: 80, step: 1, unit: 'mm' },
    { key: 'height', label: 'Height', type: 'number', default: 18, min: 6, max: 50, step: 1, unit: 'mm' },
  ],
  build: (p) => {
    const L = clamp(num(p, 'length', 70), 20, 200);
    const W = clamp(num(p, 'width', 35), 10, 100);
    const H = clamp(num(p, 'height', 18), 4, 60);
    const brick = K.box([L, W, H], false);
    const plug = K.moved(K.box([16, 8, 8], false), [L - 2, W / 2 - 4, H / 2 - 4]);
    return { solid: K.union([brick, plug]), mates: [axisMate('corner', 'Corner', [0, 0, 0], [0, 0, 1])] };
  },
};

export const slideSwitch: PartModule = {
  id: 'switch-slide',
  name: 'Slide switch',
  category: 'Electronics',
  blurb: 'Panel slide switch, about 13 × 6 × 5 mm.',
  help: 'The actuator sticks out of the top. Use it as a keep-out on a hull or chassis.',
  tags: ['switch'],
  color: '#d9d3c7',
  params: [],
  build: () => {
    const body = K.box([13, 6, 5], false);
    const lever = K.moved(K.box([4, 2, 3], false), [4.5, 2, 5]);
    const pins = K.moved(K.box([10, 1.2, 4], false), [1.5, 2.4, -3]);
    return { solid: K.union([body, lever, pins]), mates: [axisMate('top', 'Top', [6.5, 3, 5], [0, 0, 1])] };
  },
};

export const buckModule: PartModule = {
  id: 'buck-module',
  name: 'Buck converter',
  category: 'Electronics',
  blurb: 'LM2596-style module, 43 × 21 × 14 mm.',
  help: 'Potentiometer is the cylinder on the top. Keep 2 mm around the board in a bay.',
  tags: ['buck', 'lm2596', 'power'],
  color: '#2a2a2a',
  params: [],
  build: () => {
    const pcb = K.box([43, 21, 1.6], false);
    const chip = K.moved(K.box([16, 12, 4], false), [6, 4, 1.6]);
    const ind = K.moved(K.cylinder(6, 5, 5, 24), [30, 10.5, 1.6]);
    const pot = K.moved(K.cylinder(8, 2.2, 2.2, 16), [8, 10, 1.6]);
    return { solid: K.union([pcb, chip, ind, pot]), mates: [axisMate('corner', 'Corner', [0, 0, 0], [0, 0, 1])] };
  },
};

export const hcsr04: PartModule = {
  id: 'hcsr04',
  name: 'HC-SR04',
  category: 'Electronics',
  blurb: 'Ultrasonic board with two 16 mm transducers.',
  help: 'Board is 45 × 20 mm. Transducers are 26 mm apart. Mounting holes are near the short ends.',
  tags: ['ultrasonic', 'sensor'],
  color: '#3d6b8a',
  params: [],
  build: () => {
    const holes: Vec3[] = [
      [2.5, 10, 0],
      [42.5, 10, 0],
    ];
    let solid = board(45, 20, 1.6, holes, 2.2);
    const can = (x: number) => K.moved(K.cylinder(12, 8, 8, seg(8)), [x, 10, 1.6]);
    solid = K.union([solid, can(16), can(16 + 13)]);
    return { solid, mates: [...holeMates(holes, 1.6), axisMate('corner', 'Corner', [0, 0, 0], [0, 0, 1])] };
  },
};

export const xt60: PartModule = {
  id: 'xt60',
  name: 'XT60 connector',
  category: 'Electronics',
  blurb: 'XT60 housing for a power lead keep-out.',
  help: 'About 16 × 15 × 8 mm. The bullets stick out the back.',
  tags: ['xt60', 'connector'],
  color: '#e6c84a',
  params: [],
  build: () => {
    const body = K.box([16, 15, 8], false);
    const b1 = K.moved(K.cylinder(6, 2.2, 2.2, 16), [5, 5, -4]);
    const b2 = K.moved(K.cylinder(6, 2.2, 2.2, 16), [11, 5, -4]);
    return { solid: K.union([body, b1, b2]), mates: [axisMate('face', 'Face', [8, 7.5, 8], [0, 0, 1])] };
  },
};

export const electronicParts: PartModule[] = [
  arduinoUno,
  arduinoNano,
  arduinoMega,
  esp32,
  servoSg90,
  servoMg996,
  motorN20,
  motor130,
  canMotor,
  stepper28,
  cell18650,
  holder18650,
  lipoPack,
  slideSwitch,
  buckModule,
  hcsr04,
  xt60,
];
