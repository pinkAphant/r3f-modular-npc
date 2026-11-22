import type { EcctrlHandle } from '@pinkaphant/ecctrl';
import type { EcctrlAnimationState } from '@pinkaphant/ecctrl/animation';
import type { EcctrlCameraControlsHandle } from '@pinkaphant/ecctrl/camera';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type * as THREE from 'three';
import { FpsHud } from '../hud/FpsHud';
import {
  recordHudShot, setHudDreamcastConfig, setHudPerspective, setHudPlayerState, setHudPointerLocked,
} from '../hud/hudSignals';
import { DestructibleTarget } from '../junk/DestructibleTarget';
import type { CharacterId } from '../npc/NpcViewport';
import { DreamcastRenderer } from '../shaders/DreamcastRenderer';
import type { CameraPerspective, DreamcastConfig } from '../types/range';
import { fireCenterReticleRay, WEAPON_SPECS } from './ballistics';
import { RangeArena } from './RangeArena';
import { RangeAvatar } from './RangeAvatar';
import { DEFAULT_SPAWN_POSITION, RangePlayer } from './RangePlayer';
import { RangeWarmupGate } from './rangePostStepSync';
import { setTelemetryMode, setTelemetryReady } from './rangeTelemetry';
import {
  getRangeTargetHandle, notifyRangeTargetHit, notifyRangeTargetSnapshot, registerRangeTargetHandle, useRangeState,
} from './useRangeTargets';
import { WeaponRig } from './WeaponRig';

export interface ShootingRangeSceneProps {
  perspective: CameraPerspective;
  onPerspectiveChange: (next: CameraPerspective) => void;
  dreamcast: DreamcastConfig;
  character: CharacterId;
  customGlbUrl: string | null;
  customAlbedoUrl: string | null;
  debugPhysics?: boolean;
  ecctrlRef?: RefObject<EcctrlHandle | null>;
  cameraControlsRef?: RefObject<EcctrlCameraControlsHandle | null>;
}

export interface ShootingRangeContentProps extends ShootingRangeSceneProps {
  active?: boolean;
}

export function ShootingRangeContent({
  active = true,
  perspective,
  onPerspectiveChange,
  dreamcast,
  character,
  customGlbUrl,
  customAlbedoUrl,
  debugPhysics = false,
  ecctrlRef,
  cameraControlsRef,
}: ShootingRangeContentProps) {
  const range = useRangeState();
  const [animState, setAnimState] = useState<EcctrlAnimationState>('IDLE');
  const [fireSeq, setFireSeq] = useState(0);
  const [ready, setReady] = useState(false);
  const lastShotMsRef = useRef(0);
  const avatarReadyRef = useRef(false);
  const weaponReadyRef = useRef(false);
  const playerReadyRef = useRef(false);
  const prereqsReadyRef = useRef(false);
  const readyRef = useRef(false);
  const thirdPersonGroupRef = useRef<THREE.Group | null>(null);

  const checkReady = useCallback(() => {
    if (avatarReadyRef.current && weaponReadyRef.current && playerReadyRef.current) {
      prereqsReadyRef.current = true;
    }
  }, []);

  const handleWarmedUp = useCallback(() => {
    setReady(true);
    setTelemetryMode('range');
    setTelemetryReady(true);
  }, []);

  useEffect(() => {
    setHudPerspective(perspective);
  }, [perspective]);

  useEffect(() => {
    setHudDreamcastConfig(dreamcast);
  }, [dreamcast]);

  useEffect(() => {
    if (!active) setHudPointerLocked(false);
  }, [active]);

  useEffect(() => () => setHudPointerLocked(false), []);

  useLayoutEffect(() => {
    if (active && ready) {
      setTelemetryMode('range');
    }
  }, [active, ready]);

  const handleTogglePerspective = useCallback(() => {
    onPerspectiveChange(perspective === 'first' ? 'third' : 'first');
  }, [perspective, onPerspectiveChange]);

  const handleAnimStateChange = useCallback((next: EcctrlAnimationState) => {
    setHudPlayerState(next);
    setAnimState(next);
  }, []);

  const handleFire = useCallback(
    (scene: THREE.Scene, camera: THREE.Camera) => {
      if (!active) return;
      const now = performance.now();
      const cooldown = WEAPON_SPECS[range.activeWeapon].cooldownMs;
      if (now - lastShotMsRef.current < cooldown) return;
      if (!recordHudShot()) return;
      lastShotMsRef.current = now;
      setFireSeq((s) => s + 1);
      fireCenterReticleRay(scene, camera, range.activeWeapon, getRangeTargetHandle);
    },
    [active, range.activeWeapon]
  );

  const handleAvatarLoaded = useCallback(() => {
    avatarReadyRef.current = true;
    checkReady();
  }, [checkReady]);

  const handleWeaponLoaded = useCallback(() => {
    weaponReadyRef.current = true;
    checkReady();
  }, [checkReady]);

  const handlePlayerReady = useCallback(() => {
    playerReadyRef.current = true;
    checkReady();
  }, [checkReady]);

  return (
    <>
      <Physics gravity={[0, -9.81, 0]} paused={!active} debug={debugPhysics}>
        <group visible={active}>
          <RangeArena active={active} />
          <RangePlayer
            active={active}
            perspective={perspective}
            onTogglePerspective={handleTogglePerspective}
            onPointerLockChange={setHudPointerLocked}
            onAnimationStateChange={handleAnimStateChange}
            onPlayerReady={handlePlayerReady}
            onFire={handleFire}
            spawnPosition={DEFAULT_SPAWN_POSITION}
            debug={debugPhysics}
            ecctrlRef={ecctrlRef}
            cameraControlsRef={cameraControlsRef}
            thirdPersonGroupRef={thirdPersonGroupRef}
            firstPersonSlot={
              <WeaponRig
                active={active}
                archetype={range.activeWeapon}
                poseTag={range.poseTag}
                poseWeight={range.poseWeight}
                fireSeq={fireSeq}
                onWeaponLoaded={handleWeaponLoaded}
              />
            }
            thirdPersonAvatar={
              <RangeAvatar
                active={active}
                perspective={perspective}
                character={character}
                customGlbUrl={customGlbUrl}
                customAlbedoUrl={customAlbedoUrl}
                animState={animState}
                weaponArchetype={range.activeWeapon}
                poseTag={range.poseTag}
                poseWeight={range.poseWeight}
                wiggleEnabled={range.wiggleEnabled}
                wiggleIntensity={range.wiggleIntensity}
                onLoaded={handleAvatarLoaded}
              />
            }
          />
          {range.targets.map((spec) => (
            <DestructibleTarget
              key={`${range.resetSeq}-${spec.id}`}
              spec={spec}
              active={active}
              importedAsset={spec.kind === 'imported-glb' ? range.importedAsset : null}
              registerTarget={registerRangeTargetHandle}
              onStateChange={notifyRangeTargetSnapshot}
              onHit={() => notifyRangeTargetHit(false)}
              onShatter={() => notifyRangeTargetHit(true)}
            />
          ))}
        </group>
      </Physics>
      <FpsHud active={active} />
      <DreamcastRenderer active={active} config={dreamcast} />
      <RangeWarmupGate
        active={active}
        perspective={perspective}
        prereqsReadyRef={prereqsReadyRef}
        readyRef={readyRef}
        thirdPersonGroupRef={thirdPersonGroupRef}
        onWarmedUp={handleWarmedUp}
      />
    </>
  );
}

export function ShootingRangeScene(props: ShootingRangeSceneProps) {
  return (
    <div
      className="relative h-full w-full overflow-hidden bg-zinc-950 text-zinc-100 select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      <Canvas
        shadows={false}
        dpr={1}
        gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
        onCreated={({ gl }) => {
          gl.debug.checkShaderErrors = import.meta.env.DEV;
          gl.shadowMap.enabled = false;
        }}
        camera={{ position: [0, 1.62, 2.52], fov: 70, near: 0.05, far: 150 }}
        className="h-full w-full"
      >
        <Suspense fallback={null}>
          <ShootingRangeContent active={true} {...props} />
        </Suspense>
      </Canvas>
      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
        <div className="rounded-md border border-zinc-800/80 bg-zinc-950/75 px-3 py-1 text-[11px] font-mono text-zinc-300 backdrop-blur-sm">
          WASD / Arrows: Move · Shift: Sprint · Space: Jump · V: 1st/3rd · Click: Aim · Esc: Unlock
        </div>
      </div>
    </div>
  );
}
