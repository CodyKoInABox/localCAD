import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import type { Document, Vec3, Xform } from './cad/types.ts';
import { rad2deg, deg2rad, transformPoint } from './cad/math.ts';
import type { Rebuild } from './cad/rebuild.ts';

export type ViewTool = 'select' | 'move' | 'rotate' | 'measure';
export type ShadeMode = 'shaded' | 'wire' | 'overhang';

export type Viewport = {
  setScene(doc: Document, built: Rebuild): void;
  setSelection(ids: string[]): void;
  setTool(tool: ViewTool): void;
  setSnap(mm: number | null, degrees: number | null): void;
  setShade(mode: ShadeMode, supportAngle: number): void;
  setSection(z: number | null): void;
  setBed(x: number, y: number, visible: boolean): void;
  frame(mode: 'fit' | 'top' | 'front' | 'right' | 'iso'): void;
  resize(): void;
  dispose(): void;
};

export function createViewport(
  canvas: HTMLCanvasElement,
  hooks: {
    onSelect(ids: string[], additive: boolean): void;
    onTransform(id: string, xform: Xform, phase: 'start' | 'live' | 'end'): void;
    onMeasure(text: string): void;
  },
): Viewport {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x1a1814, 1);
  renderer.localClippingEnabled = true;
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 8000);
  camera.up.set(0, 0, 1);
  camera.position.set(180, -220, 140);

  const orbit = new OrbitControls(camera, canvas);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.08;
  orbit.target.set(0, 0, 20);
  orbit.maxPolarAngle = Math.PI * 0.98;
  orbit.minPolarAngle = 0.02;

  const hemi = new THREE.HemisphereLight(0xfff4e5, 0x3a342c, 1.15);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff7ee, 1.6);
  key.position.set(80, -40, 160);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xc5d4e8, 0.45);
  fill.position.set(-90, 70, 40);
  scene.add(fill);

  const grid = new THREE.GridHelper(220, 22, 0xc9852e, 0x3a342c);
  grid.rotation.x = Math.PI / 2;
  scene.add(grid);
  const axes = new THREE.AxesHelper(36);
  scene.add(axes);

  const bed = new THREE.Mesh(
    new THREE.BoxGeometry(220, 220, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.9, metalness: 0 }),
  );
  bed.position.z = -0.35;
  bed.userData.ignore = true;
  scene.add(bed);

  const parts = new THREE.Group();
  scene.add(parts);
  const meshes = new Map<string, THREE.Mesh>();

  const gizmo = new TransformControls(camera, canvas);
  gizmo.setMode('translate');
  scene.add(gizmo.getHelper());
  const clip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 100000);
  const measure = new THREE.Group();
  scene.add(measure);

  let tool: ViewTool = 'select';
  let shade: ShadeMode = 'shaded';
  let supportAngle = 45;
  let section: number | null = null;
  let dragging = false;
  let measureA: THREE.Vector3 | null = null;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  gizmo.addEventListener('dragging-changed', (event) => {
    const active = Boolean((event as { value?: boolean }).value);
    orbit.enabled = !active;
    if (active) {
      dragging = true;
      const id = selectedId();
      if (id) hooks.onTransform(id, readXform(), 'start');
    } else if (dragging) {
      dragging = false;
      const id = selectedId();
      if (id) hooks.onTransform(id, readXform(), 'end');
    }
  });
  gizmo.addEventListener('objectChange', () => {
    const id = selectedId();
    if (id && dragging) hooks.onTransform(id, readXform(), 'live');
  });

  let frameId = 0;
  const loop = () => {
    frameId = requestAnimationFrame(loop);
    orbit.update();
    renderer.render(scene, camera);
  };
  loop();

  function selectedId(): string | null {
    const obj = (gizmo as unknown as { object?: THREE.Object3D }).object;
    return obj ? String(obj.userData.id ?? '') || null : null;
  }

  function readXform(): Xform {
    const obj = (gizmo as unknown as { object?: THREE.Object3D }).object;
    if (!obj) return { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
    obj.rotation.order = 'ZYX';
    const e = new THREE.Euler().setFromQuaternion(obj.quaternion, 'ZYX');
    return {
      position: [obj.position.x, obj.position.y, obj.position.z],
      rotation: [rad2deg(e.x), rad2deg(e.y), rad2deg(e.z)],
      scale: [obj.scale.x, obj.scale.y, obj.scale.z],
    };
  }

  function applyXform(mesh: THREE.Object3D, xform: Xform) {
    mesh.position.set(xform.position[0], xform.position[1], xform.position[2]);
    mesh.rotation.order = 'ZYX';
    mesh.rotation.set(deg2rad(xform.rotation[0]), deg2rad(xform.rotation[1]), deg2rad(xform.rotation[2]));
    mesh.scale.set(xform.scale[0], xform.scale[1], xform.scale[2]);
  }

  function geometryOf(positions: Float32Array, colorMode: ShadeMode, rotation: Vec3): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (colorMode === 'overhang') {
      const colors = new Float32Array(positions.length);
      const limit = -Math.sin((supportAngle * Math.PI) / 180);
      for (let i = 0; i < positions.length; i += 9) {
        const ax = positions[i];
        const ay = positions[i + 1];
        const az = positions[i + 2];
        const ux = positions[i + 3] - ax;
        const uy = positions[i + 4] - ay;
        const uz = positions[i + 5] - az;
        const vx = positions[i + 6] - ax;
        const vy = positions[i + 7] - ay;
        const vz = positions[i + 8] - az;
        const nx = uy * vz - uz * vy;
        const ny = uz * vx - ux * vz;
        const nz = ux * vy - uy * vx;
        const worldN = transformPoint(nx, ny, nz, { position: [0, 0, 0], rotation, scale: [1, 1, 1] });
        const len = Math.hypot(worldN[0], worldN[1], worldN[2]) || 1;
        const bad = worldN[2] / len < limit;
        const r = bad ? 0.86 : 0.45;
        const g = bad ? 0.28 : 0.62;
        const b = bad ? 0.16 : 0.58;
        for (let k = 0; k < 3; k++) {
          colors[i + k * 3] = r;
          colors[i + k * 3 + 1] = g;
          colors[i + k * 3 + 2] = b;
        }
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    geo.computeVertexNormals();
    return geo;
  }

  function materialFor(color: string, mode: ShadeMode): THREE.Material {
    const clippingPlanes = [clip];
    if (mode === 'wire') {
      return new THREE.MeshBasicMaterial({ color, wireframe: true, clippingPlanes });
    }
    return new THREE.MeshStandardMaterial({
      color: mode === 'overhang' ? 0xffffff : color,
      vertexColors: mode === 'overhang',
      roughness: 0.62,
      metalness: 0.08,
      flatShading: true,
      clippingPlanes,
      side: THREE.FrontSide,
    });
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || dragging) return;
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(parts.children, false);
    if (tool === 'measure') {
      const point = hits[0]?.point ?? raycaster.ray.origin.clone().addScaledVector(raycaster.ray.direction, 40);
      if (!measureA) {
        measureA = point.clone();
        hooks.onMeasure('Pick the second point.');
      } else {
        const dist = measureA.distanceTo(point);
        drawMeasure(measureA, point, dist);
        hooks.onMeasure(`${dist.toFixed(2)} mm`);
        measureA = null;
      }
      return;
    }
    const id = hits[0] ? String(hits[0].object.userData.id ?? '') : '';
    if ((gizmo as unknown as { axis?: string | null }).axis) return;
    hooks.onSelect(id ? [id] : [], event.shiftKey);
  });

  function drawMeasure(a: THREE.Vector3, b: THREE.Vector3, dist: number) {
    measure.clear();
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    measure.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xe6a23c })));
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 8), new THREE.MeshBasicMaterial({ color: 0xe6a23c }));
    measure.add(dot.clone().translateX(0), dot);
    measure.children[1].position.copy(a);
    measure.children[2].position.copy(b);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const sprite = makeLabel(`${dist.toFixed(2)} mm`);
    sprite.position.copy(mid);
    measure.add(sprite);
  }

  function makeLabel(text: string): THREE.Sprite {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(20,18,16,0.85)';
      ctx.fillRect(0, 0, 256, 64);
      ctx.fillStyle = '#f3ecdf';
      ctx.font = '28px sans-serif';
      ctx.fillText(text, 16, 40);
    }
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
    sprite.scale.set(18, 4.5, 1);
    return sprite;
  }

  const api: Viewport = {
    setScene(doc, built) {
      const live = new Set<string>();
      for (const feature of doc.features) {
        const meshData = built.features.find((item) => item.id === feature.id);
        if (!meshData?.positions || feature.suppressed || !feature.visible) continue;
        live.add(feature.id);
        let mesh = meshes.get(feature.id);
        const geo = geometryOf(meshData.positions, shade, feature.transform.rotation);
        if (!mesh) {
          mesh = new THREE.Mesh(geo, materialFor(feature.color, shade));
          mesh.userData.id = feature.id;
          meshes.set(feature.id, mesh);
          parts.add(mesh);
        } else {
          mesh.geometry.dispose();
          (mesh.material as THREE.Material).dispose();
          mesh.geometry = geo;
          mesh.material = materialFor(feature.color, shade);
        }
        applyXform(mesh, feature.transform);
      }
      for (const [id, mesh] of meshes) {
        if (live.has(id)) continue;
        parts.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        meshes.delete(id);
      }
    },
    setSelection(ids) {
      for (const mesh of meshes.values()) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if ('emissive' in mat && mat.emissive) mat.emissive.set(ids.includes(String(mesh.userData.id)) ? 0x4a3414 : 0x000000);
      }
      gizmo.detach();
      if (ids.length === 1 && (tool === 'move' || tool === 'rotate')) {
        const mesh = meshes.get(ids[0]);
        if (mesh) gizmo.attach(mesh);
      }
    },
    setTool(next) {
      tool = next;
      gizmo.setMode(next === 'rotate' ? 'rotate' : 'translate');
      gizmo.enabled = next === 'move' || next === 'rotate';
      if (next !== 'move' && next !== 'rotate') gizmo.detach();
      if (next !== 'measure') {
        measureA = null;
      }
    },
    setSnap(mm, degrees) {
      gizmo.translationSnap = mm;
      gizmo.rotationSnap = degrees === null ? null : deg2rad(degrees);
    },
    setShade(mode, angle) {
      shade = mode;
      supportAngle = angle;
    },
    setSection(z) {
      section = z;
      if (z === null) clip.constant = 100000;
      else clip.constant = z;
    },
    setBed(x, y, visible) {
      bed.visible = visible;
      bed.scale.set(x / 220, y / 220, 1);
      grid.visible = visible;
      const size = Math.max(x, y);
      grid.scale.set(size / 220, size / 220, size / 220);
    },
    frame(mode) {
      const box = new THREE.Box3().setFromObject(parts);
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      if (box.isEmpty()) {
        center.set(0, 0, 10);
        size.set(80, 80, 40);
      } else {
        box.getCenter(center);
        box.getSize(size);
      }
      const radius = Math.max(size.x, size.y, size.z, 20) * 1.35;
      orbit.target.copy(center);
      if (mode === 'top') camera.position.set(center.x, center.y - radius * 0.01, center.z + radius);
      else if (mode === 'front') camera.position.set(center.x, center.y - radius, center.z);
      else if (mode === 'right') camera.position.set(center.x + radius, center.y, center.z);
      else camera.position.set(center.x + radius * 0.75, center.y - radius * 0.9, center.z + radius * 0.55);
      camera.up.set(0, 0, 1);
      camera.lookAt(center);
      orbit.update();
    },
    resize() {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    },
    dispose() {
      cancelAnimationFrame(frameId);
      gizmo.dispose();
      orbit.dispose();
      renderer.dispose();
    },
  };

  const resizeObs = new ResizeObserver(() => api.resize());
  resizeObs.observe(canvas.parentElement ?? canvas);
  api.resize();
  api.frame('iso');
  return api;
}
