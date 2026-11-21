import { Image as ImageIcon, Play, RotateCcw, Upload } from 'lucide-react';
import { useCallback, useState } from 'react';
import { NpcViewport, type CharacterId } from './npc/NpcViewport';
import type { RiggedNpcInfo } from './npc/RiggedGlbNpc';

function shortAnimLabel(name: string): string {
  if (name.toLowerCase().includes('strafing right')) return 'Strafe Right';
  if (name.toLowerCase().includes('strafing left')) return 'Strafe Left';
  return name.replace(/_/g, ' ');
}

export default function App() {
  const [character, setCharacter] = useState<CharacterId>('male');
  const [customGlbUrl, setCustomGlbUrl] = useState<string | null>(null);
  const [customGlbName, setCustomGlbName] = useState<string | null>(null);
  const [animations, setAnimations] = useState<string[]>([]);
  const [activeAnim, setActiveAnim] = useState<string | null>(null);
  const [triCount, setTriCount] = useState(500);
  const [boneCount, setBoneCount] = useState(65);
  const [wireframe, setWireframe] = useState(false);
  const [showSockets, setShowSockets] = useState(true);
  const [customAlbedoUrl, setCustomAlbedoUrl] = useState<string | null>(null);

  const handleLoaded = useCallback((info: RiggedNpcInfo) => {
    setTriCount(info.tris);
    setAnimations(info.animations);
    setBoneCount(info.boneCount);
    setActiveAnim((prev) =>
      prev && info.animations.includes(prev)
        ? prev
        : info.animations.includes('idle')
        ? 'idle'
        : info.animations[0] ?? null
    );
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const lower = file.name.toLowerCase();
    const url = URL.createObjectURL(file);
    if (lower.endsWith('.glb') || lower.endsWith('.gltf')) {
      setCustomGlbUrl(url);
      setCustomGlbName(file.name);
      setCharacter('custom');
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
      <aside className="flex w-64 flex-col gap-4 border-r border-zinc-800 bg-zinc-900/70 p-4 overflow-y-auto">
        <div>
          <h1 className="text-sm font-bold tracking-wider uppercase text-sky-400">
            r3f-modular-npc
          </h1>
          <p className="text-xs text-zinc-400">500-Tri Mixamo Viewer</p>
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
          <div className="rounded border border-emerald-500/40 bg-emerald-950/40 px-2 py-1.5 text-center text-emerald-300">
            {triCount} TRIS
          </div>
          <div className="rounded border border-zinc-700 bg-zinc-800/60 px-2 py-1.5 text-center text-zinc-300">
            {boneCount} BONES
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Character
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {(['male', 'female'] as const).map((id) => (
              <button
                key={id}
                onClick={() => {
                  setCustomAlbedoUrl(null);
                  setCharacter(id);
                }}
                className={`rounded border px-2 py-1.5 text-xs font-medium capitalize transition ${
                  character === id
                    ? 'border-sky-500 bg-sky-500/20 text-sky-200'
                    : 'border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:border-zinc-500'
                }`}
              >
                {id}
              </button>
            ))}
          </div>
          {customGlbName && character === 'custom' && (
            <div className="flex items-center justify-between rounded border border-sky-500/40 bg-sky-950/40 px-2 py-1 text-xs">
              <span className="truncate text-sky-300">{customGlbName}</span>
              <button onClick={() => setCharacter('male')} className="text-zinc-400 hover:text-white">
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {animations.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Animations ({animations.length})
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

        <div className="space-y-1.5 text-xs">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showSockets} onChange={(e) => setShowSockets(e.target.checked)} />
            <span>Bone Sockets</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={wireframe} onChange={(e) => setWireframe(e.target.checked)} />
            <span>Wireframe</span>
          </label>
        </div>

        {customAlbedoUrl && (
          <button
            onClick={() => setCustomAlbedoUrl(null)}
            className="flex items-center justify-center gap-1.5 rounded border border-amber-500/40 bg-amber-950/30 px-2.5 py-1.5 text-xs text-amber-200 hover:bg-amber-950/50"
          >
            <ImageIcon className="h-3.5 w-3.5" /> Reset Albedo
          </button>
        )}

        <div className="mt-auto flex items-center gap-1.5 rounded border border-dashed border-zinc-700 p-2 text-[11px] text-zinc-400">
          <Upload className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
          <span>Drop .GLB or Albedo .PNG/.JPG</span>
        </div>
      </aside>

      <main className="flex-1">
        <NpcViewport
          character={character}
          customGlbUrl={customGlbUrl}
          activeAnim={activeAnim}
          wireframe={wireframe}
          showSockets={showSockets}
          customAlbedoUrl={customAlbedoUrl}
          onLoaded={handleLoaded}
        />
      </main>
    </div>
  );
}
