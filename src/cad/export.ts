import { strToU8, zipSync } from 'fflate';
import type { Document } from './types.ts';
import { transformPositions } from './math.ts';
import type { Rebuild } from './rebuild.ts';

export type ExportBody = { name: string; positions: Float32Array };

export function visibleBodies(doc: Document, built: Rebuild, only?: string[]): ExportBody[] {
  const bodies: ExportBody[] = [];
  for (const feature of doc.features) {
    if (!feature.visible || feature.suppressed) continue;
    if (only && !only.includes(feature.id)) continue;
    const mesh = built.features.find((item) => item.id === feature.id);
    if (!mesh?.positions?.length) continue;
    bodies.push({ name: safeName(feature.name), positions: transformPositions(mesh.positions, feature.transform) });
  }
  return bodies;
}

export function stlBinary(bodies: ExportBody[]): Uint8Array {
  let count = 0;
  for (const body of bodies) count += body.positions.length / 9;
  const buffer = new ArrayBuffer(84 + count * 50);
  const view = new DataView(buffer);
  const header = new TextEncoder().encode('Platen CAD — millimeters, Z up');
  new Uint8Array(buffer, 0, 80).set(header.subarray(0, Math.min(80, header.length)));
  view.setUint32(80, count, true);
  let offset = 84;
  for (const body of bodies) {
    const p = body.positions;
    for (let i = 0; i < p.length; i += 9) {
      const ax = p[i];
      const ay = p[i + 1];
      const az = p[i + 2];
      const bx = p[i + 3];
      const by = p[i + 4];
      const bz = p[i + 5];
      const cx = p[i + 6];
      const cy = p[i + 7];
      const cz = p[i + 8];
      let nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
      let ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
      let nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      view.setFloat32(offset, nx, true);
      view.setFloat32(offset + 4, ny, true);
      view.setFloat32(offset + 8, nz, true);
      for (let k = 0; k < 9; k++) view.setFloat32(offset + 12 + k * 4, p[i + k], true);
      view.setUint16(offset + 48, 0, true);
      offset += 50;
    }
  }
  return new Uint8Array(buffer);
}

export function objText(bodies: ExportBody[]): string {
  let out = '# Platen CAD\n';
  let base = 1;
  for (const body of bodies) {
    out += `o ${body.name}\n`;
    const p = body.positions;
    for (let i = 0; i < p.length; i += 3) out += `v ${p[i]} ${p[i + 1]} ${p[i + 2]}\n`;
    const tris = p.length / 9;
    for (let t = 0; t < tris; t++) {
      const a = base + t * 3;
      out += `f ${a} ${a + 1} ${a + 2}\n`;
    }
    base += p.length / 3;
  }
  return out;
}

export function stlZip(bodies: ExportBody[]): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  bodies.forEach((body, index) => {
    files[`${String(index + 1).padStart(2, '0')}-${body.name}.stl`] = stlBinary([body]);
  });
  return zipSync(files, { level: 6 });
}

export function threeMf(bodies: ExportBody[]): Uint8Array {
  const objects = bodies
    .map((body, index) => {
      const verts: string[] = [];
      const tris: string[] = [];
      const p = body.positions;
      for (let i = 0; i < p.length; i += 3) {
        verts.push(`<vertex x="${p[i]}" y="${p[i + 1]}" z="${p[i + 2]}" />`);
      }
      const count = p.length / 3;
      for (let i = 0; i < count; i += 3) tris.push(`<triangle v1="${i}" v2="${i + 1}" v3="${i + 2}" />`);
      return `<object id="${index + 1}" type="model" name="${escapeXml(body.name)}"><mesh><vertices>${verts.join('')}</vertices><triangles>${tris.join('')}</triangles></mesh></object>`;
    })
    .join('');
  const build = bodies.map((_, index) => `<item objectid="${index + 1}" />`).join('');
  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <metadata name="Application">Platen</metadata>
  <resources>${objects}</resources>
  <build>${build}</build>
</model>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;
  return zipSync(
    {
      '[Content_Types].xml': strToU8(contentTypes),
      '_rels/.rels': strToU8(rels),
      '3D/3dmodel.model': strToU8(model),
    },
    { level: 6 },
  );
}

function safeName(name: string): string {
  const clean = name.replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-|-$/g, '');
  return clean || 'part';
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[ch] ?? ch);
}
