import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { loadWeaponRig } from '../npc/weaponLoader';
import type {
  FingerPoseTag,
  LoadedWeaponRig,
  WeaponArchetypeId,
} from '../types/posing';
import { WEAPON_SPECS } from './ballistics';
import { FpsHands } from './FpsHands';
import { setTelemetryWeaponAnchors } from './rangeTelemetry';

export interface WeaponRigProps {
  archetype: WeaponArchetypeId;
  poseTag: FingerPoseTag;
  poseWeight: number;
  fireSeq: number;
  active?: boolean;
  onWeaponLoaded?: (rig: LoadedWeaponRig | null) => void;
}

const NO_RAYCAST = () => null;

export function WeaponRig({
  archetype,
  poseTag,
  poseWeight,
  fireSeq,
  active = true,
  onWeaponLoaded,
}: WeaponRigProps) {
  const [rig, setRig] = useState<LoadedWeaponRig | null>(null);
  const recoilGroupRef = useRef<THREE.Group | null>(null);
  const muzzleFlashRef = useRef<THREE.Mesh | null>(null);
  const recoilRef = useRef(0);
  const flashTimerRef = useRef(0);
  const lastFireSeqRef = useRef(fireSeq);
  const onLoadedRef = useRef(onWeaponLoaded);
  onLoadedRef.current = onWeaponLoaded;

  useEffect(() => {
    let cancelled = false;
    loadWeaponRig(archetype)
      .then((loaded) => {
        if (cancelled) return;
        loaded.root.traverse((obj) => {
          obj.userData.isWeaponAttachment = true;
          obj.frustumCulled = false;
          if ((obj as THREE.Mesh).isMesh) {
            (obj as THREE.Mesh).raycast = NO_RAYCAST;
          }
        });
        setRig(loaded);
        setTelemetryWeaponAnchors(Object.keys(loaded.anchors));
        onLoadedRef.current?.(loaded);
      })
      .catch(() => {
        if (!cancelled) {
          setRig(null);
          onLoadedRef.current?.(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [archetype]);

  useEffect(() => {
    if (active && rig) {
      setTelemetryWeaponAnchors(Object.keys(rig.anchors));
    }
  }, [active, rig]);

  useEffect(() => {
    if (fireSeq === lastFireSeqRef.current) return;
    lastFireSeqRef.current = fireSeq;
    recoilRef.current = 1;
    flashTimerRef.current = 0.042;
  }, [fireSeq]);

  useFrame((_, delta) => {
    if (!active) return;
    const dt = Math.min(Math.max(delta, 0), 0.05);
    const kick = WEAPON_SPECS[archetype].recoilKick;
    recoilRef.current = Math.max(0, recoilRef.current - dt * 9.5);
    if (recoilGroupRef.current) {
      recoilGroupRef.current.position.z = recoilRef.current * kick;
      recoilGroupRef.current.position.y = recoilRef.current * kick * 0.25;
      recoilGroupRef.current.rotation.x = recoilRef.current * kick * 2.2;
    }

    if (muzzleFlashRef.current) {
      flashTimerRef.current = Math.max(0, flashTimerRef.current - dt);
      muzzleFlashRef.current.visible = flashTimerRef.current > 0;
      if (muzzleFlashRef.current.visible) {
        muzzleFlashRef.current.rotation.z += dt * 40;
      }
    }
  });

  const viewOffset = WEAPON_SPECS[archetype].viewOffset;
  const muzzlePos = rig?.anchors.Socket_Muzzle?.position;
  const flashPos: [number, number, number] = muzzlePos
    ? [muzzlePos.x, muzzlePos.y, muzzlePos.z + 0.04]
    : [0, 0.04, 0.32];

  return (
    <group position={viewOffset} userData={{ isWeaponAttachment: true }}>
      <group ref={recoilGroupRef} userData={{ isWeaponAttachment: true }}>
        {/* Rotate weapon Y by Math.PI so +Z weapon forward aligns with -Z camera forward */}
        <group
          rotation={[0, Math.PI, 0]}
          userData={{ isWeaponAttachment: true }}
        >
          {rig ? <primitive object={rig.root} /> : null}
          <FpsHands
            anchors={rig?.anchors ?? {}}
            poseTag={poseTag}
            poseWeight={poseWeight}
            hasForend={Boolean(rig?.forendPoseTag)}
          />
          <mesh
            ref={muzzleFlashRef}
            position={flashPos}
            visible={false}
            raycast={NO_RAYCAST}
            frustumCulled={false}
            userData={{ isWeaponAttachment: true }}
          >
            <octahedronGeometry args={[0.045, 0]} />
            <meshBasicMaterial color="#fde047" />
          </mesh>
        </group>
      </group>
    </group>
  );
}
