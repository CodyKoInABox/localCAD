declare module 'three' {
  class AnyCtor {
    constructor(...args: any[]);
    [key: string]: any;
  }
  export class Vector2 extends AnyCtor {}
  export class Vector3 extends AnyCtor {}
  export class Euler extends AnyCtor {}
  export class Quaternion extends AnyCtor {}
  export class Matrix4 extends AnyCtor {}
  export class Object3D extends AnyCtor {}
  export class Scene extends Object3D {}
  export class Group extends Object3D {}
  export class Mesh extends Object3D {}
  export class Line extends Object3D {}
  export class Sprite extends Object3D {}
  export class Light extends Object3D {}
  export class HemisphereLight extends Light {}
  export class DirectionalLight extends Light {}
  export class Camera extends Object3D {}
  export class PerspectiveCamera extends Camera {}
  export class BufferGeometry extends AnyCtor {}
  export class BoxGeometry extends BufferGeometry {}
  export class SphereGeometry extends BufferGeometry {}
  export class Material extends AnyCtor {}
  export class MeshStandardMaterial extends Material {}
  export class MeshBasicMaterial extends Material {}
  export class LineBasicMaterial extends Material {}
  export class SpriteMaterial extends Material {}
  export class PointsMaterial extends Material {}
  export class WebGLRenderer extends AnyCtor {}
  export class GridHelper extends Object3D {}
  export class AxesHelper extends Object3D {}
  export class Box3 extends AnyCtor {}
  export class Raycaster extends AnyCtor {}
  export class Plane extends AnyCtor {}
  export class BufferAttribute extends AnyCtor {}
  export class CanvasTexture extends AnyCtor {}
  export const FrontSide: number;
  export const DoubleSide: number;
  export const SRGBColorSpace: string;
}
