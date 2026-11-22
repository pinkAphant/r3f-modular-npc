import { CameraControlsImpl, useKeyboardControls, type KeyboardControlsEntry } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { EcctrlHandle } from '@pinkaphant/ecctrl';
import type { EcctrlCameraControlsHandle } from '@pinkaphant/ecctrl/camera';
import { useEffect, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import type { CameraPerspective } from '../types/range';
import { setTelemetryCamera, setTelemetryPlayer } from './rangeTelemetry';

const _camDir = new THREE.Vector3();
const _heroProj = new THREE.Vector3();

export function syncPlayerTelemetry(
  ctrl: EcctrlHandle,
  camera: THREE.Camera,
  perspective: CameraPerspective,
  restCenterY: number
): boolean {
  camera.getWorldDirection(_camDir);
  _heroProj.set(ctrl.currPos.x, ctrl.currPos.y + 0.1, ctrl.currPos.z).project(camera);
  setTelemetryCamera(
    perspective,
    Math.atan2(-_camDir.x, -_camDir.z),
    Math.asin(THREE.MathUtils.clamp(_camDir.y, -1, 1)),
    perspective === 'third' &&
      Math.abs(_heroProj.x) <= 1 &&
      Math.abs(_heroProj.y) <= 1 &&
      _heroProj.z >= -1 &&
      _heroProj.z <= 1
  );
  const lv = ctrl.body ? ctrl.body.linvel() : ctrl.currLinVel;
  const relY = ctrl.currPos.y - ctrl.standPoint.y;
  const grounded =
    Boolean(ctrl.isOnGround) &&
    !ctrl.jumpActive &&
    !ctrl.input.jump &&
    Math.abs(lv.y) < 0.25 &&
    relY >= restCenterY - 0.08 &&
    relY <= restCenterY + 0.12;
  setTelemetryPlayer(
    [ctrl.currPos.x, ctrl.currPos.y, ctrl.currPos.z],
    [lv.x, lv.y, lv.z],
    grounded
  );
  return grounded;
}

export const RANGE_KEYBOARD_MAP: KeyboardControlsEntry[] = [
  { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
  { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
  { name: 'leftward', keys: ['ArrowLeft', 'KeyA'] },
  { name: 'rightward', keys: ['ArrowRight', 'KeyD'] },
  { name: 'jump', keys: ['Space'] },
  { name: 'run', keys: ['ShiftLeft', 'ShiftRight', 'Shift'] },
  { name: 'toggleView', keys: ['KeyV'] },
];

export const CAMERA_MOUSE_BUTTONS = {
  left: CameraControlsImpl.ACTION.ROTATE,
  middle: CameraControlsImpl.ACTION.NONE,
  right: CameraControlsImpl.ACTION.ROTATE,
  wheel: CameraControlsImpl.ACTION.NONE,
} as const;

export const CAMERA_TOUCHES = {
  one: CameraControlsImpl.ACTION.TOUCH_ROTATE,
  two: CameraControlsImpl.ACTION.NONE,
  three: CameraControlsImpl.ACTION.NONE,
} as const;

export function requestPointerLockSafely(
  cam: EcctrlCameraControlsHandle | null,
  dom: HTMLElement
): void {
  if (!cam) return;
  const target =
    (cam as unknown as { _domElement?: HTMLElement })._domElement ?? dom;
  if (typeof target.requestPointerLock !== 'function') return;
  const hadOwn = Object.prototype.hasOwnProperty.call(target, 'requestPointerLock');
  const origRequest = target.requestPointerLock;
  target.requestPointerLock = function (
    this: HTMLElement,
    ...args: Parameters<HTMLElement['requestPointerLock']>
  ) {
    const result = Reflect.apply(origRequest, this, args) as unknown as
      | Promise<void>
      | undefined;
    if (result && typeof result.catch === 'function') {
      result.catch(() => {
        cam.unlockPointer();
      });
    }
    return result as ReturnType<HTMLElement['requestPointerLock']>;
  };
  try {
    cam.lockPointer();
  } catch {
    cam.unlockPointer();
  } finally {
    if (hadOwn) {
      target.requestPointerLock = origRequest;
    } else {
      delete (target as { requestPointerLock?: unknown }).requestPointerLock;
    }
  }
}

export function bindRangePointerEvents(
  dom: HTMLElement,
  lockTarget: HTMLElement,
  cam: EcctrlCameraControlsHandle | null,
  onPrimaryFire: () => void,
  onPointerLockChange?: (locked: boolean) => void
): () => void {
  const handlePointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    onPrimaryFire();
    if (!document.pointerLockElement) requestPointerLockSafely(cam, lockTarget);
  };
  const handlePointerLockChange = () => {
    const el = document.pointerLockElement;
    onPointerLockChange?.(el === lockTarget || el === dom);
  };
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Escape' && document.pointerLockElement) {
      cam?.unlockPointer?.();
      document.exitPointerLock?.();
    }
  };
  lockTarget.addEventListener('pointerdown', handlePointerDown);
  document.addEventListener('pointerlockchange', handlePointerLockChange);
  window.addEventListener('keydown', handleKeyDown);
  return () => {
    lockTarget.removeEventListener('pointerdown', handlePointerDown);
    document.removeEventListener('pointerlockchange', handlePointerLockChange);
    window.removeEventListener('keydown', handleKeyDown);
  };
}

export function restoreRangeCamera(
  camera: THREE.Camera,
  cam: EcctrlCameraControlsHandle | null,
  pos: [number, number, number],
  dist: number,
  azimuth: number,
  polar: number
): void {
  const persp = camera as THREE.PerspectiveCamera;
  if (persp.isPerspectiveCamera) {
    persp.fov = 70;
    persp.near = 0.05;
    persp.far = 150;
    persp.updateProjectionMatrix();
  }
  if (!cam) return;
  cam.moveTo(pos[0], pos[1], pos[2], false);
  cam.dollyTo(dist, false);
  cam.rotateTo(azimuth, polar, false);
  cam.update(0);
}

export interface PlayerInputSyncProps {
  ctrlRef: RefObject<EcctrlHandle | null>;
  onTogglePerspective: () => void;
  active?: boolean;
}

export function PlayerInputSync({
  ctrlRef,
  onTogglePerspective,
  active = true,
}: PlayerInputSyncProps) {
  const [subscribeKeys, getKeys] = useKeyboardControls();
  const jumpLatchRef = useRef(false);
  const activeRef = useRef(active);
  activeRef.current = active;
  const wasActiveRef = useRef(active);
  const onToggleRef = useRef(onTogglePerspective);
  onToggleRef.current = onTogglePerspective;

  useEffect(() => {
    const unsubJump = subscribeKeys(
      (s) => Boolean(s.jump),
      (pressed) => {
        if (pressed && activeRef.current) jumpLatchRef.current = true;
      }
    );
    const unsubView = subscribeKeys(
      (s) => Boolean(s.toggleView),
      (pressed) => {
        if (pressed && activeRef.current) onToggleRef.current();
      }
    );
    return () => {
      unsubJump();
      unsubView();
    };
  }, [subscribeKeys]);

  useFrame(() => {
    const ctrl = ctrlRef.current;
    if (!ctrl) return;
    if (!activeRef.current) {
      jumpLatchRef.current = false;
      if (wasActiveRef.current) {
        ctrl.setMovement({
          forward: false,
          backward: false,
          leftward: false,
          rightward: false,
          run: false,
          jump: false,
        });
        wasActiveRef.current = false;
      }
      return;
    }
    wasActiveRef.current = true;
    const keys = getKeys();
    const jump = Boolean(keys.jump) || jumpLatchRef.current;
    jumpLatchRef.current = false;
    ctrl.setMovement({
      forward: Boolean(keys.forward),
      backward: Boolean(keys.backward),
      leftward: Boolean(keys.leftward),
      rightward: Boolean(keys.rightward),
      run: Boolean(keys.run),
      jump,
    });
  });

  return null;
}
