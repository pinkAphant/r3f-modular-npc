import { Download, Image as ImageIcon, Layers, RotateCcw, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OUTFIT_LABELS, renderAlbedoCanvas, type OutfitId } from './npc/albedoAtlas';
import type { NpcBuild, SocketSpec } from './npc/buildPsxNpc';
import { NpcViewport } from './npc/NpcViewport';

export default function App() {
  const [build, setBuild] = useState<NpcBuild>('male');
  const [outfit, setOutfit] = useState<OutfitId>('underwear');
  const [wireframe, setWireframe] = useState(false);
  const [showSockets, setShowSockets] = useState(true);
  const [showUvGuides, setShowUvGuides] = useState(false);
  const [triCount, setTriCount] = useState(0);
  const [sockets, setSockets] = useState<SocketSpec[]>([]);
  const [customAlbedoUrl, setCustomAlbedoUrl] = useState<string | null>(null);
  const [uploadedScene, setUploadedScene] = useState<THREE.Group | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);

  const exportGroupRef = useRef<THREE.Group | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleStats = useCallback((tris: number, sock: SocketSpec[]) => {
    setTriCount(tris);
    setSockets(sock);
  }, []);

  const handleExportReady = useCallback((group: THREE.Group | null) => {
    exportGroupRef.current = group;
  }, []);

  // Update small 2D atlas preview
  useEffect(() => {
    const dest = previewCanvasRef.current;
    if (!dest) return;
    const src = renderAlbedoCanvas(outfit, build, showUvGuides);
    const ctx = dest.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, dest.width, dest.height);
    ctx.drawImage(src, 0, 0, dest.width, dest.height);
  }, [outfit, build, showUvGuides]);

  const downloadUvPng = () => {
    const canvas = renderAlbedoCanvas(outfit, build, true);
    const link = document.createElement('a');
    link.download = `npc_psx_${build}_${outfit}_uv_256.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const exportGlb = () => {
    const group = exportGroupRef.current;
    if (!group) return;
    const exporter = new GLTFExporter();
    exporter.parse(
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
      (err) => console.error('GLB export error:', err),
      { binary: true }
    );
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const lower = file.name.toLowerCase();

    if (lower.endsWith('.glb') || lower.endsWith('.gltf')) {
      const url = URL.createObjectURL(file);
      const loader = new GLTFLoader();
      loader.load(url, (gltf) => {
        let tris = 0;
        gltf.scene.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const g = (obj as THREE.Mesh).geometry;
            tris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
          }
        });
        setTriCount(Math.round(tris));
        setUploadedScene(gltf.scene);
        setUploadedName(file.name);
        URL.revokeObjectURL(url);
      });
    } else if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.webp')) {
      const url = URL.createObjectURL(file);
      setCustomAlbedoUrl(url);
      setUploadedScene(null);
      setUploadedName(null);
    }
  };

  const overBudget = triCount > 550;

  return (
    <div
      className="flex h-screen w-screen bg-zinc-950 text-zinc-100"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Left Workbench Panel */}
      <aside className="flex w-72 flex-col gap-4 border-r border-zinc-800 bg-zinc-900/70 p-4 overflow-y-auto">
        <div>
          <h1 className="text-sm font-bold tracking-wider uppercase text-sky-400">
            r3f-modular-npc
          </h1>
          <p className="text-xs text-zinc-400">500-Tri PSX++ Albedo Workbench</p>
        </div>

        {/* Tri Budget Badge */}
        <div
          className={`flex items-center justify-between rounded border px-3 py-2 text-xs font-mono ${
            overBudget
              ? 'border-amber-500/40 bg-amber-950/40 text-amber-300'
              : 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
          }`}
        >
          <span>TRIS</span>
          <span className="font-bold">
            {triCount} / 500
          </span>
        </div>

        {uploadedName && (
          <div className="flex items-center justify-between rounded border border-sky-500/40 bg-sky-950/40 px-2.5 py-1.5 text-xs">
            <span className="truncate text-sky-300">{uploadedName}</span>
            <button
              onClick={() => {
                setUploadedScene(null);
                setUploadedName(null);
              }}
              className="ml-2 text-zinc-400 hover:text-white"
              title="Back to Procedural Base"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Base Build */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Base Archetype
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {(['male', 'female'] as NpcBuild[]).map((b) => (
              <button
                key={b}
                onClick={() => {
                  setUploadedScene(null);
                  setUploadedName(null);
                  setBuild(b);
                }}
                className={`rounded border px-2 py-1.5 text-xs font-medium capitalize transition ${
                  build === b && !uploadedScene
                    ? 'border-sky-500 bg-sky-500/20 text-sky-200'
                    : 'border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:border-zinc-500'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        {/* Albedo-Only Outfits */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Albedo-Only Outfit (1 Draw Call)
          </div>
          <div className="flex flex-col gap-1">
            {(Object.keys(OUTFIT_LABELS) as OutfitId[]).map((id) => (
              <button
                key={id}
                onClick={() => {
                  setCustomAlbedoUrl(null);
                  setOutfit(id);
                }}
                className={`rounded border px-2.5 py-1.5 text-left text-xs transition ${
                  outfit === id && !customAlbedoUrl
                    ? 'border-sky-500 bg-sky-500/20 text-sky-200'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600'
                }`}
              >
                {OUTFIT_LABELS[id]}
              </button>
            ))}
          </div>
        </div>

        {/* 256x256 UV Atlas Preview */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            <span>256×256 UV Atlas</span>
            <button
              onClick={downloadUvPng}
              className="flex items-center gap-1 text-sky-400 hover:text-sky-300"
            >
              <ImageIcon className="h-3 w-3" /> UV PNG
            </button>
          </div>
          <canvas
            ref={previewCanvasRef}
            width={192}
            height={192}
            className="w-full rounded border border-zinc-700 bg-zinc-950 [image-rendering:pixelated]"
          />
        </div>

        {/* Toggles */}
        <div className="space-y-1.5 text-xs">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={wireframe}
              onChange={(e) => setWireframe(e.target.checked)}
            />
            <span>Wireframe</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showSockets}
              onChange={(e) => setShowSockets(e.target.checked)}
            />
            <span>KHR Armory Sockets ({sockets.length})</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showUvGuides}
              onChange={(e) => setShowUvGuides(e.target.checked)}
            />
            <span>UV Quadrant Labels</span>
          </label>
        </div>

        {/* Actions */}
        <div className="mt-auto space-y-2 pt-2 border-t border-zinc-800">
          <button
            onClick={exportGlb}
            disabled={!!uploadedScene}
            className="flex w-full items-center justify-center gap-2 rounded bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" /> Export 500-Tri .GLB
          </button>
          <div className="flex items-center gap-1.5 rounded border border-dashed border-zinc-700 p-2 text-[11px] text-zinc-400">
            <Upload className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            <span>Drop any Tripo .GLB or 256px Albedo .PNG onto the viewport</span>
          </div>
        </div>
      </aside>

      {/* 3D Viewport */}
      <main className="relative flex-1">
        <NpcViewport
          build={build}
          outfit={outfit}
          wireframe={wireframe}
          showSockets={showSockets}
          showUvGuides={showUvGuides}
          customAlbedoUrl={customAlbedoUrl}
          uploadedScene={uploadedScene}
          onStats={handleStats}
          onExportReady={handleExportReady}
        />
        <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-1.5 rounded bg-zinc-900/80 px-2.5 py-1 text-[11px] font-mono text-zinc-400 border border-zinc-800">
          <Layers className="h-3 w-3 text-sky-400" />
          <span>+Z Forward · SI Meters · NearestFilter</span>
        </div>
      </main>
    </div>
  );
}
