import { Canvas, useThree } from '@react-three/fiber';
import { Suspense, useLayoutEffect } from 'react';
import { NpcViewerContent, type CharacterId } from './npc/NpcViewport';
import type { RiggedNpcInfo } from './npc/RiggedGlbNpc';
import { ShootingRangeContent } from './range/ShootingRangeScene';
import type { AppMode, CameraPerspective, DreamcastConfig } from './types/range';

function ShadowModeSync({ mode }: { mode: AppMode }) {
  const { gl } = useThree();
  useLayoutEffect(() => {
    const enabled = mode === 'viewer';
    gl.shadowMap.enabled = enabled;
    if (enabled) gl.shadowMap.needsUpdate = true;
  }, [gl, mode]);
  return null;
}

export interface AppViewportProps {
  initialMode: AppMode;
  mode: AppMode;
  rangeMounted: boolean;
  perspective: CameraPerspective;
  onPerspectiveChange: (next: CameraPerspective) => void;
  dreamcast: DreamcastConfig;
  character: CharacterId;
  customGlbUrl: string | null;
  activeAnim: string | null;
  wireframe: boolean;
  showSockets: boolean;
  customAlbedoUrl: string | null;
  onViewerLoaded: (info: RiggedNpcInfo) => void;
}

export function AppViewport({
  initialMode,
  mode,
  rangeMounted,
  perspective,
  onPerspectiveChange,
  dreamcast,
  character,
  customGlbUrl,
  activeAnim,
  wireframe,
  showSockets,
  customAlbedoUrl,
  onViewerLoaded,
}: AppViewportProps) {
  const initialCamera =
    initialMode === 'viewer'
      ? { position: [0, 1.3, 2.9] as [number, number, number], fov: 40, near: 0.1, far: 1000 }
      : { position: [0, 1.62, 2.52] as [number, number, number], fov: 70, near: 0.05, far: 150 };

  return (
    <div
      className="h-full w-full select-none"
      onContextMenu={(e) => {
        if (mode === 'range') e.preventDefault();
      }}
    >
      <Canvas
        shadows={mode === 'viewer' ? 'basic' : false}
        dpr={1}
        gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
        onCreated={({ gl }) => {
          gl.debug.checkShaderErrors = import.meta.env.DEV;
          gl.shadowMap.enabled = mode === 'viewer';
        }}
        camera={initialCamera}
        className="h-full w-full"
      >
        <ShadowModeSync mode={mode} />
        {rangeMounted ? (
          <Suspense fallback={null}>
            <ShootingRangeContent
              active={mode === 'range'}
              perspective={perspective}
              onPerspectiveChange={onPerspectiveChange}
              dreamcast={dreamcast}
              character={character}
              customGlbUrl={customGlbUrl}
              customAlbedoUrl={customAlbedoUrl}
            />
          </Suspense>
        ) : null}

        {mode === 'viewer' ? (
          <Suspense fallback={null}>
            <NpcViewerContent
              character={character}
              customGlbUrl={customGlbUrl}
              activeAnim={activeAnim}
              wireframe={wireframe}
              showSockets={showSockets}
              customAlbedoUrl={customAlbedoUrl}
              onLoaded={onViewerLoaded}
            />
          </Suspense>
        ) : null}
      </Canvas>
    </div>
  );
}
