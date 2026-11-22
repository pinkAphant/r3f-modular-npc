import * as THREE from 'three';
import type { DestructibleTargetHandle } from '../junk/DestructibleTarget';
import { HUD_LAYER } from '../shaders/dreamcastShader';
import type { WeaponArchetypeId } from '../types/posing';
import type { BallisticHitEvent } from '../types/range';

export interface WeaponBallisticSpec {
  maxAmmo: number;
  impulse: number;
  cooldownMs: number;
  recoilKick: number;
  viewOffset: [number, number, number];
}

export const WEAPON_SPECS: Record<WeaponArchetypeId, WeaponBallisticSpec> = {
  pistol: {
    maxAmmo: 12,
    impulse: 2.2,
    cooldownMs: 28,
    recoilKick: 0.045,
    viewOffset: [0.22, -0.2, -0.44],
  },
  shotgun: {
    maxAmmo: 6,
    impulse: 9.5,
    cooldownMs: 32,
    recoilKick: 0.085,
    viewOffset: [0.23, -0.22, -0.47],
  },
  smg: {
    maxAmmo: 24,
    impulse: 2.9,
    cooldownMs: 24,
    recoilKick: 0.032,
    viewOffset: [0.21, -0.21, -0.45],
  },
  rpg: {
    maxAmmo: 4,
    impulse: 15.0,
    cooldownMs: 32,
    recoilKick: 0.11,
    viewOffset: [0.25, -0.23, -0.5],
  },
};

const HUD_LAYER_MASK = 1 << HUD_LAYER;
const _raycaster = new THREE.Raycaster();
const _centerNdc = new THREE.Vector2(0, 0);
const _normMat = new THREE.Matrix3();
const _worldNorm = new THREE.Vector3();

function isObjectShootable(obj: THREE.Object3D): boolean {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    if (!cur.visible) return false;
    if ((cur.layers.mask & HUD_LAYER_MASK) !== 0 && (cur.layers.mask & 1) === 0) {
      return false;
    }
    const ud = cur.userData;
    if (
      ud?.isPlayerAvatar ||
      ud?.isWeaponAttachment ||
      ud?.isHudAttachment ||
      ud?.isDecal ||
      ud?.isGizmo
    ) {
      return false;
    }
    cur = cur.parent;
  }
  return true;
}

function findTargetHitHandler(obj: THREE.Object3D): {
  targetId: string;
  applyHit?: (hit: BallisticHitEvent) => void;
} | null {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    const ud = cur.userData;
    if (ud && typeof ud.targetId === 'string' && ud.destructibleTarget) {
      return {
        targetId: ud.targetId,
        applyHit: typeof ud.applyHit === 'function' ? ud.applyHit : undefined,
      };
    }
    cur = cur.parent;
  }
  return null;
}

export interface ReticleFireResult {
  hitTarget: boolean;
  targetId?: string;
}

/**
 * Casts a center-reticle ray against the rendered world, skipping player avatar,
 * FPS viewmodel, invisible groups, decals, gizmos, and HUD_LAYER objects.
 */
export function fireCenterReticleRay(
  scene: THREE.Scene,
  camera: THREE.Camera,
  weapon: WeaponArchetypeId,
  getTargetHandle?: (id: string) => DestructibleTargetHandle | null
): ReticleFireResult {
  camera.updateMatrixWorld();
  scene.updateMatrixWorld(true);

  _raycaster.setFromCamera(_centerNdc, camera);
  _raycaster.near = 0.05;
  _raycaster.far = 120;
  _raycaster.layers.set(0);

  const intersects = _raycaster.intersectObject(scene, true);
  const spec = WEAPON_SPECS[weapon];
  const dir = _raycaster.ray.direction;

  for (const hit of intersects) {
    if (!isObjectShootable(hit.object)) continue;

    const handler = findTargetHitHandler(hit.object);
    if (!handler) {
      // Blocked by arena wall, floor, crate, or pedestal before any target
      return { hitTarget: false };
    }

    if (hit.face?.normal) {
      _normMat.getNormalMatrix(hit.object.matrixWorld);
      _worldNorm.copy(hit.face.normal).applyMatrix3(_normMat);
      if (_worldNorm.lengthSq() > 1e-8) {
        _worldNorm.normalize();
      } else {
        _worldNorm.copy(dir).negate();
      }
      if (_worldNorm.dot(dir) > 0) {
        _worldNorm.negate();
      }
    } else {
      _worldNorm.copy(dir).negate();
    }

    const event: BallisticHitEvent = {
      targetId: handler.targetId,
      point: [hit.point.x, hit.point.y, hit.point.z],
      normal: [_worldNorm.x, _worldNorm.y, _worldNorm.z],
      impulse: [
        dir.x * spec.impulse,
        dir.y * spec.impulse + 0.05,
        dir.z * spec.impulse,
      ],
      distance: hit.distance,
    };

    const fn = handler.applyHit ?? getTargetHandle?.(handler.targetId)?.applyHit;
    fn?.(event);
    return { hitTarget: true, targetId: handler.targetId };
  }

  return { hitTarget: false };
}
