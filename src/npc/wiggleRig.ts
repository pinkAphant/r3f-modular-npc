import * as THREE from 'three';
import { WiggleBone } from 'wiggle';
import {
  clamp01,
  collectWiggleBones,
  intensityToOmegaN,
  intensityToVelocity,
  isFiniteQuat,
  isFiniteVec,
  stepWiggleBoneSubstepped,
  type WiggleBoneWithState,
} from './wiggleHelpers';
import {
  clampQuatFromRest,
  computeRestQuat,
  stepAngularSpring,
} from './wiggleSpringMath';

export interface WiggleStats {
  activeBoneCount: number;
  intensity: number;
  hasNaN: boolean;
  maxTransformDrift: number;
  velocityMagnitude: number;
}

export interface WiggleRigController {
  setConfig: (enabled: boolean, intensity: number) => void;
  update: (delta: number) => void;
  reset: () => void;
  dispose: () => void;
  getStats: () => WiggleStats;
}

interface WiggleEntry {
  bone: THREE.Bone;
  wb: WiggleBone;
  restQuat: THREE.Quaternion;
  targetQuat: THREE.Quaternion;
  simQuat: THREE.Quaternion;
  angVel: THREE.Vector3;
  prevTargetPos: THREE.Vector3;
  hasPrevTarget: boolean;
}

const ZETA = 1.0;
const MAX_DEFLECT_RAD = THREE.MathUtils.degToRad(35);
const TIP_RADIUS = 0.25;
const FIXED_STEP = 1 / 60;
const MAX_DT = 0.35;
const MAX_SUBSTEPS = 24;

export function createWiggleRig(
  root: THREE.Object3D,
  skeleton?: THREE.Skeleton | null,
  opts?: { enabled?: boolean; intensity?: number }
): WiggleRigController {
  let enabled = opts?.enabled ?? true;
  let intensity = clamp01(opts?.intensity ?? 0.65);
  let acc = 0;
  let wasActive = enabled && intensity > 0.001;
  let hasNaN = false;
  let maxTransformDrift = 0;
  let velocityMagnitude = 0;

  root.updateMatrixWorld(true);
  const bones = collectWiggleBones(root, skeleton);
  const entries: WiggleEntry[] = bones.map((bone) => {
    const customVel =
      typeof bone.userData?.wiggleVelocity === 'number'
        ? bone.userData.wiggleVelocity
        : intensityToVelocity(intensity);
    const wb = new WiggleBone(bone, {
      velocity: customVel,
      maxStretch: 0.1,
    });
    // Strip cloned descendant nodes from wrapper so mixer/lookups stay unique
    const wrapper = bone.parent;
    if (wrapper) {
      for (const child of [...wrapper.children]) {
        if (child !== bone) wrapper.remove(child);
      }
    }
    const restQuat = computeRestQuat(wb.originPosition);
    const targetQuat = restQuat.clone();
    const simQuat = restQuat.clone();
    const angVel = new THREE.Vector3();
    bone.position.set(0, 0, 0);
    bone.quaternion.copy(restQuat);
    bone.updateMatrixWorld(true);
    return {
      bone,
      wb,
      restQuat,
      targetQuat,
      simQuat,
      angVel,
      prevTargetPos: new THREE.Vector3(),
      hasPrevTarget: false,
    };
  });

  const reset = () => {
    acc = 0;
    velocityMagnitude = 0;
    maxTransformDrift = 0;
    root.updateMatrixWorld(true);
    for (const entry of entries) {
      entry.wb.reset();
      entry.targetQuat.copy(entry.restQuat);
      entry.simQuat.copy(entry.restQuat);
      entry.angVel.set(0, 0, 0);
      entry.hasPrevTarget = false;
      entry.bone.position.set(0, 0, 0);
      entry.bone.quaternion.copy(entry.restQuat);
      entry.bone.updateMatrixWorld(true);
    }
  };

  const setConfig = (nextEnabled: boolean, nextIntensity: number) => {
    enabled = nextEnabled;
    intensity = clamp01(nextIntensity);
    const vel = intensityToVelocity(intensity);
    for (const entry of entries) {
      entry.wb.options.velocity = vel;
    }
  };

  const update = (delta: number) => {
    if (entries.length === 0) return;
    const dt = Math.min(Math.max(Number.isFinite(delta) ? delta : 0, 0), MAX_DT);

    if (!enabled || intensity <= 0.001) {
      if (wasActive) {
        reset();
        wasActive = false;
      }
      return;
    }
    wasActive = true;

    acc += dt;
    let wbRan = false;
    if (acc >= 0.006) {
      const stepTime = Math.min(acc, MAX_DT);
      acc = 0;
      wbRan = true;
      const substeps = Math.max(
        1,
        Math.min(MAX_SUBSTEPS, Math.round(stepTime / FIXED_STEP))
      );
      for (const entry of entries) {
        entry.hasPrevTarget = stepWiggleBoneSubstepped(
          entry.bone,
          entry.wb as unknown as WiggleBoneWithState,
          entry.prevTargetPos,
          entry.hasPrevTarget,
          substeps,
          stepTime,
          FIXED_STEP
        );
      }
    }

    const omegaN = intensityToOmegaN(intensity);
    let instMaxVel = 0;
    let drift = 0;
    let anomaly = false;

    for (const entry of entries) {
      const { bone, restQuat, targetQuat, simQuat, angVel } = entry;
      if (
        !isFiniteQuat(bone.quaternion) ||
        !isFiniteVec(bone.position) ||
        bone.position.lengthSq() > 0.25
      ) {
        anomaly = true;
        break;
      }

      if (wbRan) {
        targetQuat.copy(bone.quaternion);
        clampQuatFromRest(targetQuat, restQuat, MAX_DEFLECT_RAD);
      }
      if (!isFiniteQuat(targetQuat)) {
        anomaly = true;
        break;
      }

      stepAngularSpring(simQuat, angVel, targetQuat, omegaN, ZETA, dt);
      clampQuatFromRest(simQuat, restQuat, MAX_DEFLECT_RAD);
      if (!isFiniteQuat(simQuat) || !isFiniteVec(angVel)) {
        anomaly = true;
        break;
      }

      bone.quaternion.copy(simQuat);
      bone.updateMatrix();

      const theta = simQuat.angleTo(restQuat);
      const omega = angVel.length();
      const instVel = TIP_RADIUS * Math.hypot(omega, omegaN * theta);
      const posDrift = bone.position.length();
      if (
        !Number.isFinite(instVel) ||
        !Number.isFinite(posDrift) ||
        !Number.isFinite(theta)
      ) {
        anomaly = true;
        break;
      }
      if (instVel > instMaxVel) instMaxVel = instVel;
      drift = Math.max(drift, posDrift + theta);
    }

    if (anomaly) {
      hasNaN = true;
      reset();
      return;
    }

    for (const entry of entries) entry.bone.updateMatrixWorld(true);
    hasNaN = false;
    maxTransformDrift = drift;
    velocityMagnitude = instMaxVel;
  };

  const dispose = () => {
    for (const entry of entries) {
      entry.wb.dispose();
    }
  };

  return {
    setConfig,
    update,
    reset,
    dispose,
    getStats: () => ({
      activeBoneCount: entries.length,
      intensity,
      hasNaN,
      maxTransformDrift,
      velocityMagnitude,
    }),
  };
}
