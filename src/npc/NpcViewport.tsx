import { Grid, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { createPsxTexture, renderAlbedoCanvas, type OutfitId } from './albedoAtlas';
import { buildPsxNpc, type NpcBuild, type SocketSpec } from './buildPsxNpc';
import { RiggedGlbNpc, type RiggedNpcInfo } from './RiggedGlbNpc';

export type ViewSource = 'tripo-m' | 'tripo-f' | 'procedural' | 'custom-glb';

interface NpcViewportProps {
  source: ViewSource;
  customGlbUrl: string | null;
  activeAnim: string | null;
  build: NpcBuild;
  outfit: OutfitId;
  wireframe: boolean;
  pixelCrisp: boolean;
  showSockets: boolean;
  showUvGuides: boolean;
  customAlbedoUrl: string | null;
  onProceduralStats: (tris: number, sockets: SocketSpec[]) => void;
  onRiggedLoaded: (info: RiggedNpcInfo) => void;
  onExportReady: (meshRef: THREE.Group | null) => void;
}

function ProceduralNpc({
  build,
  outfit,
  wireframe,
  showSockets,
  showUvGuides,
  customAlbedoUrl,
  onProceduralStats,
  onExportReady,
}: Pick<
  NpcViewportProps,
  | 'build'
  | 'outfit'
  | 'wireframe'
  | 'showSockets'
  | 'showUvGuides'
  | 'customAlbedoUrl'
  | 'onProceduralStats'
  | 'onExportReady'
>) {
  const npc = useMemo(() => buildPsxNpc(build), [build]);

  const texture = useMemo(() => {
    if (customAlbedoUrl) {
      const tex = new THREE.TextureLoader().load(customAlbedoUrl);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      return tex;
    }
    return createPsxTexture(renderAlbedoCanvas(outfit, build, showUvGuides));
  }, [outfit, build, showUvGuides, customAlbedoUrl]);

  useEffect(() => {
    onProceduralStats(npc.triCount, npc.sockets);
    return () => npc.geometry.dispose();
  }, [npc, onProceduralStats]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <group name={`NPC_PSX_${build.toUpperCase()}`} ref={(g) => onExportReady(g)}>
      <mesh name="Body_Mesh" geometry={npc.geometry} castShadow receiveShadow>
        <meshStandardMaterial
          map={texture}
          roughness={0.95}
          metalness={0.0}
          flatShading
          wireframe={wireframe}
        />
      </mesh>
      {npc.sockets.map((s) => (
        <group key={s.name} name={s.name} position={s.position}>
          {showSockets && (
            <mesh>
              <octahedronGeometry args={[0.032, 0]} />
              <meshBasicMaterial color={s.color} wireframe />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

export function NpcViewport(props: NpcViewportProps) {
  const glbUrl =
    props.source === 'tripo-m'
      ? '/assets/npc_psx_m.glb'
      : props.source === 'tripo-f'
      ? '/assets/npc_psx_f.glb'
      : props.source === 'custom-glb'
      ? props.customGlbUrl
      : null;

  return (
    <Canvas camera={{ position: [0, 1.3, 2.9], fov: 40 }} shadows className="h-full w-full">
      <color attach="background" args={['#09090b']} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[2.5, 4.5, 3]} intensity={1.4} castShadow />
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

      {glbUrl ? (
        <RiggedGlbNpc
          url={glbUrl}
          activeAnim={props.activeAnim}
          wireframe={props.wireframe}
          pixelCrisp={props.pixelCrisp}
          showSockets={props.showSockets}
          customAlbedoUrl={props.customAlbedoUrl}
          onLoaded={props.onRiggedLoaded}
        />
      ) : (
        <ProceduralNpc
          build={props.build}
          outfit={props.outfit}
          wireframe={props.wireframe}
          showSockets={props.showSockets}
          showUvGuides={props.showUvGuides}
          customAlbedoUrl={props.customAlbedoUrl}
          onProceduralStats={props.onProceduralStats}
          onExportReady={props.onExportReady}
        />
      )}

      <OrbitControls target={[0, 0.95, 0]} makeDefault />
    </Canvas>
  );
}
