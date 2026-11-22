import * as THREE from 'three';

const SECONDARY_NAME_RE =
  /(hair|ponytail|braid|cape|scarf|cloth|skirt|tail|ear|antenna|dangle|jiggle|wiggle|ribbon)/i;
const FORBIDDEN_BONE_RE =
  /(hips|spine|chest|neck|arm|shoulder|hand|thumb|index|middle|ring|pinky|leg|foot|toe|socket|_end|4$)/i;
const UP_Y = new THREE.Vector3(0, 1, 0);
const MAX_TILT_RAD = THREE.MathUtils.degToRad(25);

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
}

export function intensityToVelocity(intensity: number): number {
  return THREE.MathUtils.lerp(0.95, 0.78, clamp01(intensity));
}

export function intensityToOmegaN(intensity: number): number {
  return THREE.MathUtils.lerp(36.0, 30.0, clamp01(intensity));
}

function normalizeBoneName(name: string): string {
  return name.replace(/^mixamorig:?/i, '');
}

function isSafeSecondaryBone(bone: THREE.Bone): boolean {
  const len = bone.position.length();
  if (len <= 0.005) return false;
  const dir = bone.position.clone().divideScalar(len);
  if (dir.angleTo(UP_Y) >= MAX_TILT_RAD) return false;

  const short = normalizeBoneName(bone.name);
  if (short === 'Head') return true;
  if (FORBIDDEN_BONE_RE.test(short)) return false;
  return (
    bone.userData?.wiggleVelocity !== undefined ||
    SECONDARY_NAME_RE.test(short)
  );
}

export function collectWiggleBones(
  root: THREE.Object3D,
  skeleton?: THREE.Skeleton | null
): THREE.Bone[] {
  const seen = new Set<THREE.Bone>();
  const candidates: THREE.Bone[] = [];
  const list: THREE.Bone[] = skeleton?.bones ?? [];

  if (list.length > 0) {
    for (const b of list) {
      if (b.isBone && !seen.has(b) && isSafeSecondaryBone(b)) {
        seen.add(b);
        candidates.push(b);
      }
    }
  } else {
    root.traverse((obj) => {
      const b = obj as THREE.Bone;
      if (b.isBone && !seen.has(b) && isSafeSecondaryBone(b)) {
        seen.add(b);
        candidates.push(b);
      }
    });
  }
  return candidates;
}

export interface WiggleBoneWithState {
  originPosition: THREE.Vector3;
  options: { velocity: number; maxStretch: number };
  oldBoneWorldPosition?: THREE.Vector3;
  update: (dt?: number | null) => void;
  reset: () => void;
  dispose: () => void;
}

const _currTarget = new THREE.Vector3();
const _subTarget = new THREE.Vector3();

export function advanceWiggleSubsteps(
  wb: WiggleBoneWithState,
  prevTarget: THREE.Vector3,
  currTarget: THREE.Vector3,
  subTargetScratch: THREE.Vector3,
  substeps: number
): void {
  const oldPos = wb.oldBoneWorldPosition;
  if (substeps <= 1 || !oldPos || !isFiniteVec(oldPos)) return;
  const alpha1 = Math.min(Math.max(wb.options.velocity * 0.85, 0), 0.99999);
  const alpha2 = 1 - (1 - alpha1) * (1 - alpha1);
  for (let k = 1; k < substeps; k++) {
    subTargetScratch.copy(prevTarget).lerp(currTarget, k / substeps);
    oldPos.lerp(subTargetScratch, alpha2);
  }
}

export function stepWiggleBoneSubstepped(
  bone: THREE.Bone,
  wb: WiggleBoneWithState,
  prevTargetPos: THREE.Vector3,
  hasPrevTarget: boolean,
  substeps: number,
  stepTime: number,
  fixedStep: number
): boolean {
  let nextHasPrev = hasPrevTarget;
  const wrapper = bone.parent;
  _currTarget.copy(wb.originPosition);
  if (wrapper && isFiniteVec(_currTarget)) {
    wrapper.updateWorldMatrix(true, false);
    wrapper.localToWorld(_currTarget);
    if (isFiniteVec(_currTarget)) {
      if (hasPrevTarget) {
        advanceWiggleSubsteps(wb, prevTargetPos, _currTarget, _subTarget, substeps);
      }
      prevTargetPos.copy(_currTarget);
      nextHasPrev = true;
    }
  }
  wb.update(substeps > 1 ? fixedStep : Math.min(stepTime, fixedStep));
  return nextHasPrev;
}

export function isFiniteVec(v: THREE.Vector3): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

export function isFiniteQuat(q: THREE.Quaternion): boolean {
  return (
    Number.isFinite(q.x) &&
    Number.isFinite(q.y) &&
    Number.isFinite(q.z) &&
    Number.isFinite(q.w)
  );
}
