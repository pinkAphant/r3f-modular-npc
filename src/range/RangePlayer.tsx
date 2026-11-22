import { KeyboardControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Ecctrl, type EcctrlHandle } from '@pinkaphant/ecctrl';
import { EcctrlAnimationStateController, type EcctrlAnimationState } from '@pinkaphant/ecctrl/animation';
import { EcctrlCameraControls, type EcctrlCameraControlsHandle } from '@pinkaphant/ecctrl/camera';
import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import * as THREE from 'three';
import type { CameraPerspective } from '../types/range';
import {
  bindRangePointerEvents, CAMERA_MOUSE_BUTTONS, CAMERA_TOUCHES, PlayerInputSync,
  RANGE_KEYBOARD_MAP, restoreRangeCamera,
} from './rangeControls';
import { PlayerPostStepSync } from './rangePostStepSync';
import { EcctrlSubstepSync, PLAYER_ECCTRL_PHYSICS } from './rangeSubstepSync';

// SI human scale: 2 * 0.50 + 2 * 0.30 + 0.15 = 1.75 m standing height
export const PLAYER_CAPSULE_HALF_HEIGHT = 0.5;
export const PLAYER_CAPSULE_RADIUS = 0.3;
export const PLAYER_FLOAT_HEIGHT = 0.15;
export const PLAYER_REST_CENTER_Y = PLAYER_FLOAT_HEIGHT + PLAYER_CAPSULE_RADIUS + PLAYER_CAPSULE_HALF_HEIGHT;
export const PLAYER_EYE_HEIGHT = 1.62;
export const PLAYER_EYE_OFFSET_Y = PLAYER_EYE_HEIGHT - PLAYER_REST_CENTER_Y;
export const FIRST_PERSON_DISTANCE = 0.02;
export const THIRD_PERSON_DISTANCE = 3.2;
export const DEFAULT_SPAWN_POSITION: [number, number, number] = [0, PLAYER_REST_CENTER_Y, 2.5];
const PLAYER_DEC_DELTA_TIME = 0.90;
const PLAYER_SLIDE_GRIP = 1.0;
export { RANGE_KEYBOARD_MAP };

export interface RangePlayerProps {
  active?: boolean;
  perspective: CameraPerspective;
  onTogglePerspective: () => void;
  onPointerLockChange?: (locked: boolean) => void;
  onAnimationStateChange?: (state: EcctrlAnimationState) => void;
  onPlayerReady?: () => void;
  onFire?: (scene: THREE.Scene, camera: THREE.Camera) => void;
  spawnPosition?: [number, number, number];
  debug?: boolean;
  ecctrlRef?: RefObject<EcctrlHandle | null>;
  cameraControlsRef?: RefObject<EcctrlCameraControlsHandle | null>;
  thirdPersonGroupRef?: RefObject<THREE.Group | null>;
  firstPersonSlot?: ReactNode;
  thirdPersonAvatar?: ReactNode;
}

function DefaultStandInAvatar() {
  return (
    <mesh position={[0, 0.88, 0]}>
      <capsuleGeometry args={[0.24, 0.9, 4, 8]} />
      <meshStandardMaterial color="#38bdf8" roughness={0.6} />
    </mesh>
  );
}

function PlayerRig({
  active = true,
  perspective,
  onTogglePerspective,
  onPointerLockChange,
  onAnimationStateChange,
  onPlayerReady,
  onFire,
  spawnPosition = DEFAULT_SPAWN_POSITION,
  debug = false,
  ecctrlRef,
  cameraControlsRef,
  thirdPersonGroupRef,
  firstPersonSlot,
  thirdPersonAvatar,
}: RangePlayerProps) {
  const internalEcctrlRef = useRef<EcctrlHandle | null>(null);
  const internalCamRef = useRef<EcctrlCameraControlsHandle | null>(null);
  const internalTpGroupRef = useRef<THREE.Group | null>(null);
  const ctrlRef = ecctrlRef ?? internalEcctrlRef;
  const camRef = cameraControlsRef ?? internalCamRef;
  const tpGroupRef = thirdPersonGroupRef ?? internalTpGroupRef;
  const viewModelGroupRef = useRef<THREE.Group | null>(null);
  const mountedRef = useRef(false);
  const spawnSyncedRef = useRef(false);
  const hasFreshEcctrlStepRef = useRef(false);
  const playerReadyFiredRef = useRef(false);
  const wasActiveRef = useRef(false);
  const activeRef = useRef(active);
  activeRef.current = active;
  const savedAnglesRef = useRef({ azimuth: 0, polar: Math.PI / 2 });

  const { gl, scene, camera, events } = useThree();
  const onFireRef = useRef(onFire);
  onFireRef.current = onFire;
  const onPlayerReadyRef = useRef(onPlayerReady);
  onPlayerReadyRef.current = onPlayerReady;

  useEffect(() => {
    if (!active) return;
    const dom = gl.domElement;
    const lockTarget = (events.connected as HTMLElement | null) ?? dom;
    return bindRangePointerEvents(
      dom,
      lockTarget,
      camRef.current,
      () => onFireRef.current?.(scene, camera),
      onPointerLockChange
    );
  }, [active, gl, scene, camera, events, camRef, onPointerLockChange]);

  useEffect(() => {
    ctrlRef.current?.body?.setGravityScale(0, false);
    const cam = camRef.current;
    const dist = perspective === 'first' ? FIRST_PERSON_DISTANCE : THIRD_PERSON_DISTANCE;
    cam?.moveTo(spawnPosition[0], spawnPosition[1] + PLAYER_EYE_OFFSET_Y, spawnPosition[2], false);
    cam?.dollyTo(dist, false);
    cam?.rotateTo(0, Math.PI / 2, false);
    cam?.update(0);
    ctrlRef.current?.setLockForward(perspective === 'first');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (active && !wasActiveRef.current) {
      const ctrl = ctrlRef.current;
      const eyePos: [number, number, number] = ctrl && ctrl.currPos.lengthSq() >= 1e-4
        ? [ctrl.currPos.x, ctrl.currPos.y + PLAYER_EYE_OFFSET_Y, ctrl.currPos.z]
        : [spawnPosition[0], spawnPosition[1] + PLAYER_EYE_OFFSET_Y, spawnPosition[2]];
      const dist = perspective === 'first' ? FIRST_PERSON_DISTANCE : THIRD_PERSON_DISTANCE;
      restoreRangeCamera(
        camera,
        camRef.current,
        eyePos,
        dist,
        savedAnglesRef.current.azimuth,
        savedAnglesRef.current.polar
      );
      ctrl?.setLockForward(perspective === 'first');
    }
    wasActiveRef.current = active;
  }, [active, perspective, camera, camRef, ctrlRef, spawnPosition]);

  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    if (!activeRef.current) return;
    const dist = perspective === 'first' ? FIRST_PERSON_DISTANCE : THIRD_PERSON_DISTANCE;
    camRef.current?.dollyTo(dist, true);
    ctrlRef.current?.setLockForward(perspective === 'first');
  }, [perspective, camRef, ctrlRef]);

  return (
    <>
      <PlayerInputSync ctrlRef={ctrlRef} onTogglePerspective={onTogglePerspective} active={active} />
      <EcctrlSubstepSync
        ctrlRef={ctrlRef}
        active={active}
        spawnSyncedRef={spawnSyncedRef}
        hasFreshEcctrlStepRef={hasFreshEcctrlStepRef}
        capsuleHalfHeight={PLAYER_CAPSULE_HALF_HEIGHT}
        capsuleRadius={PLAYER_CAPSULE_RADIUS}
        floatHeight={PLAYER_FLOAT_HEIGHT}
        decDeltaTime={PLAYER_DEC_DELTA_TIME}
        slideGripFactor={PLAYER_SLIDE_GRIP}
      />
      {active ? (
        <EcctrlCameraControls
          ref={camRef}
          makeDefault
          smoothTime={perspective === 'first' ? 0.02 : 0.08}
          draggingSmoothTime={0.02}
          minDistance={0.01}
          maxDistance={6}
          minPolarAngle={0.12}
          maxPolarAngle={Math.PI - 0.12}
          azimuthRotateSpeed={0.65}
          polarRotateSpeed={0.65}
          mouseButtons={CAMERA_MOUSE_BUTTONS}
          touches={CAMERA_TOUCHES}
        />
      ) : null}
      <Ecctrl
        ref={ctrlRef}
        enable={active}
        canSleep={false}
        position={spawnPosition}
        debug={debug}
        capsuleHalfHeight={PLAYER_CAPSULE_HALF_HEIGHT}
        capsuleRadius={PLAYER_CAPSULE_RADIUS}
        floatHeight={PLAYER_FLOAT_HEIGHT}
        lockForward={perspective === 'first'}
        maxWalkVel={2.5}
        maxRunVel={9.0}
        accDeltaTime={0.96}
        decDeltaTime={PLAYER_DEC_DELTA_TIME}
        slideGripFactor={PLAYER_SLIDE_GRIP}
        moveImpulsePointOffset={0}
        airDragFactor={0.85}
        enableToggleRun={false}
        groundDetection="shapeCast"
        autoBalance
        {...PLAYER_ECCTRL_PHYSICS}
      >
        <group ref={tpGroupRef} visible={perspective === 'third'} position={[0, -PLAYER_REST_CENTER_Y, 0]}>
          {thirdPersonAvatar ?? <DefaultStandInAvatar />}
        </group>
      </Ecctrl>
      <EcctrlAnimationStateController
        ecctrl={ctrlRef}
        onChange={(state) => onAnimationStateChange?.(state)}
      />
      <PlayerPostStepSync
        active={active}
        perspective={perspective}
        ctrlRef={ctrlRef}
        camRef={camRef}
        viewModelGroupRef={viewModelGroupRef}
        spawnSyncedRef={spawnSyncedRef}
        hasFreshEcctrlStepRef={hasFreshEcctrlStepRef}
        playerReadyFiredRef={playerReadyFiredRef}
        savedAnglesRef={savedAnglesRef}
        onPlayerReadyRef={onPlayerReadyRef}
        hasFirstPersonSlot={Boolean(firstPersonSlot)}
        restCenterY={PLAYER_REST_CENTER_Y}
        eyeOffsetY={PLAYER_EYE_OFFSET_Y}
        firstPersonDist={FIRST_PERSON_DISTANCE}
        thirdPersonDist={THIRD_PERSON_DISTANCE}
      />
      {firstPersonSlot ? (
        <group ref={viewModelGroupRef} visible={perspective === 'first'}>
          {firstPersonSlot}
        </group>
      ) : null}
    </>
  );
}

export function RangePlayer(props: RangePlayerProps) {
  return (
    <KeyboardControls map={RANGE_KEYBOARD_MAP}>
      <PlayerRig {...props} />
    </KeyboardControls>
  );
}
