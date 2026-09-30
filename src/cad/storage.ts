import type { Document, Feature, MateConstraint, MaterialId } from './types.ts';
import { identityTransform } from './types.ts';

const DB = 'platen';
const STORE = 'kv';

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGet(key: string): Promise<string | null> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as string | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSet(key: string, value: string): Promise<void> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function serialize(doc: Document): string {
  return JSON.stringify(doc);
}

export function parseProject(text: string): Document {
  const data = JSON.parse(text) as Partial<Document>;
  if (!data || data.format !== 'platen' || !Array.isArray(data.features)) {
    throw new Error('That file is not a Platen project.');
  }
  const features = data.features.map(normalizeFeature).filter((f): f is Feature => !!f);
  const mates = Array.isArray(data.mates) ? data.mates.map(normalizeMate).filter((m): m is MateConstraint => !!m) : [];
  return {
    format: 'platen',
    version: 1,
    name: typeof data.name === 'string' ? data.name : 'Untitled',
    unit: 'mm',
    features,
    mates,
    bed: {
      x: Number(data.bed?.x) || 220,
      y: Number(data.bed?.y) || 220,
      visible: data.bed?.visible !== false,
    },
    material: (['pla', 'petg', 'abs', 'asa', 'tpu'].includes(String(data.material)) ? data.material : 'pla') as MaterialId,
  };
}

function vec(value: unknown, fallback: [number, number, number]): [number, number, number] {
  if (!Array.isArray(value) || value.length < 3) return fallback;
  const n = value.slice(0, 3).map((v) => Number(v));
  if (n.some((v) => !Number.isFinite(v))) return fallback;
  return [n[0], n[1], n[2]];
}

function normalizeFeature(raw: unknown): Feature | null {
  if (!raw || typeof raw !== 'object') return null;
  const f = raw as Feature;
  if (!f.id || !f.kind) return null;
  const base = {
    id: String(f.id),
    name: String(f.name || 'Part'),
    visible: f.visible !== false,
    locked: !!f.locked,
    suppressed: !!f.suppressed,
    color: typeof f.color === 'string' ? f.color : '#8d97a3',
    transform: {
      position: vec(f.transform?.position, [0, 0, 0]),
      rotation: vec(f.transform?.rotation, [0, 0, 0]),
      scale: vec(f.transform?.scale, [1, 1, 1]),
    },
  };
  if (f.kind === 'part') {
    return { ...base, kind: 'part', generator: String(f.generator || ''), params: { ...(f.params ?? {}) } };
  }
  if (f.kind === 'boolean') {
    return { ...base, kind: 'boolean', op: f.op === 'union' || f.op === 'intersect' ? f.op : 'subtract', sources: (f.sources ?? []).map(String) };
  }
  if (f.kind === 'pattern') {
    return {
      ...base,
      kind: 'pattern',
      mode: f.mode === 'circular' || f.mode === 'mirror' ? f.mode : 'linear',
      source: String(f.source || ''),
      count: Number(f.count) || 3,
      spacing: vec(f.spacing, [20, 0, 0]),
      axis: f.axis === 'x' || f.axis === 'y' ? f.axis : 'z',
      stepAngle: Number(f.stepAngle) || 60,
      plane: f.plane === 'xy' || f.plane === 'zx' ? f.plane : 'yz',
    };
  }
  return null;
}

function normalizeMate(raw: unknown): MateConstraint | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as MateConstraint;
  if (!m.id || !m.movingId || !m.fixedId) return null;
  return {
    id: String(m.id),
    movingId: String(m.movingId),
    movingMate: String(m.movingMate || ''),
    fixedId: String(m.fixedId),
    fixedMate: String(m.fixedMate || ''),
    distance: Number(m.distance) || 0,
    spin: Number(m.spin) || 0,
    flip: !!m.flip,
    live: m.live !== false,
  };
}

export function blankProject(name = 'Untitled'): Document {
  return {
    format: 'platen',
    version: 1,
    name,
    unit: 'mm',
    features: [],
    mates: [],
    bed: { x: 220, y: 220, visible: true },
    material: 'pla',
  };
}

void identityTransform;
