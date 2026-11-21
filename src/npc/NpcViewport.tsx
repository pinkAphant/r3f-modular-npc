import { Grid, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { RiggedGlbNpc, type RiggedNpcInfo } from './RiggedGlbNpc';

export type CharacterId = 'male' | 'female' | 'custom';

interface NpcViewportProps {
  character: CharacterId;
  customGlbUrl: string | null;
  activeAnim: string | null;
  wireframe: boolean;
  showSockets: boolean;
  customAlbedoUrl: string | null;
  onLoaded: (info: RiggedNpcInfo) => void;
}

export function NpcViewport({
  character,
  customGlbUrl,
  activeAnim,
  wireframe,
  showSockets,
  customAlbedoUrl,
  onLoaded,
}: NpcViewportProps) {
  const url =
    character === 'male'
      ? '/assets/npc_psx_m.glb'
      : character === 'female'
      ? '/assets/npc_psx_f.glb'
      : customGlbUrl ?? '/assets/npc_psx_m.glb';

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

      <RiggedGlbNpc
        url={url}
        activeAnim={activeAnim}
        wireframe={wireframe}
        showSockets={showSockets}
        customAlbedoUrl={customAlbedoUrl}
        onLoaded={onLoaded}
      />

      <OrbitControls target={[0, 0.95, 0]} makeDefault />
    </Canvas>
  );
}
