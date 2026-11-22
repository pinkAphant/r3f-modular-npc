import { Image as ImageIcon, Play, RotateCcw, Upload } from 'lucide-react';
import type { CharacterId } from '../npc/NpcViewport';
import { PosePanel } from './PosePanel';

export interface ViewerSidebarProps {
  character: CharacterId;
  onSelectCharacter: (id: CharacterId) => void;
  onResetCustomGlb: () => void;
  customGlbName: string | null;
  animations: string[];
  activeAnim: string | null;
  onSelectAnim: (anim: string) => void;
  triCount: number;
  boneCount: number;
  wireframe: boolean;
  onToggleWireframe: (checked: boolean) => void;
  showSockets: boolean;
  onToggleSockets: (checked: boolean) => void;
  customAlbedoUrl: string | null;
  onResetAlbedo: () => void;
}

function shortAnimLabel(name: string): string {
  const clean = name.replace(/\.001$/i, '');
  if (clean.toLowerCase().includes('strafing right')) return 'Strafe Right';
  if (clean.toLowerCase().includes('strafing left')) return 'Strafe Left';
  return clean.replace(/_/g, ' ');
}

export function ViewerSidebar({
  character,
  onSelectCharacter,
  onResetCustomGlb,
  customGlbName,
  animations,
  activeAnim,
  onSelectAnim,
  triCount,
  boneCount,
  wireframe,
  onToggleWireframe,
  showSockets,
  onToggleSockets,
  customAlbedoUrl,
  onResetAlbedo,
}: ViewerSidebarProps) {
  const isCustom = character === 'custom' && Boolean(customGlbName);
  const activeChar: CharacterId = isCustom
    ? 'custom'
    : character === 'custom'
    ? 'male'
    : character;

  return (
    <aside className="flex w-64 flex-col gap-3 border-r border-zinc-800 bg-zinc-900/70 p-4 overflow-y-auto">
      <div>
        <h1 className="text-sm font-bold tracking-wider uppercase text-sky-400">
          r3f-modular-npc
        </h1>
        <p className="text-xs text-zinc-400">Mixamo Articulated Viewer</p>
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
        <div className="grid grid-cols-3 gap-1">
          <button
            type="button"
            data-testid="char-uploaded"
            onClick={() => onSelectCharacter('hero')}
            className={`rounded border px-1.5 py-1.5 text-xs font-medium transition ${
              activeChar === 'hero'
                ? 'border-sky-500 bg-sky-500/20 text-sky-200'
                : 'border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:border-zinc-500'
            }`}
          >
            Hero
          </button>
          {(['male', 'female'] as const).map((id) => (
            <button
              key={id}
              type="button"
              data-testid={`char-${id}`}
              onClick={() => onSelectCharacter(id)}
              className={`rounded border px-1.5 py-1.5 text-xs font-medium capitalize transition ${
                activeChar === id
                  ? 'border-sky-500 bg-sky-500/20 text-sky-200'
                  : 'border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:border-zinc-500'
              }`}
            >
              {id}
            </button>
          ))}
        </div>
        {isCustom && customGlbName && (
          <div className="flex items-center justify-between rounded border border-sky-500/40 bg-sky-950/40 px-2 py-1 text-xs">
            <span className="truncate text-sky-300">{customGlbName}</span>
            <button onClick={onResetCustomGlb} className="text-zinc-400 hover:text-white">
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      <PosePanel />

      {animations.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Animations ({animations.length})
          </div>
          <div data-testid="anim-list" className="flex max-h-40 flex-col gap-1 overflow-y-auto">
            {animations.map((anim) => (
              <button
                key={anim}
                onClick={() => onSelectAnim(anim)}
                className={`flex items-center gap-2 rounded border px-2.5 py-1 text-left text-xs capitalize transition ${
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
          <input
            type="checkbox"
            checked={showSockets}
            onChange={(e) => onToggleSockets(e.target.checked)}
          />
          <span>Bone Sockets</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={wireframe}
            onChange={(e) => onToggleWireframe(e.target.checked)}
          />
          <span>Wireframe</span>
        </label>
      </div>

      {customAlbedoUrl && (
        <button
          onClick={onResetAlbedo}
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
  );
}
