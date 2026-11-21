import { Grid, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { createPsxTexture, renderAlbedoCanvas, type OutfitId } from './albedoAtlas';
import { buildPsxNpc, type NpcBuild, type SocketSpec } from './buildPsxNpc';

interface NpcViewportProps {
  build: NpcBuild;
  outfit: OutfitId;
  wireframe: boolean;
  showSockets: boolean;
  showUvGuides: boolean;
  customAlbedoUrl: string | null;
  uploadedScene: THREE.Group | null;
  onStats: (tris: number, sockets: SocketSpec[]) => void;
  onExportReady: (meshRef: THREE.Group | null) => void;
}

function ProceduralNpc({
  build,
  outfit,
  wireframe,
  showSockets,
  showUvGuides,
  customAlbedoUrl,
  onStats,
  onExportReady,
}: Omit<NpcViewportProps, 'uploadedScene'>) {
  const npc = useMemo(() => buildPsxNpc(build), [build]);

  const texture = useMemo(() => {
    if (customAlbedoUrl) {
      const loader = new THREE.TextureLoader();
      const tex = loader.load(customAlbedoUrl);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      return tex;
    }
    const canvas = renderAlbedoCanvas(outfit, build, showUvGuides);
    return createPsxTexture(canvas);
  }, [outfit, build, showUvGuides, customAlbedoUrl]);

  useEffect(() => {
    onStats(npc.triCount, npc.sockets);
    return () => {
      npc.geometry.dispose();
    };
  }, [npc, onStats]);

  useEffect(() => {
    return () => {
      texture.dispose();
    };
  }, [texture]);

  return (
    <group
      name={`NPC_PSX_${build.toUpperCase()}`}
      ref={(g) => onExportReady(g)}
    >
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
  const { uploadedScene, wireframe } = props;

  useEffect(() => {
    if (!uploadedScene) return;
    uploadedScene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mat = (obj as THREE.Mesh).material;
        if (Array.isArray(mat)) {
          mat.forEach((m) => {
            if ('wireframe' in m) (m as THREE.MeshStandardMaterial).wireframe = wireframe;
          });
        } else if (mat && 'wireframe' in mat) {
          (mat as THREE.MeshStandardMaterial).wireframe = wireframe;
        }
      }
    });
  }, [uploadedScene, wireframe]);

  return (
    <Canvas
      camera={{ position: [0, 1.25, 2.8], fov: 40 }}
      shadows
      className="h-full w-full"
    >
      <color attach="background" args={['#09090b']} />
      <ambientLight intensity={0.75} />
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
        position={[0, 0, 0]}
      />

      {uploadedScene ? (
        <primitive object={uploadedScene} />
      ) : (
        <ProceduralNpc
          build={props.build}
          outfit={props.outfit}
          wireframe={props.wireframe}
          showSockets={props.showSockets}
          showUvGuides={props.showUvGuides}
          customAlbedoUrl={props.customAlbedoUrl}
          onStats={props.onStats}
          onExportReady={props.onExportReady}
        />
      )}

      <OrbitControls target={[0, 0.95, 0]} makeDefault />
    </Canvas>
  );
}
