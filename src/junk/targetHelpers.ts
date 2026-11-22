import * as THREE from 'three';
import type {
  CanLodMode,
  JunkKind,
  ProceduralLabelId,
  ShardSpec,
} from '../types/junk';
import type { BallisticHitEvent } from '../types/range';
import { splitObjectIntoShards } from './bvhShatter';
import { createGlassBottleMaterial, type ResolvedCanLod } from './junkGeometry';

export const SHARD_COLLIDER_INSET = 0.65;

export function getTargetDensity(kind: JunkKind): number {
  if (kind === 'glass-bottle') return 1200;
  if (kind === 'imported-glb') return 800;
  return 220;
}

export interface SpawnedShardState {
  spec: ShardSpec;
  worldPos: [number, number, number];
  worldQuat: [number, number, number, number];
  impulse: [number, number, number];
  torque: [number, number, number];
  linvel: [number, number, number];
  angvel: [number, number, number];
  density: number;
}

export interface DestructibleTargetSnapshot {
  id: string;
  kind: JunkKind;
  lodMode: CanLodMode;
  activeLod: ResolvedCanLod;
  triCount: number;
  labelId: ProceduralLabelId;
  customLabelLoaded: boolean;
  materialTransparent: boolean;
  opacity: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  decalCount: number;
  activeShardCount: number;
  position: [number, number, number];
  linearVelocity: [number, number, number];
}

const _pt = new THREE.Vector3();
const _norm = new THREE.Vector3();
const _zAxis = new THREE.Vector3(0, 0, 1);
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _invWorld = new THREE.Matrix4();
const _normMat = new THREE.Matrix3();
const _box = new THREE.Box3();

/**
 * Computes target-mesh local-space position & Euler XYZ rotation for a <Decal>.
 */
export function computeLocalDecalTransform(
  mesh: THREE.Mesh,
  worldPoint: [number, number, number],
  worldNormal: [number, number, number]
): {
  position: [number, number, number];
  rotation: [number, number, number];
} {
  mesh.updateMatrixWorld(true);
  _pt.set(worldPoint[0], worldPoint[1], worldPoint[2]);
  mesh.worldToLocal(_pt);

  _invWorld.copy(mesh.matrixWorld).invert();
  _normMat.getNormalMatrix(_invWorld);
  _norm
    .set(worldNormal[0], worldNormal[1], worldNormal[2])
    .applyMatrix3(_normMat);
  if (_norm.lengthSq() > 1e-8) _norm.normalize();
  else _norm.set(0, 0, 1);

  _quat.setFromUnitVectors(_zAxis, _norm);
  _euler.setFromQuaternion(_quat, 'XYZ');

  return {
    position: [_pt.x, _pt.y, _pt.z],
    rotation: [_euler.x, _euler.y, _euler.z],
  };
}

/**
 * Finds the nearest non-decal Mesh inside an Object3D to a world-space hit point.
 */
export function findClosestMeshInGroup(
  root: THREE.Object3D,
  worldPoint: [number, number, number]
): THREE.Mesh | null {
  _pt.set(worldPoint[0], worldPoint[1], worldPoint[2]);
  let bestMesh: THREE.Mesh | null = null;
  let bestDist = Infinity;

  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    if (obj.userData.isDecal || obj.userData.isGizmo) return;
    _box.setFromObject(obj);
    const d = _box.distanceToPoint(_pt);
    if (d < bestDist) {
      bestDist = d;
      bestMesh = obj;
    }
  });
  return bestMesh;
}

/**
 * Splits a target Object3D into BVH shards and computes world poses + impulses.
 */
export function buildShardStates(
  rootObj: THREE.Object3D,
  targetPieces: number,
  worldPos: THREE.Vector3,
  worldQuat: THREE.Quaternion,
  hit: BallisticHitEvent,
  kind: JunkKind = 'tin-can'
): { states: SpawnedShardState[]; specs: ShardSpec[] } {
  const specs = splitObjectIntoShards(rootObj, targetPieces);
  const density = getTargetDensity(kind);
  const hitImp = new THREE.Vector3(...hit.impulse);
  const hitFactor = Math.min(1.5, Math.max(0.75, 0.75 + hitImp.length() * 0.12));
  const hitDir =
    hitImp.lengthSq() > 1e-6
      ? hitImp.clone().normalize()
      : new THREE.Vector3(0, 0.25, -1).normalize();

  const states: SpawnedShardState[] = specs.map((spec, idx) => {
    const localOffset = new THREE.Vector3(...spec.centroid);
    const worldOffset = localOffset.clone().applyQuaternion(worldQuat);
    const radial =
      worldOffset.lengthSq() > 1e-6
        ? worldOffset.clone().normalize()
        : new THREE.Vector3((idx % 3) - 1, 0.5, ((idx + 1) % 3) - 1).normalize();
    const pos = worldPos.clone().add(worldOffset).addScaledVector(radial, 0.008);

    const cx = Math.max(0.01, spec.halfExtents[0] * SHARD_COLLIDER_INSET);
    const cy = Math.max(0.01, spec.halfExtents[1] * SHARD_COLLIDER_INSET);
    const cz = Math.max(0.01, spec.halfExtents[2] * SHARD_COLLIDER_INSET);
    const estMass = Math.max(0.008, 8 * cx * cy * cz * density);

    const desiredVel = radial
      .clone()
      .multiplyScalar(1.25 * hitFactor)
      .addScaledVector(hitDir, 0.85 * hitFactor);
    desiredVel.y += 0.8 * hitFactor;
    const impulseVec = desiredVel.clone().multiplyScalar(estMass);

    const sign = idx % 2 === 0 ? 1 : -1;
    const desiredAng = new THREE.Vector3(
      sign * (0.6 + radial.z * 0.4),
      sign * (0.7 + radial.x * 0.4),
      -sign * (0.5 + radial.y * 0.4)
    ).multiplyScalar(7.5);
    const inertiaEst = Math.max(1e-5, estMass * (cx * cx + cy * cy + cz * cz) * 0.35);
    const torqueVec = desiredAng.clone().multiplyScalar(inertiaEst);

    return {
      spec,
      worldPos: [pos.x, pos.y, pos.z],
      worldQuat: [worldQuat.x, worldQuat.y, worldQuat.z, worldQuat.w],
      impulse: [impulseVec.x, impulseVec.y, impulseVec.z],
      torque: [torqueVec.x, torqueVec.y, torqueVec.z],
      linvel: [desiredVel.x, desiredVel.y, desiredVel.z],
      angvel: [desiredAng.x, desiredAng.y, desiredAng.z],
      density,
    };
  });

  return { states, specs };
}

/**
 * Creates a DoubleSide material for tumbling shatter shards matching target kind.
 */
export function createShardMaterial(
  kind: JunkKind,
  labelTexture: THREE.Texture | null,
  importedRoot?: THREE.Object3D | null
): THREE.Material {
  if (kind === 'glass-bottle') {
    return createGlassBottleMaterial();
  }
  if (kind === 'tin-can') {
    return new THREE.MeshStandardMaterial({
      color: labelTexture ? '#e2e8f0' : '#94a3b8',
      map: labelTexture ?? null,
      roughness: 0.45,
      metalness: 0.35,
      side: THREE.DoubleSide,
    });
  }

  let sampleMat: THREE.Material | null = null;
  importedRoot?.traverse((obj) => {
    if (sampleMat || !(obj instanceof THREE.Mesh)) return;
    if (obj.userData.isDecal || obj.userData.isGizmo) return;
    sampleMat = Array.isArray(obj.material)
      ? obj.material[0] ?? null
      : obj.material ?? null;
  });

  if (sampleMat) {
    const cloned = (sampleMat as THREE.Material).clone();
    cloned.side = THREE.DoubleSide;
    return cloned;
  }

  return new THREE.MeshStandardMaterial({
    color: '#cbd5e1',
    roughness: 0.6,
    metalness: 0.2,
    side: THREE.DoubleSide,
  });
}
