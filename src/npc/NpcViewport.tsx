import { Grid, OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useCallback, useLayoutEffect } from 'react';
import * as THREE from 'three';
import type { FingerPoseTag, WeaponArchetypeId } from '../types/posing';
import {
  RiggedGlbNpc,
  type RiggedNpcInfo,
  type RiggedNpcTelemetry,
} from './RiggedGlbNpc';
import { setHudPoseTag } from '../hud/hudSignals';
import { setTelemetryRigFrame } from '../range/rangeTelemetry';
import {
  updateViewerTelemetry,
  useViewerState,
} from './viewerState';

export type CharacterId = 'hero' | 'male' | 'female' | 'custom';

export interface NpcViewportProps {
  character: CharacterId;
  customGlbUrl: string | null;
  activeAnim: string | null;
  wireframe: boolean;
  showSockets: boolean;
  customAlbedoUrl: string | null;
  onLoaded: (info: RiggedNpcInfo) => void;
  poseTag?: FingerPoseTag;
  poseWeight?: number;
  wiggleEnabled?: boolean;
  wiggleIntensity?: number;
  weaponArchetype?: 'none' | WeaponArchetypeId;
}

export type NpcViewerContentProps = NpcViewportProps;

const CHARACTER_URLS: Record<Exclude<CharacterId, 'custom'>, string> = {
  hero: '/assets/npc_hero_uploaded.glb',
  male: '/assets/npc_psx_m.glb',
  female: '/assets/npc_psx_f.glb',
};

export function NpcViewerContent({
  character,
  customGlbUrl,
  activeAnim,
  wireframe,
  showSockets,
  customAlbedoUrl,
  onLoaded,
  poseTag,
  poseWeight,
  wiggleEnabled,
  wiggleIntensity,
  weaponArchetype,
}: NpcViewerContentProps) {
  const viewer = useViewerState();
  const { camera } = useThree();

  useLayoutEffect(() => {
    const persp = camera as THREE.PerspectiveCamera;
    if (persp.isPerspectiveCamera) {
      persp.fov = 40;
      persp.near = 0.1;
      persp.far = 1000;
      persp.updateProjectionMatrix();
    }
    camera.position.set(0, 1.3, 2.9);
    camera.lookAt(0, 0.95, 0);
    camera.updateMatrixWorld();
  }, [camera]);

  const url =
    character === 'custom' && customGlbUrl
      ? customGlbUrl
      : character === 'hero'
      ? CHARACTER_URLS.hero
      : CHARACTER_URLS[character === 'female' ? 'female' : 'male'];

  const handleLoaded = useCallback(
    (info: RiggedNpcInfo) => {
      updateViewerTelemetry({ boneCount: info.boneCount });
      onLoaded(info);
    },
    [onLoaded]
  );

  const handleTelemetry = useCallback((t: RiggedNpcTelemetry) => {
    setHudPoseTag(t.poseTag);
    updateViewerTelemetry(t);
    setTelemetryRigFrame(t.ikAnchorsFound, t.fingerEulerRad, t.wiggle, t.poseTag);
  }, []);

  return (
    <>
      <color attach="background" args={['#09090b']} />
      <ambientLight intensity={0.85} />
      <directionalLight
        position={[2.5, 4.5, 3]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.002}
        shadow-normalBias={0.03}
      />
      <directionalLight position={[-2.5, 2.0, -2]} intensity={0.5} />

      <Grid
        args={[8, 8]}
        cellSize={0.25}
        cellThickness={0.5}
        cellColor="#27272a"
        sectionSize={1}
        sectionThickness={1}
        sectionColor="#3f3f46"
        fadeDistance={10}
      />

      <RiggedGlbNpc
        url={url}
        activeAnim={activeAnim}
        wireframe={wireframe}
        showSockets={showSockets}
        customAlbedoUrl={customAlbedoUrl}
        onLoaded={handleLoaded}
        poseTag={poseTag ?? viewer.poseTag}
        poseWeight={poseWeight ?? viewer.poseWeight}
        wiggleEnabled={wiggleEnabled ?? viewer.wiggleEnabled}
        wiggleIntensity={wiggleIntensity ?? viewer.wiggleIntensity}
        weaponArchetype={weaponArchetype ?? viewer.weaponArchetype}
        onTelemetryUpdate={handleTelemetry}
      />

      <OrbitControls target={[0, 0.95, 0]} makeDefault />
    </>
  );
}

export function NpcViewport(props: NpcViewportProps) {
  return (
    <Canvas
      camera={{ position: [0, 1.3, 2.9], fov: 40 }}
      shadows
      className="h-full w-full"
    >
      <NpcViewerContent {...props} />
    </Canvas>
  );
}
