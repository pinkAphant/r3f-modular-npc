import { CuboidCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { SHARD_COLLIDER_INSET, type SpawnedShardState } from './targetHelpers';

interface ShardPieceProps {
  item: SpawnedShardState;
  material: THREE.Material;
}

function ShardPiece({ item, material }: ShardPieceProps) {
  const rbRef = useRef<RapierRigidBody | null>(null);

  useEffect(() => {
    const rb = rbRef.current;
    if (!rb) return;
    rb.setLinvel(
      { x: item.linvel[0], y: item.linvel[1], z: item.linvel[2] },
      true
    );
    rb.setAngvel(
      { x: item.angvel[0], y: item.angvel[1], z: item.angvel[2] },
      true
    );
  }, [item]);

  const colliderArgs: [number, number, number] = [
    Math.max(0.01, item.spec.halfExtents[0] * SHARD_COLLIDER_INSET),
    Math.max(0.01, item.spec.halfExtents[1] * SHARD_COLLIDER_INSET),
    Math.max(0.01, item.spec.halfExtents[2] * SHARD_COLLIDER_INSET),
  ];

  return (
    <RigidBody
      ref={rbRef}
      type="dynamic"
      colliders={false}
      position={item.worldPos}
      quaternion={item.worldQuat}
      restitution={0.18}
      friction={0.8}
      linearDamping={0.45}
      angularDamping={0.45}
    >
      <CuboidCollider args={colliderArgs} density={item.density} />
      <mesh
        geometry={item.spec.geometry}
        material={material}
        castShadow
        receiveShadow
      />
    </RigidBody>
  );
}

export interface ShardPiecesProps {
  shards: ReadonlyArray<SpawnedShardState>;
  material: THREE.Material | null;
}

/**
 * Renders independent dynamic Rapier RigidBodies for BVH shatter fragments.
 */
export function ShardPieces({ shards, material }: ShardPiecesProps) {
  useEffect(() => {
    return () => {
      for (const s of shards) {
        s.spec.geometry.dispose();
      }
    };
  }, [shards]);

  useEffect(() => {
    return () => {
      material?.dispose();
    };
  }, [material]);

  if (!material || shards.length === 0) return null;

  return (
    <group>
      {shards.map((item) => (
        <ShardPiece key={item.spec.id} item={item} material={material} />
      ))}
    </group>
  );
}
