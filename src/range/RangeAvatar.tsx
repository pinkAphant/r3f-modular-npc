import type { EcctrlAnimationState } from '@pinkaphant/ecctrl/animation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type * as THREE from 'three';
import {
  RiggedGlbNpc,
  type RiggedNpcInfo,
  type RiggedNpcTelemetry,
} from '../npc/RiggedGlbNpc';
import type { CharacterId } from '../npc/NpcViewport';
import type { FingerPoseTag, WeaponArchetypeId } from '../types/posing';
import type { CameraPerspective } from '../types/range';
import { setHudPoseTag } from '../hud/hudSignals';
import {
  setTelemetryHero,
  setTelemetryRigFrame,
  type TelemetryHeroVariant,
} from './rangeTelemetry';

const HERO_URLS: Record<Exclude<CharacterId, 'custom'>, string> = {
  hero: '/assets/npc_hero_uploaded.glb',
  male: '/assets/npc_psx_m.glb',
  female: '/assets/npc_psx_f.glb',
};

export function resolveRangeClipForState(
  animState: EcctrlAnimationState,
  clips: string[],
  weapon: WeaponArchetypeId
): string | null {
  if (clips.length === 0) return null;
  const pick = (candidates: string[]) =>
    candidates.find((name) => clips.includes(name)) ?? null;

  if (animState === 'WALK') {
    return pick(['walk', 'walk.001', 'run', 'run.001']) ?? clips[0];
  }
  if (animState === 'RUN') {
    return pick(['run', 'run.001', 'walk', 'walk.001']) ?? clips[0];
  }
  if (animState.startsWith('JUMP') && animState !== 'JUMP_LAND') {
    return pick(['jump', 'fall.001', 'jump.001', 'run.001']) ?? clips[0];
  }
  if (weapon === 'pistol') {
    return (
      pick([
        'idle',
        'idle.001',
        'aiming a one handed gangstar pistol.001',
        'aiming a shotgun.001',
      ]) ?? clips[0]
    );
  }
  return (
    pick([
      'idle',
      'idle.001',
      'aiming a shotgun.001',
      'aiming a one handed gangstar pistol.001',
    ]) ?? clips[0]
  );
}

export interface RangeAvatarProps {
  active?: boolean;
  perspective?: CameraPerspective;
  character: CharacterId;
  customGlbUrl: string | null;
  customAlbedoUrl: string | null;
  animState: EcctrlAnimationState;
  weaponArchetype: WeaponArchetypeId;
  poseTag: FingerPoseTag;
  poseWeight: number;
  wiggleEnabled: boolean;
  wiggleIntensity: number;
  onLoaded?: (info: RiggedNpcInfo) => void;
}

export function RangeAvatar({
  active = true,
  perspective = 'first',
  character,
  customGlbUrl,
  customAlbedoUrl,
  animState,
  weaponArchetype,
  poseTag,
  poseWeight,
  wiggleEnabled,
  wiggleIntensity,
  onLoaded,
}: RangeAvatarProps) {
  const rootRef = useRef<THREE.Group | null>(null);
  const [clips, setClips] = useState<string[]>([]);
  const [boneCount, setBoneCount] = useState(0);
  const [loadedTick, setLoadedTick] = useState(0);
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;
  const activeRef = useRef(active);
  activeRef.current = active;
  const pendingInfoRef = useRef<RiggedNpcInfo | null>(null);
  const initialLoadedRef = useRef(false);

  const url =
    character === 'custom' && customGlbUrl
      ? customGlbUrl
      : HERO_URLS[character === 'custom' ? 'hero' : character];

  const heroVariant: TelemetryHeroVariant =
    character === 'male'
      ? 'male'
      : character === 'female'
      ? 'female'
      : 'custom';

  const activeClip = resolveRangeClipForState(animState, clips, weaponArchetype);

  useEffect(() => {
    rootRef.current?.traverse((obj) => {
      obj.userData.isPlayerAvatar = true;
    });
  }, [loadedTick, weaponArchetype]);

  useEffect(() => {
    if (active && boneCount > 0) {
      setTelemetryHero(heroVariant, boneCount, activeClip);
    }
  }, [active, heroVariant, boneCount, activeClip]);

  const handleLoaded = useCallback((info: RiggedNpcInfo) => {
    setClips(info.animations);
    setBoneCount(info.boneCount);
    setLoadedTick((t) => t + 1);
    rootRef.current?.traverse((obj) => {
      const m = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m?.isMeshStandardMaterial && (m.normalMap || m.roughnessMap || m.metalnessMap)) {
        m.normalMap = null;
        m.roughnessMap = null;
        m.metalnessMap = null;
        m.needsUpdate = true;
      }
    });
    pendingInfoRef.current = info;
    if (initialLoadedRef.current) onLoadedRef.current?.(info);
  }, []);

  const handleWeaponLoaded = useCallback(() => {
    rootRef.current?.traverse((obj) => {
      obj.userData.isPlayerAvatar = true;
    });
    if (!initialLoadedRef.current && pendingInfoRef.current) {
      initialLoadedRef.current = true;
      onLoadedRef.current?.(pendingInfoRef.current);
    }
  }, []);

  const handleTelemetry = useCallback((t: RiggedNpcTelemetry) => {
    if (!activeRef.current) return;
    setHudPoseTag(t.poseTag);
    setTelemetryRigFrame(t.ikAnchorsFound, t.fingerEulerRad, t.wiggle, t.poseTag);
  }, []);

  return (
    <group ref={rootRef} userData={{ isPlayerAvatar: true }}>
      <RiggedGlbNpc
        url={url}
        activeAnim={activeClip}
        wireframe={false}
        showSockets={false}
        customAlbedoUrl={customAlbedoUrl}
        onLoaded={handleLoaded}
        targetHeightM={1.75}
        poseTag={poseTag}
        poseWeight={poseWeight}
        wiggleEnabled={wiggleEnabled}
        wiggleIntensity={wiggleIntensity}
        weaponArchetype={weaponArchetype}
        mountWeaponMesh={true}
        crossfadeSec={0.08}
        paused={!active}
        onWeaponLoaded={handleWeaponLoaded}
        onTelemetryUpdate={handleTelemetry}
      />
    </group>
  );
}
