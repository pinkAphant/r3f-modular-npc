import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { FINGER_NAMES, FINGER_POSE_PRESETS } from '../npc/fingerPoseSchema';
import type {
  FingerName,
  FingerPoseTag,
  HandPoseSpec,
  IkAnchorId,
} from '../types/posing';

export interface FpsHandsProps {
  anchors: Partial<Record<IkAnchorId, THREE.Object3D>>;
  poseTag: FingerPoseTag;
  poseWeight: number;
  hasForend: boolean;
}

const NO_RAYCAST = () => null;
const HAND_USER_DATA = { isWeaponAttachment: true };

const FINGER_X_OFFSETS: Record<FingerName, number> = {
  Thumb: -0.022,
  Index: -0.013,
  Middle: -0.004,
  Ring: 0.005,
  Pinky: 0.014,
};

const PHALANX_LEN = [0.022, 0.018, 0.014] as const;

interface HandVisualProps {
  side: 'left' | 'right';
  position: [number, number, number];
  rotation: [number, number, number];
  poseTag: FingerPoseTag;
  poseWeight: number;
}

function ArticulatedHand({
  side,
  position,
  rotation,
  poseTag,
  poseWeight,
}: HandVisualProps) {
  const jointRefs = useRef<Record<string, THREE.Group | null>>({});

  useFrame((_, delta) => {
    const dt = Math.min(Math.max(delta, 0), 0.05);
    const alpha = dt > 0 ? 1 - Math.exp(-18 * dt) : 1;
    const preset = FINGER_POSE_PRESETS[poseTag] ?? FINGER_POSE_PRESETS.relaxed;
    const handSpec: HandPoseSpec | undefined =
      side === 'right' ? preset.rightHand : preset.leftHand;

    for (const finger of FINGER_NAMES) {
      const digit = handSpec?.[finger];
      for (let p = 0; p < 3; p++) {
        const g = jointRefs.current[`${finger}_${p}`];
        if (!g) continue;
        const targetCurl = digit ? digit.curl[p] * poseWeight : 0.25;
        const targetSpread =
          p === 0 && digit
            ? digit.spread * poseWeight * (side === 'right' ? 1 : -1)
            : 0;
        g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, targetCurl, alpha);
        g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, targetSpread, alpha);
      }
    }
  });

  const sign = side === 'right' ? 1 : -1;

  return (
    <group position={position} rotation={rotation} userData={HAND_USER_DATA}>
      {/* Forearm sleeve */}
      <mesh
        position={[0, -0.025, -0.14]}
        rotation={[Math.PI * 0.45, 0, 0]}
        raycast={NO_RAYCAST}
        frustumCulled={false}
        userData={HAND_USER_DATA}
      >
        <boxGeometry args={[0.052, 0.22, 0.048]} />
        <meshStandardMaterial color="#334155" roughness={0.85} />
      </mesh>
      {/* Tactical glove palm */}
      <mesh
        position={[0, 0, -0.015]}
        raycast={NO_RAYCAST}
        frustumCulled={false}
        userData={HAND_USER_DATA}
      >
        <boxGeometry args={[0.048, 0.024, 0.058]} />
        <meshStandardMaterial color="#27272a" roughness={0.75} />
      </mesh>
      {/* 5 Articulated Digits (3 phalanges each) */}
      {FINGER_NAMES.map((finger) => {
        const baseX = FINGER_X_OFFSETS[finger] * sign;
        const baseZ = finger === 'Thumb' ? -0.004 : 0.016;
        const baseY = finger === 'Thumb' ? -0.004 : 0.004;
        const scale = finger === 'Pinky' ? 0.82 : finger === 'Thumb' ? 0.9 : 1;
        return (
          <group
            key={finger}
            ref={(el) => {
              jointRefs.current[`${finger}_0`] = el;
            }}
            position={[baseX, baseY, baseZ]}
            rotation={[0, finger === 'Thumb' ? -0.45 * sign : 0, 0]}
            userData={HAND_USER_DATA}
          >
            <mesh
              position={[0, 0, PHALANX_LEN[0] * 0.5 * scale]}
              raycast={NO_RAYCAST}
              frustumCulled={false}
              userData={HAND_USER_DATA}
            >
              <boxGeometry args={[0.009, 0.009, PHALANX_LEN[0] * scale]} />
              <meshStandardMaterial color="#d6a582" roughness={0.72} />
            </mesh>
            <group
              ref={(el) => {
                jointRefs.current[`${finger}_1`] = el;
              }}
              position={[0, 0, PHALANX_LEN[0] * scale]}
            >
              <mesh
                position={[0, 0, PHALANX_LEN[1] * 0.5 * scale]}
                raycast={NO_RAYCAST}
                frustumCulled={false}
                userData={HAND_USER_DATA}
              >
                <boxGeometry args={[0.008, 0.008, PHALANX_LEN[1] * scale]} />
                <meshStandardMaterial color="#d6a582" roughness={0.72} />
              </mesh>
              <group
                ref={(el) => {
                  jointRefs.current[`${finger}_2`] = el;
                }}
                position={[0, 0, PHALANX_LEN[1] * scale]}
              >
                <mesh
                  position={[0, 0, PHALANX_LEN[2] * 0.5 * scale]}
                  raycast={NO_RAYCAST}
                  frustumCulled={false}
                  userData={HAND_USER_DATA}
                >
                  <boxGeometry args={[0.007, 0.007, PHALANX_LEN[2] * scale]} />
                  <meshStandardMaterial color="#c99572" roughness={0.72} />
                </mesh>
              </group>
            </group>
          </group>
        );
      })}
    </group>
  );
}

export function FpsHands({
  anchors,
  poseTag,
  poseWeight,
  hasForend,
}: FpsHandsProps) {
  const rightPos = useMemo<[number, number, number]>(() => {
    const p = anchors.IK_Palm_Primary?.position;
    return p ? [p.x - 0.01, p.y - 0.015, p.z - 0.02] : [-0.01, -0.05, -0.04];
  }, [anchors.IK_Palm_Primary]);

  const leftPos = useMemo<[number, number, number]>(() => {
    const f = anchors.IK_Palm_Forend?.position;
    if (f) return [f.x + 0.015, f.y - 0.02, f.z - 0.015];
    return hasForend ? [0.02, -0.03, 0.14] : [0.06, -0.09, -0.02];
  }, [anchors.IK_Palm_Forend, hasForend]);

  return (
    <group userData={HAND_USER_DATA}>
      <ArticulatedHand
        side="right"
        position={rightPos}
        rotation={[0.22, 0, -Math.PI * 0.48]}
        poseTag={poseTag}
        poseWeight={poseWeight}
      />
      <ArticulatedHand
        side="left"
        position={leftPos}
        rotation={[0.15, -0.18, Math.PI * 0.44]}
        poseTag={poseTag}
        poseWeight={poseWeight}
      />
    </group>
  );
}
