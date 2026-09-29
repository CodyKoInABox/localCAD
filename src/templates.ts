import type { Document, Feature, MateConstraint, Xform } from './cad/types.ts';
import { identityTransform, uid } from './cad/types.ts';
import { defaultParams, partById } from './parts/registry.ts';

function xf(position: [number, number, number], rotation: [number, number, number] = [0, 0, 0]): Xform {
  return { position, rotation, scale: [1, 1, 1] };
}

function part(generator: string, name: string, position: [number, number, number], rotation: [number, number, number] = [0, 0, 0], params: Record<string, number | boolean | string> = {}): Feature {
  const mod = partById(generator);
  return {
    kind: 'part',
    id: uid(),
    name,
    visible: true,
    locked: false,
    suppressed: false,
    color: mod?.color ?? '#8d97a3',
    generator,
    params: { ...(mod ? defaultParams(mod) : {}), ...params },
    transform: xf(position, rotation),
  };
}

function project(name: string, features: Feature[], mates: MateConstraint[] = []): Document {
  return {
    format: 'platen',
    version: 1,
    name,
    unit: 'mm',
    features,
    mates,
    bed: { x: 250, y: 250, visible: true },
    material: 'pla',
  };
}

export function gearboxProject(): Document {
  const plate = part('gear-case', 'Gear case', [0, 0, 0], [0, 0, 0], { center: 28, face: 6, bore: 4.2 });
  const shaftA = part('straight-shaft', 'Shaft A', [10, 10, 3], [0, 0, 0], { diameter: 4, length: 22, flats: 0, crossHole: 0, chamfer: 0.2 });
  const shaftB = part('straight-shaft', 'Shaft B', [38, 10, 3], [0, 0, 0], { diameter: 4, length: 22, flats: 0, crossHole: 0, chamfer: 0.2 });
  const gearA = part('spur-gear', 'Gear 36T', [0, 0, 0], [0, 0, 0], { module: 1, teeth: 36, thickness: 5, bore: 4.25, backlash: 0.15, hubD: 12, hubH: 1 });
  const gearB = part('spur-gear', 'Pinion 20T', [0, 0, 0], [0, 0, 0], { module: 1, teeth: 20, thickness: 5, bore: 4.25, backlash: 0.15 });
  const mates: MateConstraint[] = [
    { id: uid('m'), movingId: gearA.id, movingMate: 'center', fixedId: shaftA.id, fixedMate: 'mid', distance: 0, spin: 0, flip: false, live: true },
    { id: uid('m'), movingId: gearB.id, movingMate: 'center', fixedId: shaftB.id, fixedMate: 'mid', distance: 0, spin: 180 / 20, flip: false, live: true },
  ];
  return project('Gearbox', [plate, shaftA, shaftB, gearA, gearB], mates);
}

export function rcCarProject(): Document {
  const chassis = part('chassis-plate', 'Chassis', [0, 0, 0], [0, 0, 0], {
    length: 200,
    width: 90,
    thick: 3.5,
    wheelbase: 140,
    track: 70,
    hole: 3.2,
    rails: true,
    bay: true,
  });
  const features: Feature[] = [chassis];
  const axleZ = 32;
  const rearX = 70;
  const frontX = -70;
  features.push(part('pillow-block', 'Rear stand L', [rearX - 14, 28, 3.5], [0, 0, 0], { height: axleZ - 3.5, bore: 4.3, width: 8 }));
  features.push(part('pillow-block', 'Rear stand R', [rearX - 14, -36, 3.5], [0, 0, 0], { height: axleZ - 3.5, bore: 4.3, width: 8 }));
  features.push(part('pillow-block', 'Front stand L', [frontX - 14, 28, 3.5], [0, 0, 0], { height: axleZ - 3.5, bore: 4.3, width: 8 }));
  features.push(part('pillow-block', 'Front stand R', [frontX - 14, -36, 3.5], [0, 0, 0], { height: axleZ - 3.5, bore: 4.3, width: 8 }));
  const rearAxle = part('straight-shaft', 'Rear axle', [rearX, -68, axleZ], [-90, 0, 0], { diameter: 4, length: 136, flats: 0, crossHole: 0 });
  const frontAxle = part('straight-shaft', 'Front axle', [frontX, -68, axleZ], [-90, 0, 0], { diameter: 4, length: 136, flats: 0, crossHole: 0 });
  features.push(rearAxle, frontAxle);
  features.push(part('rc-wheel', 'Rear wheel L', [rearX, 62, axleZ], [0, 0, 0], { od: 64, width: 24, bore: 4.3, hex: 0, tread: 'knobby' }));
  features.push(part('rc-wheel', 'Rear wheel R', [rearX, -62, axleZ], [0, 0, 0], { od: 64, width: 24, bore: 4.3, hex: 0, tread: 'knobby' }));
  features.push(part('rc-wheel', 'Front wheel L', [frontX, 62, axleZ], [0, 0, 0], { od: 64, width: 24, bore: 4.3, hex: 0, tread: 'slick' }));
  features.push(part('rc-wheel', 'Front wheel R', [frontX, -62, axleZ], [0, 0, 0], { od: 64, width: 24, bore: 4.3, hex: 0, tread: 'slick' }));
  const spur = part('spur-gear', 'Spur 40T', [0, 0, 0], [0, 0, 0], { module: 0.8, teeth: 40, thickness: 5, bore: 4.3, backlash: 0.1 });
  const pinion = part('spur-gear', 'Pinion 16T', [47.6, 5.5, 32], [-90, 0, 0], { module: 0.8, teeth: 16, thickness: 5, bore: 3.1, backlash: 0.1 });
  features.push(spur, pinion);
  features.push(part('motor-n20', 'N20 motor', [rearX - 24, -8, axleZ], [-90, 0, 0], { length: 26 }));
  features.push(part('servo-bracket', 'Servo tray', [-28, -16, 3.5]));
  features.push(part('servo-sg90', 'Steering servo', [-12, 0, 6]));
  features.push(part('servo-horn', 'Servo horn', [-12, 0, 30], [0, 0, 0], { style: 'arm', reach: 16 }));
  features.push(part('steering-knuckle', 'Knuckle L', [frontX, 40, 8]));
  features.push(part('steering-knuckle', 'Knuckle R', [frontX, -50, 8], [0, 0, 180]));
  features.push(part('rod-end', 'Tie rod', [frontX + 10, 0, 12], [0, 0, 0], { length: 70, hole: 2, width: 6 }));
  features.push(part('arduino-nano', 'Arduino Nano', [-20, -8, 3.5]));
  features.push(part('battery-tray', 'Battery tray', [-55, -20, 3.5], [0, 0, 0], { length: 70, width: 34, height: 12 }));
  features.push(part('lipo-pack', 'LiPo', [-52, -16, 6], [0, 0, 0], { length: 64, width: 30, height: 16 }));
  features.push(part('socket-screw', 'Screw', [rearX, 35, 8], [0, 0, 0], { size: 'M3', length: 8, threads: false }));
  features.push(part('hex-nut', 'Nut', [rearX, 35, 3.5], [0, 0, 0], { size: 'M3', threads: false }));
  const mates: MateConstraint[] = [
    { id: uid('m'), movingId: spur.id, movingMate: 'center', fixedId: rearAxle.id, fixedMate: 'mid', distance: 8, spin: 0, flip: false, live: true },
  ];
  return project('RC buggy', features, mates);
}

export function rcBoatProject(): Document {
  const hull = part('boat-hull', 'Hull', [0, 0, 0], [0, 0, 0], {
    style: 'planing',
    length: 280,
    beam: 110,
    depth: 50,
    deadrise: 14,
    rocker: 12,
    wall: 2.4,
    openDeck: true,
    skeg: true,
  });
  const features: Feature[] = [
    hull,
    part('motor-bulkhead', 'Motor bulkhead', [36, -40, 8], [0, 0, 0], { width: 80, height: 36, thick: 3, hole: 16, angle: 8 }),
    part('motor-n20', 'Drive motor', [42, 0, 28], [0, -8, 0], { length: 26 }),
    part('stern-tube', 'Stern tube', [8, 0, 16], [0, -8, 0], { length: 48, bore: 3.2, od: 7 }),
    part('straight-shaft', 'Prop shaft', [6, 0, 14], [0, -8, 0], { diameter: 3, length: 70, flats: 0, crossHole: 0 }),
    part('propeller', 'Propeller', [-6, 0, 12], [0, -8, 0], { diameter: 30, blades: 3, pitch: 24, bore: 3.2 }),
    part('rudder', 'Rudder', [-8, 0, 18], [0, 0, 0], { span: 36, chord: 22, stock: 4 }),
    part('servo-bracket', 'Rudder servo tray', [70, -18, 48]),
    part('servo-sg90', 'Rudder servo', [86, -2, 50]),
    part('servo-horn', 'Tiller horn', [86, -2, 76], [0, 0, 0], { style: 'arm', reach: 14 }),
    part('deck-hatch', 'Hatch', [120, -24, 50], [0, 0, 0], { length: 70, width: 40 }),
    part('arduino-nano', 'Arduino Nano', [150, -8, 28]),
    part('lipo-pack', 'LiPo', [180, -16, 8], [0, 0, 0], { length: 60, width: 30, height: 14 }),
    part('cleat', 'Bow cleat', [250, -8, 48]),
    part('xt60', 'XT60', [168, 18, 24]),
  ];
  return project('RC boat', features, []);
}

void identityTransform;
