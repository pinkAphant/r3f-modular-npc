import { Download, Image as ImageIcon, Layers, Play, RotateCcw, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OUTFIT_LABELS, renderAlbedoCanvas, type OutfitId } from './npc/albedoAtlas';
import type { NpcBuild, SocketSpec } from './npc/buildPsxNpc';
import { NpcViewport, type ViewSource } from './npc/NpcViewport';
import type { RiggedNpcInfo } from './npc/RiggedGlbNpc';

function shortAnimLabel(name: string): string {
  if (name.toLowerCase().includes('strafing right')) return 'Strafe Right';
  if (name.toLowerCase().includes('strafing left')) return 'Strafe Left';
  return name.replace(/_/g, ' ');
}

export default function App() {
  const [source, setSource] = useState<ViewSource>('tripo-m');
  const [customGlbUrl, setCustomGlbUrl] = useState<string | null>(null);
  const [customGlbName, setCustomGlbName] = useState<string | null>(null);
  const [animations, setAnimations] = useState<string[]>([]);
  const [activeAnim, setActiveAnim] = useState<string | null>(null);
  const [boneCount, setBoneCount] = useState(0);

  const [build, setBuild] = useState<NpcBuild>('male');
  const [outfit, setOutfit] = useState<OutfitId>('underwear');
  const [wireframe, setWireframe] = useState(false);
  const [pixelCrisp, setPixelCrisp] = useState(true);
  const [showSockets, setShowSockets] = useState(true);
  const [showUvGuides, setShowUvGuides] = useState(false);
  const [triCount, setTriCount] = useState(500);
  const [customAlbedoUrl, setCustomAlbedoUrl] = useState<string | null>(null);

  const exportGroupRef = useRef<THREE.Group | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleProceduralStats = useCallback((tris: number, _sock: SocketSpec[]) => {
    setTriCount(tris);
    setAnimations([]);
    setBoneCount(0);
  }, []);

  const handleRiggedLoaded = useCallback((info: RiggedNpcInfo) => {
    setTriCount(info.tris);
    setAnimations(info.animations);
    setBoneCount(info.boneCount);
    setActiveAnim((prev) =>
      prev && info.animations.includes(prev) ? prev : info.animations.includes('idle') ? 'idle' : info.animations[0] ?? null
    );
  }, []);

  const handleExportReady = useCallback((group: THREE.Group | null) => {
    exportGroupRef.current = group;
  }, []);

  useEffect(() => {
    const dest = previewCanvasRef.current;
    if (!dest) return;
    const src = renderAlbedoCanvas(outfit, build, showUvGuides);
    const ctx = dest.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, dest.width, dest.height);
    ctx.drawImage(src, 0, 0, dest.width, dest.height);
  }, [outfit, build, showUvGuides, source]);

  const exportProceduralGlb = () => {
    const group = exportGroupRef.current;
    if (!group) return;
    new GLTFExporter().parse(
      group,
      (result) => {
        const blob = new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `npc_psx_${build}_${outfit}.glb`;
        link.click();
        URL.revokeObjectURL(url);
      },
      (err) => console.error(err),
      { binary: true }
    );
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const lower = file.name.toLowerCase();
    const url = URL.createObjectURL(file);
    if (lower.endsWith('.glb') || lower.endsWith('.gltf')) {
      setCustomGlbUrl(url);
      setCustomGlbName(file.name);
      setSource('custom-glb');
    } else if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.webp')) {
      setCustomAlbedoUrl(url);
    }
  };

  return (
    <div
      className="flex h-screen w-screen bg-zinc-950 text-zinc-100"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <aside className="flex w-72 flex-col gap-4 border-r border-zinc-800 bg-zinc-900/70 p-4 overflow-y-auto">
        <div>
          <h1 className="text-sm font-bold tracking-wider uppercase text-sky-400">
            r3f-modular-npc
          </h1>
          <p className="text-xs text-zinc-400">500-Tri PSX++ Mixamo Workbench</p>
        </div>

        {/* Budget & Rig Badge */}
        <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
          <div
            className={`rounded border px-2.5 py-1.5 text-center ${
              triCount > 550
                ? 'border-amber-500/40 bg-amber-950/40 text-amber-300'
                : 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
            }`}
          >
            {triCount} / 500 TRIS
          </div>
          <div className="rounded border border-zinc-700 bg-zinc-800/60 px-2.5 py-1.5 text-center text-zinc-300">
            {boneCount > 0 ? `${boneCount} BONES` : 'STATIC'}
          </div>
        </div>

        {/* Character Selector */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            500-Tri Character
          </div>
          <div className="grid grid-cols-3 gap-1">
            {(
              [
                ['tripo-m', 'Male'],
                ['tripo-f', 'Female'],
                ['procedural', 'Proc'],
              ] as Array<[ViewSource, string]>
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => {
                  setCustomAlbedoUrl(null);
                  setSource(id);
                }}
                className={`rounded border px-2 py-1.5 text-xs font-medium transition ${
                  source === id
                    ? 'border-sky-500 bg-sky-500/20 text-sky-200'
                    : 'border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:border-zinc-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {customGlbName && source === 'custom-glb' && (
            <div className="flex items-center justify-between rounded border border-sky-500/40 bg-sky-950/40 px-2 py-1 text-xs">
              <span className="truncate text-sky-300">{customGlbName}</span>
              <button onClick={() => setSource('tripo-m')} className="text-zinc-400 hover:text-white">
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Mixamo Animations */}
        {animations.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Mixamo Animations ({animations.length})
            </div>
            <div className="flex flex-col gap-1">
              {animations.map((anim) => (
                <button
                  key={anim}
                  onClick={() => setActiveAnim(anim)}
                  className={`flex items-center gap-2 rounded border px-2.5 py-1.5 text-left text-xs capitalize transition ${
                    activeAnim === anim
                      ? 'border-sky-500 bg-sky-500/20 text-sky-200'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  <Play className="h-3 w-3 shrink-0" />
                  <span className="truncate">{shortAnimLabel(anim)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Procedural Outfits (only when in procedural mode) */}
        {source === 'procedural' && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-1">
              {(['male', 'female'] as NpcBuild[]).map((b) => (
                <button
                  key={b}
                  onClick={() => setBuild(b)}
                  className={`rounded border px-2 py-1 text-xs capitalize ${
                    build === b ? 'border-sky-500 bg-sky-500/20 text-sky-200' : 'border-zinc-800 text-zinc-400'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-1">
              {(Object.keys(OUTFIT_LABELS) as OutfitId[]).map((id) => (
                <button
                  key={id}
                  onClick={() => {
                    setCustomAlbedoUrl(null);
                    setOutfit(id);
                  }}
                  className={`rounded border px-2.5 py-1 text-left text-xs ${
                    outfit === id && !customAlbedoUrl
                      ? 'border-sky-500 bg-sky-500/20 text-sky-200'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-300'
                  }`}
                >
                  {OUTFIT_LABELS[id]}
                </button>
              ))}
            </div>
            <canvas
              ref={previewCanvasRef}
              width={192}
              height={192}
              className="w-full rounded border border-zinc-700 [image-rendering:pixelated]"
            />
          </div>
        )}

        {/* Display Toggles */}
        <div className="space-y-1.5 text-xs">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={pixelCrisp} onChange={(e) => setPixelCrisp(e.target.checked)} />
            <span>PSX NearestFilter (Crisp)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showSockets} onChange={(e) => setShowSockets(e.target.checked)} />
            <span>Bone Sockets (Hand/Head/Back)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={wireframe} onChange={(e) => setWireframe(e.target.checked)} />
            <span>Wireframe</span>
          </label>
          {source === 'procedural' && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showUvGuides} onChange={(e) => setShowUvGuides(e.target.checked)} />
              <span>UV Quadrant Labels</span>
            </label>
          )}
        </div>

        {/* Custom Albedo Reset */}
        {customAlbedoUrl && (
          <button
            onClick={() => setCustomAlbedoUrl(null)}
            className="flex items-center justify-center gap-1.5 rounded border border-amber-500/40 bg-amber-950/30 px-2.5 py-1.5 text-xs text-amber-200 hover:bg-amber-950/50"
          >
            <ImageIcon className="h-3.5 w-3.5" /> Reset Custom Albedo
          </button>
        )}

        {/* Footer Actions */}
        <div className="mt-auto space-y-2 pt-2 border-t border-zinc-800">
          {source === 'procedural' && (
            <button
              onClick={exportProceduralGlb}
              className="flex w-full items-center justify-center gap-2 rounded bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500"
            >
              <Download className="h-3.5 w-3.5" /> Export Procedural .GLB
            </button>
          )}
          <div className="flex items-center gap-1.5 rounded border border-dashed border-zinc-700 p-2 text-[11px] text-zinc-400">
            <Upload className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            <span>Drop any .GLB or custom Albedo .PNG/.JPG onto viewport</span>
          </div>
        </div>
      </aside>

      <main className="relative flex-1">
        <NpcViewport
          source={source}
          customGlbUrl={customGlbUrl}
          activeAnim={activeAnim}
          build={build}
          outfit={outfit}
          wireframe={wireframe}
          pixelCrisp={pixelCrisp}
          showSockets={showSockets}
          showUvGuides={showUvGuides}
          customAlbedoUrl={customAlbedoUrl}
          onProceduralStats={handleProceduralStats}
          onRiggedLoaded={handleRiggedLoaded}
          onExportReady={handleExportReady}
        />
        <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-1.5 rounded bg-zinc-900/80 px-2.5 py-1 text-[11px] font-mono text-zinc-400 border border-zinc-800">
          <Layers className="h-3 w-3 text-sky-400" />
          <span>+Z Forward · Mixamo Rig · {pixelCrisp ? 'NearestFilter' : 'LinearFilter'}</span>
        </div>
      </main>
    </div>
  );
}
