import type { Mate, Params, PartModule, Vec2 } from '../cad/types.ts';
import { axisMate, clamp, circlePoly, hexPoly, int, num, obround, seg, str, zMates } from '../cad/math.ts';
import * as K from '../cad/kernel.ts';

const centerMate = (z: number): Mate[] => [axisMate('origin', 'Origin', [0, 0, z], [0, 0, 1])];

export const boxPart: PartModule = {
  id: 'box',
  name: 'Box',
  category: 'Primitives',
  blurb: 'Rectangular solid. One corner on the origin.',
  help: 'Sizes are the full lengths. The corner at the origin is the minimum corner, so it sits on the bed when placed at z = 0.',
  tags: ['box', 'cube', 'block'],
  color: '#7f8f9a',
  params: [
    { key: 'x', label: 'X', type: 'number', default: 20, min: 0.4, max: 400, step: 0.5, unit: 'mm' },
    { key: 'y', label: 'Y', type: 'number', default: 20, min: 0.4, max: 400, step: 0.5, unit: 'mm' },
    { key: 'z', label: 'Z', type: 'number', default: 10, min: 0.4, max: 400, step: 0.5, unit: 'mm' },
  ],
  build: (p) => {
    const x = clamp(num(p, 'x', 20), 0.2, 500);
    const y = clamp(num(p, 'y', 20), 0.2, 500);
    const z = clamp(num(p, 'z', 10), 0.2, 500);
    return { solid: K.box([x, y, z], false), mates: [axisMate('corner', 'Corner', [0, 0, 0], [0, 0, 1]), axisMate('center', 'Center', [x / 2, y / 2, z / 2], [0, 0, 1])] };
  },
};

export const roundedBox: PartModule = {
  id: 'rounded-box',
  name: 'Rounded box',
  category: 'Primitives',
  blurb: 'Box with round vertical edges.',
  help: 'Corner radius applies to the XY profile. Origin is the center of the bottom face.',
  tags: ['box', 'round', 'fillet'],
  color: '#8b9aa6',
  params: [
    { key: 'x', label: 'X', type: 'number', default: 40, min: 2, max: 400, step: 0.5, unit: 'mm' },
    { key: 'y', label: 'Y', type: 'number', default: 24, min: 2, max: 400, step: 0.5, unit: 'mm' },
    { key: 'z', label: 'Z', type: 'number', default: 8, min: 0.4, max: 200, step: 0.2, unit: 'mm' },
    { key: 'radius', label: 'Corner radius', type: 'number', default: 3, min: 0, max: 40, step: 0.2, unit: 'mm' },
  ],
  build: (p) => {
    const x = clamp(num(p, 'x', 40), 1, 500);
    const y = clamp(num(p, 'y', 24), 1, 500);
    const z = clamp(num(p, 'z', 8), 0.3, 300);
    const r = clamp(num(p, 'radius', 3), 0, Math.min(x, y) / 2);
    return { solid: K.extrude(K.roundedRect(x, y, r), z), mates: centerMate(0) };
  },
};

export const cylinderPart: PartModule = {
  id: 'cylinder',
  name: 'Cylinder',
  category: 'Primitives',
  blurb: 'Cylinder or cone frustum along Z.',
  help: 'Bottom sits on z = 0. Top radius can differ for a cone.',
  tags: ['cylinder', 'cone'],
  color: '#8494a1',
  params: [
    { key: 'radius', label: 'Bottom radius', type: 'number', default: 8, min: 0.3, max: 150, step: 0.1, unit: 'mm' },
    { key: 'top', label: 'Top radius', type: 'number', default: 8, min: 0, max: 150, step: 0.1, unit: 'mm' },
    { key: 'height', label: 'Height', type: 'number', default: 12, min: 0.3, max: 300, step: 0.2, unit: 'mm' },
  ],
  build: (p) => {
    const r = clamp(num(p, 'radius', 8), 0.2, 200);
    const top = clamp(num(p, 'top', r), 0, 200);
    const h = clamp(num(p, 'height', 12), 0.2, 400);
    return { solid: K.cylinder(h, r, top, seg(Math.max(r, top))), mates: zMates(h) };
  },
};

export const spherePart: PartModule = {
  id: 'sphere',
  name: 'Sphere',
  category: 'Primitives',
  blurb: 'Sphere sitting on the bed.',
  help: 'The center is one radius above the origin.',
  tags: ['sphere', 'ball'],
  color: '#90a0ac',
  params: [{ key: 'radius', label: 'Radius', type: 'number', default: 8, min: 0.4, max: 120, step: 0.2, unit: 'mm' }],
  build: (p) => {
    const r = clamp(num(p, 'radius', 8), 0.3, 150);
    return { solid: K.moved(K.sphere(r, seg(r)), [0, 0, r]), mates: [axisMate('center', 'Center', [0, 0, r], [0, 0, 1])] };
  },
};

export const torusPart: PartModule = {
  id: 'torus',
  name: 'Torus',
  category: 'Primitives',
  blurb: 'Donut. Useful as an O-ring or a fillet tool.',
  help: 'Major radius is to the tube center. The ring lies in XY and the bottom touches z = 0.',
  tags: ['torus', 'oring'],
  color: '#8d9aaa',
  params: [
    { key: 'major', label: 'Major radius', type: 'number', default: 12, min: 2, max: 100, step: 0.5, unit: 'mm' },
    { key: 'tube', label: 'Tube radius', type: 'number', default: 2, min: 0.4, max: 20, step: 0.1, unit: 'mm' },
  ],
  build: (p) => {
    const major = clamp(num(p, 'major', 12), 1, 120);
    const tube = clamp(num(p, 'tube', 2), 0.3, major - 0.2);
    const solid = K.revolve(K.section(circlePoly(tube, seg(tube), major, 0)), seg(major));
    return { solid: K.moved(solid, [0, 0, tube]), mates: [axisMate('center', 'Center', [0, 0, tube], [0, 0, 1])] };
  },
};

export const tubePart: PartModule = {
  id: 'tube',
  name: 'Tube',
  category: 'Primitives',
  blurb: 'Hollow cylinder.',
  help: 'Wall is outer radius minus inner radius. Axis +Z.',
  tags: ['tube', 'pipe'],
  color: '#8494a1',
  params: [
    { key: 'outer', label: 'Outer radius', type: 'number', default: 8, min: 1, max: 120, step: 0.1, unit: 'mm' },
    { key: 'inner', label: 'Inner radius', type: 'number', default: 6, min: 0.2, max: 110, step: 0.1, unit: 'mm' },
    { key: 'height', label: 'Height', type: 'number', default: 16, min: 0.4, max: 300, step: 0.5, unit: 'mm' },
  ],
  build: (p) => {
    const outer = clamp(num(p, 'outer', 8), 0.6, 150);
    const inner = clamp(num(p, 'inner', 6), 0.2, outer - 0.3);
    const h = clamp(num(p, 'height', 16), 0.3, 400);
    const solid = K.subtract(K.cylinder(h, outer, outer, seg(outer)), [K.moved(K.cylinder(h + 2, inner, inner, seg(inner)), [0, 0, -1])]);
    return { solid, mates: zMates(h) };
  },
};

export const capsulePart: PartModule = {
  id: 'capsule',
  name: 'Capsule',
  category: 'Primitives',
  blurb: 'Cylinder with spherical ends.',
  help: 'Length includes both caps. Axis +Z, sitting on the bed.',
  tags: ['capsule', 'pill'],
  color: '#90a0ac',
  params: [
    { key: 'radius', label: 'Radius', type: 'number', default: 5, min: 0.5, max: 40, step: 0.1, unit: 'mm' },
    { key: 'length', label: 'Overall length', type: 'number', default: 24, min: 2, max: 200, step: 0.5, unit: 'mm' },
  ],
  build: (p) => {
    const r = clamp(num(p, 'radius', 5), 0.4, 50);
    const length = clamp(num(p, 'length', 24), r * 2, 250);
    const mid = length - 2 * r;
    const core = mid > 0.05 ? K.moved(K.cylinder(mid, r, r, seg(r)), [0, 0, r]) : K.box([0.2, 0.2, 0.2], true);
    const a = K.moved(K.sphere(r, seg(r)), [0, 0, r]);
    const b = K.moved(K.sphere(r, seg(r)), [0, 0, r + Math.max(0, mid)]);
    return { solid: K.union([core, a, b]), mates: zMates(length) };
  },
};

export const wedgePart: PartModule = {
  id: 'wedge',
  name: 'Wedge',
  category: 'Primitives',
  blurb: 'Right-angle wedge, the ramp along X.',
  help: 'The tall face is at x = 0. Height falls to zero at x = length.',
  tags: ['wedge', 'ramp'],
  color: '#8b9aa6',
  params: [
    { key: 'length', label: 'Length', type: 'number', default: 30, min: 1, max: 200, step: 1, unit: 'mm' },
    { key: 'width', label: 'Width', type: 'number', default: 16, min: 1, max: 200, step: 1, unit: 'mm' },
    { key: 'height', label: 'Height', type: 'number', default: 10, min: 1, max: 100, step: 0.5, unit: 'mm' },
  ],
  build: (p) => {
    const length = clamp(num(p, 'length', 30), 0.5, 300);
    const width = clamp(num(p, 'width', 16), 0.5, 300);
    const height = clamp(num(p, 'height', 10), 0.5, 200);
    const pts: Vec2[] = [
      [0, 0],
      [length, 0],
      [0, height],
    ];
    return { solid: K.extrude(K.section(pts), width), mates: [axisMate('origin', 'Origin', [0, 0, 0], [0, 0, 1])] };
  },
};

export const extrudedProfile: PartModule = {
  id: 'extruded-profile',
  name: 'Extruded profile',
  category: 'Primitives',
  blurb: 'Extrude a hex, slot, rounded rect, or a typed polygon.',
  help: 'Custom points are millimeters, one x,y pair per line. The loop is closed for you. Extrusion is +Z.',
  tags: ['extrude', 'sketch', 'profile'],
  color: '#7f8f9a',
  params: [
    { key: 'preset', label: 'Preset', type: 'select', default: 'rounded', options: [
      { value: 'rect', label: 'Rectangle' },
      { value: 'rounded', label: 'Rounded rectangle' },
      { value: 'hex', label: 'Hexagon' },
      { value: 'slot', label: 'Slot' },
      { value: 'custom', label: 'Custom points' },
    ] },
    { key: 'width', label: 'Width', type: 'number', default: 30, min: 1, max: 300, step: 0.5, unit: 'mm' },
    { key: 'height', label: 'Profile height', type: 'number', default: 16, min: 1, max: 300, step: 0.5, unit: 'mm' },
    { key: 'radius', label: 'Corner / hex size', type: 'number', default: 3, min: 0, max: 40, step: 0.2, unit: 'mm' },
    { key: 'depth', label: 'Extrude', type: 'number', default: 6, min: 0.4, max: 200, step: 0.2, unit: 'mm' },
    { key: 'points', label: 'Custom points', type: 'text', default: '0,0\n20,0\n20,10\n0,10', help: 'x,y per line' },
  ],
  build: (p) => {
    const preset = str(p, 'preset', 'rounded');
    const width = clamp(num(p, 'width', 30), 0.5, 400);
    const height = clamp(num(p, 'height', 16), 0.5, 400);
    const radius = clamp(num(p, 'radius', 3), 0, Math.min(width, height) / 2);
    const depth = clamp(num(p, 'depth', 6), 0.2, 300);
    let profile;
    if (preset === 'hex') profile = K.section(hexPoly(width));
    else if (preset === 'slot') profile = K.section(obround(width, height));
    else if (preset === 'rect') profile = K.square(width, height, true);
    else if (preset === 'custom') {
      const pts: Vec2[] = [];
      for (const line of str(p, 'points', '').split(/\n+/)) {
        const bits = line.split(/[,\s]+/).filter(Boolean);
        if (bits.length >= 2) {
          const x = Number(bits[0]);
          const y = Number(bits[1]);
          if (Number.isFinite(x) && Number.isFinite(y)) pts.push([x, y]);
        }
      }
      profile = pts.length >= 3 ? K.section(pts) : K.square(width, height, true);
    } else profile = K.roundedRect(width, height, radius);
    return { solid: K.extrude(profile, depth), mates: [axisMate('base', 'Base', [0, 0, 0], [0, 0, 1])] };
  },
};

const FONT: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '01010', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

export const textPlate: PartModule = {
  id: 'text-plate',
  name: 'Text plate',
  category: 'Primitives',
  blurb: 'Raised block letters on a plate. A–Z, 0–9.',
  help: 'Letters are a 5×7 pixel face, raised above the plate. Good for port/starboard marks and part IDs.',
  tags: ['text', 'label', 'nameplate'],
  color: '#c4b8a5',
  params: [
    { key: 'text', label: 'Text', type: 'text', default: 'PLATEN' },
    { key: 'size', label: 'Pixel size', type: 'number', default: 1.2, min: 0.6, max: 3, step: 0.1, unit: 'mm' },
    { key: 'plate', label: 'Plate thickness', type: 'number', default: 1.6, min: 0.8, max: 6, step: 0.1, unit: 'mm' },
    { key: 'raise', label: 'Letter height', type: 'number', default: 0.8, min: 0.3, max: 3, step: 0.1, unit: 'mm' },
  ],
  build: (p) => {
    const text = str(p, 'text', 'PLATEN').toUpperCase().slice(0, 16);
    const size = clamp(num(p, 'size', 1.2), 0.5, 4);
    const plateT = clamp(num(p, 'plate', 1.6), 0.6, 8);
    const raise = clamp(num(p, 'raise', 0.8), 0.2, 4);
    const gap = size;
    const glyphW = size * 5;
    const width = Math.max(glyphW, text.length * (glyphW + gap) + gap);
    const height = size * 7 + gap * 2;
    const plate = K.box([width, height, plateT], false);
    const blocks: K.Solid[] = [plate];
    let x0 = gap;
    for (const ch of text) {
      const glyph = FONT[ch] ?? FONT[' '];
      for (let row = 0; row < 7; row++) {
        let col = 0;
        while (col < 5) {
          if (glyph[row][col] !== '1') {
            col++;
            continue;
          }
          let end = col;
          while (end < 5 && glyph[row][end] === '1') end++;
          const w = (end - col) * size;
          const y = gap + (6 - row) * size;
          blocks.push(K.moved(K.box([w, size, raise], false), [x0 + col * size, y, plateT - 0.05]));
          col = end;
        }
      }
      x0 += glyphW + gap;
    }
    return { solid: K.union(blocks), mates: [axisMate('base', 'Base', [width / 2, height / 2, 0], [0, 0, 1])] };
  },
};

export const primitiveParts: PartModule[] = [
  boxPart,
  roundedBox,
  cylinderPart,
  spherePart,
  torusPart,
  tubePart,
  capsulePart,
  wedgePart,
  extrudedProfile,
  textPlate,
];

void int;
