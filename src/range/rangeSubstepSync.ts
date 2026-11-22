import type { EcctrlHandle } from '@pinkaphant/ecctrl';
import { useKeyboardControls } from '@react-three/drei';
import { useBeforePhysicsStep, useRapier } from '@react-three/rapier';
import { useMemo, type RefObject } from 'react';
import * as THREE from 'three';

export const PLAYER_ECCTRL_PHYSICS = {
  density: 16,
  springK: 850,
  dampingC: 220,
  fallingGravityScale: 1.8,
  rayHitForgiveness: 0.055,
  jumpVel: 4.35,
  jumpDuration: 0.025,
  autoBalanceSpringK: 8.0,
  autoBalanceDampingC: 0.48,
  autoBalanceSpringOnY: 1.28,
  autoBalanceDampingOnY: 0.096,
} as const;

const SLOPE_MAX_ANGLE = Math.PI / 2.5;
const FALLING_MAX_VEL = 20;
const _up = new THREE.Vector3(0, 1, 0);
const _refUp = new THREE.Vector3(0, 1, 0);
const _down = new THREE.Vector3(0, -1, 0);
const _q = new THREE.Quaternion();
const _rayOrigin = new THREE.Vector3();
const _normal = new THREE.Vector3();

type ColliderParentUd = { userData?: { ecctrl?: { excludeRay?: boolean; excludeCharacterRay?: boolean } } } | null;

function ecctrlRayFilter(collider: { parent: () => unknown }): boolean {
  const ud = (collider.parent() as ColliderParentUd)?.userData?.ecctrl;
  return !(ud?.excludeRay || ud?.excludeCharacterRay);
}

export interface EcctrlSubstepSyncProps {
  ctrlRef: RefObject<EcctrlHandle | null>;
  active: boolean;
  spawnSyncedRef: RefObject<boolean>;
  hasFreshEcctrlStepRef: RefObject<boolean>;
  capsuleHalfHeight: number;
  capsuleRadius: number;
  floatHeight: number;
  decDeltaTime: number;
  slideGripFactor: number;
}

export function EcctrlSubstepSync({
  ctrlRef,
  active,
  spawnSyncedRef,
  hasFreshEcctrlStepRef,
  capsuleHalfHeight,
  capsuleRadius,
  floatHeight,
  decDeltaTime,
  slideGripFactor,
}: EcctrlSubstepSyncProps) {
  const { rapier } = useRapier();
  const [, getKeys] = useKeyboardControls();
  const rayRadius = capsuleRadius / 2;
  const rayLength = capsuleRadius + 1;
  const groundFloatingDistance = rayRadius + floatHeight;
  const rayShape = useMemo(() => new rapier.Ball(rayRadius), [rapier, rayRadius]);

  useBeforePhysicsStep((world) => {
    if (!active || !spawnSyncedRef.current) return;
    const ctrl = ctrlRef.current;
    const body = ctrl?.body;
    const keys = getKeys();
    const liveMoving = Boolean(keys.forward || keys.backward || keys.leftward || keys.rightward);
    if (hasFreshEcctrlStepRef.current) {
      hasFreshEcctrlStepRef.current = false;
      if (!(ctrl?.isMoving && !liveMoving)) return;
    }
    if (!ctrl || !body || body.isSleeping()) return;

    const pos = body.translation();
    const rot = body.rotation();
    const vel = body.linvel();
    _up.set(0, 1, 0).applyQuaternion(_q.set(rot.x, rot.y, rot.z, rot.w));
    _rayOrigin.set(pos.x, pos.y, pos.z).addScaledVector(_up, -capsuleHalfHeight);

    const hit = world.castShape(
      _rayOrigin, rot, _down, rayShape, 0, rayLength, false,
      rapier.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, body, ecctrlRayFilter
    );

    const walkable = Boolean(hit) && _normal.set(hit!.normal1.x, hit!.normal1.y, hit!.normal1.z).angleTo(_refUp) < SLOPE_MAX_ANGLE;
    const isOnGround = walkable && hit!.time_of_impact < groundFloatingDistance + PLAYER_ECCTRL_PHYSICS.rayHitForgiveness;

    if (isOnGround && hit) {
      const springDist = groundFloatingDistance - hit.time_of_impact;
      let floatImpY = (springDist * PLAYER_ECCTRL_PHYSICS.springK - vel.y * PLAYER_ECCTRL_PHYSICS.dampingC) * world.timestep;
      if (ctrl.jumpActive && floatImpY < 0) floatImpY = 0;
      body.applyImpulse({ x: 0, y: floatImpY, z: 0 }, false);

      if (!ctrl.isMoving || !liveMoving) {
        const slideCoef = THREE.MathUtils.clamp(((hit.collider.friction() ?? 0) + slideGripFactor) * 0.5, 0, 1);
        const dragK = body.mass() * slideCoef * THREE.MathUtils.clamp(decDeltaTime, 0, 1);
        body.applyImpulse({ x: -vel.x * dragK, y: 0, z: -vel.z * dragK }, false);
      }
    }

    const isFalling = vel.y < 0 && !isOnGround;
    const targetGrav = isFalling
      ? Math.abs(vel.y) > FALLING_MAX_VEL ? 0 : PLAYER_ECCTRL_PHYSICS.fallingGravityScale
      : isOnGround ? 0 : 1;
    if (body.gravityScale() !== targetGrav) body.setGravityScale(targetGrav, false);
  });

  return null;
}
