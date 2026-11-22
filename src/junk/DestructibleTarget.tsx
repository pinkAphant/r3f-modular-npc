import { useFrame } from '@react-three/fiber';
import { CuboidCollider, CylinderCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import {
  forwardRef, type RefObject, useCallback, useEffect,
  useImperativeHandle, useMemo, useRef, useState,
} from 'react';
import * as THREE from 'three';
import type { DecalRecord, DestructibleTargetSpec, ShardSpec } from '../types/junk';
import type { BallisticHitEvent } from '../types/range';
import { BOTTLE_HEIGHT, selectCanLod, TIN_CAN_HEIGHT, TIN_CAN_RADIUS } from './junkGeometry';
import type { ImportedGlbAsset } from './junkImporter';
import { ShardPieces } from './ShardPieces';
import { TargetDecals } from './TargetDecals';
import type { DestructibleTargetSnapshot, SpawnedShardState } from './targetHelpers';
import {
  appendDecalBounded, buildTargetSnapshot, executeTargetHit,
  readTargetWorldPos, tagImportedMeshes,
} from './targetHitLogic';
import { useTargetAssets } from './useTargetAssets';

export interface DestructibleTargetHandle {
  applyHit: (hit: BallisticHitEvent) => void;
  getSnapshot: () => DestructibleTargetSnapshot;
}

export interface DestructibleTargetProps {
  spec: DestructibleTargetSpec;
  active?: boolean;
  importedAsset?: ImportedGlbAsset | null;
  onHit?: (targetId: string, event: BallisticHitEvent, nextHp: number, decals: DecalRecord[]) => void;
  onShatter?: (targetId: string, shards: ShardSpec[], event: BallisticHitEvent) => void;
  onStateChange?: (snapshot: DestructibleTargetSnapshot) => void;
  registerTarget?: (id: string, handle: DestructibleTargetHandle | null) => void;
}

const _camPos = new THREE.Vector3();

export const DestructibleTarget = forwardRef<
  DestructibleTargetHandle,
  DestructibleTargetProps
>(function DestructibleTarget(
  { spec, active = true, importedAsset, onHit, onShatter, onStateChange, registerTarget },
  ref
) {
  const rbRef = useRef<RapierRigidBody | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const primaryMeshRef = useRef<THREE.Mesh | null>(null);
  const decalMeshRefs = useRef(new Map<string, RefObject<THREE.Mesh>>());

  const [alive, setAlive] = useState(true);
  const [hp, setHp] = useState(spec.hp);
  const [decals, setDecals] = useState<DecalRecord[]>([]);
  const [shards, setShards] = useState<SpawnedShardState[]>([]);
  const [shardMaterial, setShardMaterial] = useState<THREE.Material | null>(null);

  const aliveRef = useRef(true);
  const hpRef = useRef(spec.hp);
  const hitSeqRef = useRef(0);
  const decalsRef = useRef<DecalRecord[]>([]);
  const shardsRef = useRef<SpawnedShardState[]>([]);
  const lastPosRef = useRef<[number, number, number]>([...spec.position]);
  const assets = useTargetAssets(spec, importedAsset);

  const specRef = useRef(spec);
  specRef.current = spec;
  const assetsRef = useRef(assets);
  assetsRef.current = assets;
  const cbRef = useRef({ onHit, onShatter, onStateChange, registerTarget });
  cbRef.current = { onHit, onShatter, onStateChange, registerTarget };

  const getSnapshot = useCallback(
    () =>
      buildTargetSnapshot(
        specRef.current,
        assetsRef.current,
        rbRef.current,
        hpRef.current,
        aliveRef.current,
        decalsRef.current.length,
        shardsRef.current.length,
        lastPosRef.current
      ),
    []
  );

  const applyHit = useCallback((hit: BallisticHitEvent) => {
    if (!aliveRef.current) return;
    const curSpec = specRef.current;
    const res = executeTargetHit(
      curSpec,
      assetsRef.current,
      rbRef.current,
      groupRef.current,
      primaryMeshRef.current,
      hpRef.current,
      `${curSpec.id}-d-${++hitSeqRef.current}`,
      hit
    );

    if (res.shattered && res.shardStates && res.shardMaterial) {
      if (res.shatterPos) lastPosRef.current = res.shatterPos;
      rbRef.current = null;
      aliveRef.current = false;
      hpRef.current = 0;
      decalsRef.current = [];
      shardsRef.current = res.shardStates;
      decalMeshRefs.current.clear();
      setHp(0);
      setDecals([]);
      setShardMaterial(res.shardMaterial);
      setShards(res.shardStates);
      setAlive(false);
      cbRef.current.onShatter?.(curSpec.id, res.shardSpecs ?? [], hit);
      return;
    }

    if (res.bodyPos) lastPosRef.current = res.bodyPos;
    hpRef.current = res.nextHp;
    setHp(res.nextHp);
    if (res.newDecal) {
      const nextDecals = appendDecalBounded(
        decalsRef.current, res.newDecal, decalMeshRefs.current, res.newDecalMesh
      );
      decalsRef.current = nextDecals;
      setDecals(nextDecals);
      cbRef.current.onHit?.(curSpec.id, hit, res.nextHp, nextDecals);
    } else {
      cbRef.current.onHit?.(curSpec.id, hit, res.nextHp, decalsRef.current);
    }
  }, []);

  const handleObj = useMemo<DestructibleTargetHandle>(
    () => ({ applyHit, getSnapshot }),
    [applyHit, getSnapshot]
  );

  useImperativeHandle(ref, () => handleObj, [handleObj]);

  useEffect(() => {
    cbRef.current.registerTarget?.(spec.id, handleObj);
    const rbAny = rbRef.current as (RapierRigidBody & {
      recomputeMassPropertiesFromColliders?: () => void;
    }) | null;
    rbAny?.recomputeMassPropertiesFromColliders?.();
    return () => cbRef.current.registerTarget?.(spec.id, null);
  }, [spec.id, handleObj]);

  useEffect(() => {
    cbRef.current.onStateChange?.(getSnapshot());
  }, [
    getSnapshot, alive, hp, decals.length, shards.length,
    assets.effectiveLod, assets.triCount, assets.customLabelLoaded,
  ]);

  useEffect(() => {
    tagImportedMeshes(assets.importedRoot, spec.id, applyHit);
  }, [assets.importedRoot, spec.id, applyHit]);

  useFrame(({ camera }) => {
    if (!active || !aliveRef.current || spec.kind !== 'tin-can' || spec.canLodMode !== 'auto') return;
    if (!readTargetWorldPos(rbRef.current, groupRef.current, _camPos)) return;
    const next = selectCanLod(camera.position.distanceTo(_camPos), 'auto');
    if (next !== assets.effectiveLod) assets.setActiveLod(next);
  });

  if (!alive) {
    return <ShardPieces shards={shards} material={shardMaterial} />;
  }

  const awaitingImported =
    spec.kind === 'imported-glb' && !assets.importedHalfExtents;
  const sharedUserData = {
    targetId: spec.id,
    destructibleTarget: true,
    isDestructibleTarget: true,
    applyHit,
  };

  return (
    <RigidBody
      ref={rbRef}
      type={awaitingImported ? 'fixed' : 'dynamic'}
      colliders={false}
      position={spec.position}
      restitution={0.18}
      friction={0.45}
      linearDamping={1.2}
      angularDamping={8.0}
      userData={sharedUserData}
    >
      {spec.kind === 'tin-can' && (
        <CylinderCollider args={[TIN_CAN_HEIGHT * 0.5, TIN_CAN_RADIUS]} density={180} />
      )}
      {spec.kind === 'glass-bottle' && (
        <CylinderCollider args={[BOTTLE_HEIGHT * 0.5, 0.055]} density={1200} />
      )}
      {spec.kind === 'imported-glb' && (
        <CuboidCollider args={assets.importedHalfExtents ?? [0.2, 0.2, 0.2]} density={800} />
      )}

      <group ref={groupRef} userData={sharedUserData}>
        {spec.kind === 'tin-can' && assets.canMats && (
          <mesh
            ref={primaryMeshRef}
            geometry={
              (assets.effectiveLod === '3-gon' ? assets.can3Geo : assets.can12Geo) ??
              undefined
            }
            material={assets.canMats}
            castShadow
            receiveShadow
            userData={sharedUserData}
          >
            <TargetDecals decals={decals} lodKey={assets.effectiveLod} />
          </mesh>
        )}

        {spec.kind === 'glass-bottle' && assets.bottleGeo && assets.bottleMat && (
          <mesh
            ref={primaryMeshRef}
            geometry={assets.bottleGeo}
            material={assets.bottleMat}
            castShadow
            userData={sharedUserData}
          >
            <TargetDecals decals={decals} lodKey="bottle" />
          </mesh>
        )}

        {spec.kind === 'imported-glb' && assets.importedRoot && (
          <>
            <primitive object={assets.importedRoot} />
            <TargetDecals
              decals={decals}
              lodKey={assets.importedKey}
              meshRefMap={decalMeshRefs.current}
            />
          </>
        )}
      </group>
    </RigidBody>
  );
});
