import type { EcctrlHandle } from '@pinkaphant/ecctrl';
import type { EcctrlCameraControlsHandle } from '@pinkaphant/ecctrl/camera';
import { useFrame, useThree } from '@react-three/fiber';
import { useRef, type RefObject } from 'react';
import type * as THREE from 'three';
import type { CameraPerspective } from '../types/range';
import { syncPlayerTelemetry } from './rangeControls';

export interface RangeWarmupGateProps {
  active: boolean;
  perspective: CameraPerspective;
  prereqsReadyRef: RefObject<boolean>;
  readyRef: RefObject<boolean>;
  thirdPersonGroupRef?: RefObject<THREE.Group | null>;
  onWarmedUp: () => void;
}

export function RangeWarmupGate({
  active,
  perspective,
  prereqsReadyRef,
  readyRef,
  thirdPersonGroupRef,
  onWarmedUp,
}: RangeWarmupGateProps) {
  const { gl, scene, camera } = useThree();
  const phaseRef = useRef(0);
  const savedCulledRef = useRef<Array<[THREE.Object3D, boolean]>>([]);
  const perspRef = useRef(perspective);
  perspRef.current = perspective;

  useFrame(() => {
    if (!active || readyRef.current || !prereqsReadyRef.current) return;
    const tp = thirdPersonGroupRef?.current;

    if (phaseRef.current === 0) {
      gl.compile(scene, camera);
      if (tp && perspRef.current === 'first') {
        const saved: Array<[THREE.Object3D, boolean]> = [];
        tp.traverse((obj) => {
          saved.push([obj, obj.frustumCulled]);
          obj.frustumCulled = false;
        });
        savedCulledRef.current = saved;
        tp.visible = true;
        tp.scale.setScalar(1e-4);
        tp.updateMatrixWorld(true);
      }
      phaseRef.current = 1;
      return;
    }

    if (phaseRef.current === 1) {
      if (tp && savedCulledRef.current.length > 0) {
        for (const [obj, prev] of savedCulledRef.current) {
          obj.frustumCulled = prev;
        }
        savedCulledRef.current = [];
        tp.scale.setScalar(1);
        tp.visible = perspRef.current === 'third';
        tp.updateMatrixWorld(true);
      }
      phaseRef.current = 2;
      return;
    }

    phaseRef.current += 1;
    if (phaseRef.current >= 4) {
      readyRef.current = true;
      onWarmedUp();
    }
  }, 2);

  return null;
}

export interface PlayerPostStepSyncProps {
  active: boolean;
  perspective: CameraPerspective;
  ctrlRef: RefObject<EcctrlHandle | null>;
  camRef: RefObject<EcctrlCameraControlsHandle | null>;
  viewModelGroupRef: RefObject<THREE.Group | null>;
  spawnSyncedRef: RefObject<boolean>;
  hasFreshEcctrlStepRef: RefObject<boolean>;
  playerReadyFiredRef: RefObject<boolean>;
  savedAnglesRef: RefObject<{ azimuth: number; polar: number }>;
  onPlayerReadyRef: RefObject<(() => void) | undefined>;
  hasFirstPersonSlot: boolean;
  restCenterY: number;
  eyeOffsetY: number;
  firstPersonDist: number;
  thirdPersonDist: number;
}

export function PlayerPostStepSync({
  active,
  perspective,
  ctrlRef,
  camRef,
  viewModelGroupRef,
  spawnSyncedRef,
  hasFreshEcctrlStepRef,
  playerReadyFiredRef,
  savedAnglesRef,
  onPlayerReadyRef,
  hasFirstPersonSlot,
  restCenterY,
  eyeOffsetY,
  firstPersonDist,
  thirdPersonDist,
}: PlayerPostStepSyncProps) {
  const { camera } = useThree();
  useFrame(() => {
    if (!active) return;
    const ctrl = ctrlRef.current;
    const cam = camRef.current;
    if (!ctrl || !cam) return;
    if (!spawnSyncedRef.current) {
      if (ctrl.currPos.lengthSq() < 1e-4) return;
      spawnSyncedRef.current = true;
      const dist = perspective === 'first' ? firstPersonDist : thirdPersonDist;
      cam.moveTo(ctrl.currPos.x, ctrl.currPos.y + eyeOffsetY, ctrl.currPos.z, false);
      cam.dollyTo(dist, false);
      cam.rotateTo(0, Math.PI / 2, false);
      cam.update(0);
    }
    hasFreshEcctrlStepRef.current = true;
    cam.moveTo(ctrl.currPos.x, ctrl.currPos.y + eyeOffsetY, ctrl.currPos.z, perspective === 'third');
    cam.update(0);
    savedAnglesRef.current.azimuth = cam.azimuthAngle;
    savedAnglesRef.current.polar = cam.polarAngle;
    if (ctrl.body && ctrl.body.linvel().y > 2.0 && ctrl.body.gravityScale() === 0) {
      ctrl.body.setGravityScale(1, false);
    }
    if (viewModelGroupRef.current && hasFirstPersonSlot) {
      viewModelGroupRef.current.position.copy(camera.position);
      viewModelGroupRef.current.quaternion.copy(camera.quaternion);
    }
    const grounded = syncPlayerTelemetry(ctrl, camera, perspective, restCenterY);
    if (!playerReadyFiredRef.current && spawnSyncedRef.current && grounded) {
      playerReadyFiredRef.current = true;
      onPlayerReadyRef.current?.();
    }
  });
  return null;
}
