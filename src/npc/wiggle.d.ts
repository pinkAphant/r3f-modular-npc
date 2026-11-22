declare module 'wiggle' {
  import type * as THREE from 'three';

  export interface WiggleBoneOptions {
    velocity?: number;
    maxStretch?: number;
    scene?: THREE.Object3D;
  }

  export class WiggleBone {
    target: THREE.Bone;
    originPosition: THREE.Vector3;
    originRotation: THREE.Euler;
    options: { velocity: number; maxStretch: number; scene?: THREE.Object3D };
    constructor(target: THREE.Bone, options?: WiggleBoneOptions);
    update(dt?: number | null): void;
    reset(): void;
    dispose(): void;
  }
}

declare module 'wiggle/rig' {
  import type * as THREE from 'three';
  export class WiggleRig {
    constructor(root: THREE.Object3D);
    update(dt?: number | null): void;
    dispose(): void;
  }
}
