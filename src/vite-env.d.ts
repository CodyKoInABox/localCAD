declare module 'manifold-3d/manifold.wasm?url' {
  const url: string;
  export default url;
}

declare module 'three/addons/controls/OrbitControls.js' {
  import { Camera, Vector3 } from 'three';
  export class OrbitControls {
    constructor(camera: Camera, domElement?: HTMLElement);
    enabled: boolean;
    target: Vector3;
    enableDamping: boolean;
    dampingFactor: number;
    minDistance: number;
    maxDistance: number;
    maxPolarAngle: number;
    minPolarAngle: number;
    update(): void;
    dispose(): void;
    addEventListener(type: string, listener: () => void): void;
  }
}

declare module 'three/addons/controls/TransformControls.js' {
  import { Camera, Object3D } from 'three';
  export class TransformControls {
    constructor(camera: Camera, domElement?: HTMLElement);
    enabled: boolean;
    dragging: boolean;
    mode: 'translate' | 'rotate' | 'scale';
    translationSnap: number | null;
    rotationSnap: number | null;
    attach(object: Object3D): this;
    detach(): this;
    getHelper(): Object3D;
    setMode(mode: 'translate' | 'rotate' | 'scale'): void;
    addEventListener(type: string, listener: (event: { value?: unknown }) => void): void;
    dispose(): void;
  }
}
