import type { RapierRigidBody } from '@react-three/rapier';
import type { RefObject } from 'react';
import * as THREE from 'three';
import type {
  DecalRecord,
  DestructibleTargetSpec,
  ShardSpec,
} from '../types/junk';
import type { BallisticHitEvent } from '../types/range';
import {
  buildShardStates,
  computeLocalDecalTransform,
  createShardMaterial,
  type DestructibleTargetSnapshot,
  findClosestMeshInGroup,
  type SpawnedShardState,
} from './targetHelpers';
import type { TargetAssetsState } from './useTargetAssets';

export interface HitExecutionResult {
  shattered: boolean;
  nextHp: number;
  shatterPos?: [number, number, number];
  bodyPos?: [number, number, number];
  shardStates?: SpawnedShardState[];
  shardSpecs?: ShardSpec[];
  shardMaterial?: THREE.Material;
  newDecal?: DecalRecord;
  newDecalMesh?: THREE.Mesh;
}

const _worldScale = new THREE.Vector3();

/**
 * Applies physical knockback impulse and computes either a shatter state or a local decal.
 */
export function executeTargetHit(
  spec: DestructibleTargetSpec,
  assets: TargetAssetsState,
  rb: RapierRigidBody | null,
  group: THREE.Group | null,
  primaryMesh: THREE.Mesh | null,
  currentHp: number,
  nextDecalId: string,
  hit: BallisticHitEvent
): HitExecutionResult {
  let bodyPos: [number, number, number] | undefined;
  if (rb) {
    const rbAny = rb as RapierRigidBody & {
      recomputeMassPropertiesFromColliders?: () => void;
    };
    rbAny.recomputeMassPropertiesFromColliders?.();
    const mass = Math.max(0.001, rb.mass());
    const maxImp = mass * 3.5;
    const rawMag = Math.hypot(hit.impulse[0], hit.impulse[1], hit.impulse[2]);
    const scale = rawMag > maxImp && rawMag > 1e-6 ? maxImp / rawMag : 1;
    rb.applyImpulseAtPoint(
      {
        x: hit.impulse[0] * scale,
        y: hit.impulse[1] * scale,
        z: hit.impulse[2] * scale,
      },
      { x: hit.point[0], y: hit.point[1], z: hit.point[2] },
      true
    );
    const curT = rb.translation();
    bodyPos = [curT.x, curT.y, curT.z];
  }

  const impMag = Math.hypot(hit.impulse[0], hit.impulse[1], hit.impulse[2]);
  const dmg = Math.max(
    1,
    Math.round(spec.maxHp * Math.min(1, Math.max(0.28, impMag / 8)))
  );
  const nextHp = Math.max(0, currentHp - dmg);

  if ((spec.fragile || nextHp <= 0) && group) {
    const wPos = new THREE.Vector3(...spec.position);
    const wQuat = new THREE.Quaternion();
    if (rb) {
      const t = rb.translation();
      const r = rb.rotation();
      wPos.set(t.x, t.y, t.z);
      wQuat.set(r.x, r.y, r.z, r.w);
    } else {
      group.getWorldPosition(wPos);
      group.getWorldQuaternion(wQuat);
    }

    const { states, specs } = buildShardStates(
      group,
      spec.shatterPieceCount,
      wPos,
      wQuat,
      hit,
      spec.kind
    );
    const mat = createShardMaterial(
      spec.kind,
      assets.activeLabelTex,
      assets.importedRoot
    );

    return {
      shattered: true,
      nextHp: 0,
      shatterPos: [wPos.x, wPos.y, wPos.z],
      shardStates: states,
      shardSpecs: specs,
      shardMaterial: mat,
    };
  }

  const targetMesh =
    primaryMesh ?? (group ? findClosestMeshInGroup(group, hit.point) : null);

  if (!targetMesh) {
    return { shattered: false, nextHp, bodyPos };
  }

  const local = computeLocalDecalTransform(targetMesh, hit.point, hit.normal);
  targetMesh.getWorldScale(_worldScale);
  const avgWorldScale = Math.max(
    1e-4,
    (Math.abs(_worldScale.x) + Math.abs(_worldScale.y) + Math.abs(_worldScale.z)) / 3
  );

  return {
    shattered: false,
    nextHp,
    bodyPos,
    newDecal: {
      id: nextDecalId,
      position: local.position,
      rotation: local.rotation,
      scale: 0.045 / avgWorldScale,
    },
    newDecalMesh: primaryMesh ? undefined : targetMesh,
  };
}

/**
 * Formats a runtime telemetry snapshot for a DestructibleTarget.
 */
export function buildTargetSnapshot(
  spec: DestructibleTargetSpec,
  assets: TargetAssetsState,
  rb: RapierRigidBody | null,
  hp: number,
  alive: boolean,
  decalCount: number,
  shardCount: number,
  lastPosition?: [number, number, number]
): DestructibleTargetSnapshot {
  let t: { x: number; y: number; z: number } | null = null;
  let v: { x: number; y: number; z: number } | null = null;
  if (alive && rb) {
    try {
      t = rb.translation();
      v = rb.linvel();
    } catch {
      t = null;
      v = null;
    }
  }
  const fallbackPos = lastPosition ?? spec.position;
  return {
    id: spec.id,
    kind: spec.kind,
    lodMode: spec.canLodMode,
    activeLod: assets.effectiveLod,
    triCount: assets.triCount,
    labelId: spec.labelId,
    customLabelLoaded: assets.customLabelLoaded,
    materialTransparent: spec.kind === 'glass-bottle',
    opacity: spec.kind === 'glass-bottle' ? 0.42 : 1.0,
    hp,
    maxHp: spec.maxHp,
    alive,
    decalCount: alive ? decalCount : 0,
    activeShardCount: alive ? 0 : shardCount,
    position: t ? [t.x, t.y, t.z] : [...fallbackPos],
    linearVelocity: v ? [v.x, v.y, v.z] : [0, 0, 0],
  };
}

export function attachDecalMeshRef(
  map: Map<string, RefObject<THREE.Mesh>>,
  decalId: string,
  mesh?: THREE.Mesh
): void {
  if (mesh) {
    map.set(decalId, { current: mesh });
  }
}

export function appendDecalBounded(
  prev: ReadonlyArray<DecalRecord>,
  nextDecal: DecalRecord,
  meshRefs: Map<string, RefObject<THREE.Mesh>>,
  nextMesh?: THREE.Mesh,
  maxDecals = 16
): DecalRecord[] {
  const combined = [...prev, nextDecal];
  const evict = Math.max(0, combined.length - maxDecals);
  for (let i = 0; i < evict; i++) {
    meshRefs.delete(combined[i].id);
  }
  attachDecalMeshRef(meshRefs, nextDecal.id, nextMesh);
  return evict > 0 ? combined.slice(evict) : combined;
}

export function tagImportedMeshes(
  root: THREE.Object3D | null,
  targetId: string,
  applyHit: (hit: BallisticHitEvent) => void
): void {
  root?.traverse((obj) => {
    if (obj instanceof THREE.Mesh && !obj.userData.isDecal) {
      obj.userData.targetId = targetId;
      obj.userData.destructibleTarget = true;
      obj.userData.isDestructibleTarget = true;
      obj.userData.applyHit = applyHit;
    }
  });
}

export function readTargetWorldPos(
  rb: RapierRigidBody | null,
  group: THREE.Group | null,
  out: THREE.Vector3
): boolean {
  if (rb) {
    try {
      const t = rb.translation();
      out.set(t.x, t.y, t.z);
      return true;
    } catch {
      /* fall through to group */
    }
  }
  if (group) {
    group.getWorldPosition(out);
    return true;
  }
  return false;
}
