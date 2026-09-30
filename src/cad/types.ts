export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

export type ParamValue = number | boolean | string;

export type ParamSpec =
  | {
      key: string;
      label: string;
      type: 'number';
      default: number;
      min: number;
      max: number;
      step: number;
      unit?: string;
      help?: string;
    }
  | {
      key: string;
      label: string;
      type: 'int';
      default: number;
      min: number;
      max: number;
      help?: string;
    }
  | {
      key: string;
      label: string;
      type: 'bool';
      default: boolean;
      help?: string;
    }
  | {
      key: string;
      label: string;
      type: 'select';
      default: string;
      options: { value: string; label: string }[];
      help?: string;
    }
  | {
      key: string;
      label: string;
      type: 'text';
      default: string;
      help?: string;
    };

export type Params = Record<string, ParamValue>;

export type Mate = {
  id: string;
  label: string;
  origin: Vec3;
  axis: Vec3;
  xAxis: Vec3;
};

export type Xform = {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
};

export type Box = { min: Vec3; max: Vec3 };

export type Category =
  | 'Primitives'
  | 'Gears'
  | 'Shafts'
  | 'Fasteners'
  | 'Electronics'
  | 'Wheels'
  | 'Marine'
  | 'Structures';

export type PartModule = {
  id: string;
  name: string;
  category: Category;
  blurb: string;
  help: string;
  tags: string[];
  color: string;
  params: ParamSpec[];
  onParam?: (key: string, params: Params) => void;
  build: (params: Params) => { mates: Mate[]; solid: unknown };
};

export type PartFeature = {
  kind: 'part';
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  suppressed: boolean;
  color: string;
  generator: string;
  params: Params;
  transform: Xform;
};

export type BooleanFeature = {
  kind: 'boolean';
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  suppressed: boolean;
  color: string;
  op: 'union' | 'subtract' | 'intersect';
  sources: string[];
  transform: Xform;
};

export type PatternFeature = {
  kind: 'pattern';
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  suppressed: boolean;
  color: string;
  mode: 'linear' | 'circular' | 'mirror';
  source: string;
  count: number;
  spacing: Vec3;
  axis: 'x' | 'y' | 'z';
  stepAngle: number;
  plane: 'xy' | 'yz' | 'zx';
  transform: Xform;
};

export type Feature = PartFeature | BooleanFeature | PatternFeature;

export type MateConstraint = {
  id: string;
  movingId: string;
  movingMate: string;
  fixedId: string;
  fixedMate: string;
  distance: number;
  spin: number;
  flip: boolean;
  live: boolean;
};

export type MaterialId = 'pla' | 'petg' | 'abs' | 'asa' | 'tpu';

export type Document = {
  format: 'platen';
  version: 1;
  name: string;
  unit: 'mm';
  features: Feature[];
  mates: MateConstraint[];
  bed: { x: number; y: number; visible: boolean };
  material: MaterialId;
};

export type MeshData = {
  positions: Float32Array;
  triangles: number;
  volume: number;
  bbox: Box;
};

export const DENSITY: Record<MaterialId, number> = {
  pla: 1.24,
  petg: 1.27,
  abs: 1.04,
  asa: 1.07,
  tpu: 1.21,
};

export function identityTransform(): Xform {
  return { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
}

export function uid(prefix = 'f'): string {
  return `${prefix}${Math.random().toString(36).slice(2, 10)}`;
}
