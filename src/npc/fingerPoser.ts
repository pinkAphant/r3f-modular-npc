import * as THREE from 'three';
import type {
  DigitJointPose, FingerName, FingerPoseTag, HandPoseSpec, HandSide,
} from '../types/posing';
import { FINGER_NAMES, FINGER_POSE_PRESETS } from './fingerPoseSchema';

interface PhalanxCalib {
  side: HandSide;
  finger: FingerName;
  phalanx: 1 | 2 | 3;
  shortKey: string;
  bone: THREE.Object3D;
  restQuat: THREE.Quaternion;
  animBaseQuat: THREE.Quaternion;
  currentQuat: THREE.Quaternion;
  lastAppliedQuat: THREE.Quaternion;
  wasPoserApplied: boolean;
  curlAxis: THREE.Vector3;
  spreadAxis: THREE.Vector3;
  twistAxis: THREE.Vector3;
}

function exactQuatMatch(a: THREE.Quaternion, b: THREE.Quaternion): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z && a.w === b.w;
}

export interface FingerPoser {
  apply: (tag: FingerPoseTag, weight: number, delta: number) => void;
  resetBasePose: () => void;
  getEulerSnapshot: () => Record<string, [number, number, number]>;
  getBoneCount: () => number;
}

function resolveBone(
  root: THREE.Object3D,
  skeleton: THREE.Skeleton | null | undefined,
  suffix: string
): THREE.Object3D | null {
  const candidates = [`mixamorig${suffix}`, `mixamorig:${suffix}`, suffix];
  if (skeleton?.bones.length) {
    for (const c of candidates) {
      const hit = skeleton.bones.find((b) => b.name === c);
      if (hit) return hit;
    }
    const stripped = skeleton.bones.find(
      (b) => b.name.replace(/^mixamorig:?/i, '') === suffix
    );
    if (stripped) return stripped;
  }
  for (const c of candidates) {
    const hit = root.getObjectByName(c);
    if (hit) return hit;
  }
  return null;
}

function toLocalAxis(
  worldAxis: THREE.Vector3,
  invWorldQuat: THREE.Quaternion,
  fallback: THREE.Vector3
): THREE.Vector3 {
  if (worldAxis.lengthSq() < 1e-8) return fallback.clone();
  return worldAxis.clone().applyQuaternion(invWorldQuat).normalize();
}

function calibrateSide(
  root: THREE.Object3D,
  skeleton: THREE.Skeleton | null | undefined,
  side: HandSide
): PhalanxCalib[] {
  const hand = resolveBone(root, skeleton, `${side}Hand`);
  const index1 = resolveBone(root, skeleton, `${side}HandIndex1`);
  const middle1 = resolveBone(root, skeleton, `${side}HandMiddle1`);
  const pinky1 = resolveBone(root, skeleton, `${side}HandPinky1`);
  if (!hand || !index1 || !middle1 || !pinky1) return [];

  const handW = new THREE.Vector3(), idxW = new THREE.Vector3();
  const midW = new THREE.Vector3(), pnkW = new THREE.Vector3();
  hand.getWorldPosition(handW);
  index1.getWorldPosition(idxW);
  middle1.getWorldPosition(midW);
  pinky1.getWorldPosition(pnkW);

  const alongHand = midW.clone().sub(handW).normalize();
  const radialRaw = idxW.clone().sub(pnkW);
  const radial = radialRaw
    .sub(alongHand.clone().multiplyScalar(radialRaw.dot(alongHand)))
    .normalize();
  const palmNormal =
    side === 'Left'
      ? new THREE.Vector3().crossVectors(alongHand, radial).normalize()
      : new THREE.Vector3().crossVectors(radial, alongHand).normalize();

  const result: PhalanxCalib[] = [];
  const childW = new THREE.Vector3(), boneW = new THREE.Vector3();
  const worldQuat = new THREE.Quaternion(), invWorldQuat = new THREE.Quaternion();

  for (const finger of FINGER_NAMES) {
    const abductSign =
      finger === 'Thumb' || finger === 'Index' || finger === 'Middle' ? 1 : -1;
    const abductDirW = radial.clone().multiplyScalar(abductSign);
    const flexTargetW =
      finger === 'Thumb'
        ? palmNormal.clone().multiplyScalar(0.75).addScaledVector(radial, -0.65).normalize()
        : palmNormal;

    for (const phalanx of [1, 2, 3] as const) {
      const bone = resolveBone(root, skeleton, `${side}Hand${finger}${phalanx}`);
      const child = resolveBone(root, skeleton, `${side}Hand${finger}${phalanx + 1}`);
      if (!bone) continue;

      bone.getWorldPosition(boneW);
      bone.getWorldQuaternion(worldQuat);
      invWorldQuat.copy(worldQuat).invert();

      let boneDirW = alongHand.clone();
      if (child) {
        child.getWorldPosition(childW);
        const diff = childW.sub(boneW);
        if (diff.lengthSq() > 1e-8) boneDirW = diff.normalize();
      }

      const curlAxisW = new THREE.Vector3().crossVectors(boneDirW, flexTargetW);
      const spreadAxisW = new THREE.Vector3().crossVectors(boneDirW, abductDirW);
      const twistAxisW = boneDirW.clone().multiplyScalar(side === 'Left' ? 1 : -1);

      result.push({
        side,
        finger,
        phalanx,
        shortKey: `${side}Hand${finger}${phalanx}`,
        bone,
        restQuat: bone.quaternion.clone(),
        animBaseQuat: bone.quaternion.clone(),
        currentQuat: bone.quaternion.clone(),
        lastAppliedQuat: bone.quaternion.clone(),
        wasPoserApplied: false,
        curlAxis: toLocalAxis(curlAxisW, invWorldQuat, new THREE.Vector3(1, 0, 0)),
        spreadAxis: toLocalAxis(spreadAxisW, invWorldQuat, new THREE.Vector3(0, 0, 1)),
        twistAxis: toLocalAxis(twistAxisW, invWorldQuat, new THREE.Vector3(0, 1, 0)),
      });
    }
  }
  return result;
}

export function createFingerPoser(
  root: THREE.Object3D,
  skeleton?: THREE.Skeleton | null
): FingerPoser {
  root.updateMatrixWorld(true);
  const phalanges: PhalanxCalib[] = [
    ...calibrateSide(root, skeleton, 'Left'),
    ...calibrateSide(root, skeleton, 'Right'),
  ];

  let currentWeight = 0;
  let lastTag: FingerPoseTag | null = null;
  const baseQ = new THREE.Quaternion(), qCurl = new THREE.Quaternion();
  const qSpread = new THREE.Quaternion(), qTwist = new THREE.Quaternion();
  const deltaQ = new THREE.Quaternion(), goalQ = new THREE.Quaternion();
  const tmpEuler = new THREE.Euler(0, 0, 0, 'XYZ');

  const resetBasePose = () => {
    for (const p of phalanges) {
      if (p.wasPoserApplied && exactQuatMatch(p.bone.quaternion, p.lastAppliedQuat)) {
        p.bone.quaternion.copy(p.restQuat);
      }
      p.animBaseQuat.copy(p.restQuat);
      p.wasPoserApplied = false;
    }
  };

  const apply = (tag: FingerPoseTag, weight: number, delta: number) => {
    if (phalanges.length === 0) return;
    const tagChanged = lastTag !== null && lastTag !== tag;
    lastTag = tag;
    const dt = Math.min(Math.max(Number.isFinite(delta) ? delta : 0.016, 0), 0.05);
    const baseAlpha = dt > 0 ? 1 - Math.exp(-36 * dt) : 1;
    const alpha = tagChanged ? Math.max(0.96, baseAlpha) : baseAlpha;
    const targetWeight = Math.min(1, Math.max(0, Number.isFinite(weight) ? weight : 1));
    currentWeight = THREE.MathUtils.lerp(currentWeight, targetWeight, alpha);
    if (currentWeight <= 1e-4) {
      currentWeight = 0;
      for (const p of phalanges) {
        const isPoserOwned =
          p.wasPoserApplied && exactQuatMatch(p.bone.quaternion, p.lastAppliedQuat);
        if (isPoserOwned) p.bone.quaternion.copy(p.animBaseQuat);
        else p.animBaseQuat.copy(p.bone.quaternion);
        p.wasPoserApplied = false;
        p.currentQuat.copy(p.bone.quaternion);
      }
      return;
    }

    const preset = FINGER_POSE_PRESETS[tag] ?? FINGER_POSE_PRESETS.relaxed;

    for (const p of phalanges) {
      const isPoserOwned =
        p.wasPoserApplied && exactQuatMatch(p.bone.quaternion, p.lastAppliedQuat);
      if (!isPoserOwned) p.animBaseQuat.copy(p.bone.quaternion);

      const handSpec: HandPoseSpec | undefined =
        p.side === 'Right' ? preset.rightHand : preset.leftHand;
      const digitPose: DigitJointPose | undefined = handSpec?.[p.finger];
      if (!digitPose) {
        if (isPoserOwned) p.bone.quaternion.copy(p.animBaseQuat);
        p.wasPoserApplied = false;
        continue;
      }

      baseQ.copy(p.animBaseQuat);

      const curlAngle = digitPose.curl[p.phalanx - 1] ?? 0;
      const spreadAngle = p.phalanx === 1 ? digitPose.spread : 0;
      const twistAngle = p.phalanx === 1 ? (digitPose.twist ?? 0) : 0;

      qCurl.setFromAxisAngle(p.curlAxis, curlAngle);
      qSpread.setFromAxisAngle(p.spreadAxis, spreadAngle);
      qTwist.setFromAxisAngle(p.twistAxis, twistAngle);

      deltaQ.copy(qSpread).multiply(qTwist).multiply(qCurl);
      goalQ.copy(p.restQuat).multiply(deltaQ);
      p.currentQuat.slerp(goalQ, alpha);
      p.bone.quaternion.copy(baseQ).slerp(p.currentQuat, currentWeight);
      p.lastAppliedQuat.copy(p.bone.quaternion);
      p.wasPoserApplied = true;
    }
  };

  const getEulerSnapshot = (): Record<string, [number, number, number]> => {
    const out: Record<string, [number, number, number]> = {};
    for (const p of phalanges) {
      tmpEuler.setFromQuaternion(p.bone.quaternion, 'XYZ');
      out[p.shortKey] = [tmpEuler.x, tmpEuler.y, tmpEuler.z];
    }
    return out;
  };

  return { apply, resetBasePose, getEulerSnapshot, getBoneCount: () => phalanges.length };
}
