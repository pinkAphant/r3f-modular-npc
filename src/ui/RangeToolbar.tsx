import {
  Crosshair,
  Eye,
  Monitor,
  Palette,
  RotateCcw,
  Sparkles,
  Target,
  User,
} from 'lucide-react';
import type { WeaponArchetypeId } from '../types/posing';
import type {
  AppMode,
  CameraPerspective,
  DreamcastConfig,
  SingleItemEditMode,
} from '../types/range';
import { shouldStopControlKeyPropagation } from './controlKeyGuard';

const WEAPON_OPTIONS: Array<{ id: WeaponArchetypeId; label: string; key: string }> = [
  { id: 'pistol', label: 'Pistol', key: '1' },
  { id: 'shotgun', label: 'Shotgun', key: '2' },
  { id: 'smg', label: 'SMG', key: '3' },
  { id: 'rpg', label: 'RPG', key: '4' },
];

export interface RangeToolbarProps {
  mode: AppMode;
  onModeChange: (next: AppMode) => void;
  perspective: CameraPerspective;
  onTogglePerspective: () => void;
  dreamcast: DreamcastConfig;
  onUpdateDreamcast: (patch: Partial<DreamcastConfig>) => void;
  singleItemEditMode: SingleItemEditMode;
  activeWeapon: WeaponArchetypeId;
  onSelectWeapon: (weapon: WeaponArchetypeId) => void;
  onReload: () => void;
  onResetTargets: () => void;
}

export function RangeToolbar({
  mode,
  onModeChange,
  perspective,
  onTogglePerspective,
  dreamcast,
  onUpdateDreamcast,
  singleItemEditMode,
  activeWeapon,
  onSelectWeapon,
  onReload,
  onResetTargets,
}: RangeToolbarProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-2.5 z-30 flex justify-center px-3">
      <div
        onKeyDown={(e) => { if (shouldStopControlKeyPropagation(e)) e.stopPropagation(); }}
        className="pointer-events-auto flex flex-wrap items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/85 px-2.5 py-1.5 text-xs text-zinc-200 shadow-lg backdrop-blur-md"
      >
        <div className="flex items-center rounded-md border border-zinc-800 bg-zinc-900 p-0.5">
          <button
            type="button"
            data-testid="mode-range"
            aria-label="FPS Shooting Range Mode"
            onClick={(e) => {
              e.currentTarget.blur();
              onModeChange('range');
            }}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1 font-medium transition ${
              mode === 'range'
                ? 'bg-sky-500/20 text-sky-300'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Crosshair className="h-3.5 w-3.5" />
            FPS Range
          </button>
          <button
            type="button"
            data-testid="mode-viewer"
            aria-label="NPC Viewer Mode"
            onClick={(e) => {
              e.currentTarget.blur();
              onModeChange('viewer');
            }}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1 font-medium transition ${
              mode === 'viewer'
                ? 'bg-sky-500/20 text-sky-300'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <User className="h-3.5 w-3.5" />
            NPC Viewer
          </button>
        </div>

        {mode === 'range' && (
          <>
            <div className="h-4 w-px bg-zinc-800" />
            <button
              type="button"
              data-testid="toggle-perspective"
              aria-label="Toggle 1st/3rd Person Camera"
              onClick={(e) => {
                e.currentTarget.blur();
                onTogglePerspective();
              }}
              className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 font-medium text-zinc-200 transition hover:border-sky-500/60"
            >
              <Eye className="h-3.5 w-3.5 text-sky-400" />
              {perspective === 'first' ? '1st Person' : '3rd Person'}
            </button>

            {singleItemEditMode === 'none' && (
              <div
                role="group"
                aria-label="Weapon Switcher"
                data-testid="weapon-switcher"
                className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 p-0.5"
              >
                {WEAPON_OPTIONS.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    data-testid={`weapon-opt-${w.id}`}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onSelectWeapon(w.id);
                    }}
                    className={`rounded px-2 py-0.5 text-[11px] font-medium transition ${
                      activeWeapon === w.id
                        ? 'bg-sky-500/25 text-sky-200'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {w.key}:{w.label}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              data-testid="reload-weapon"
              onClick={(e) => {
                e.currentTarget.blur();
                onReload();
              }}
              className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] font-medium text-zinc-200 transition hover:border-sky-500/60"
            >
              <RotateCcw className="h-3 w-3 text-amber-400" />
              Reload (R)
            </button>

            <button
              type="button"
              data-testid="reset-targets"
              onClick={(e) => {
                e.currentTarget.blur();
                onResetTargets();
              }}
              className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] font-medium text-zinc-200 transition hover:border-emerald-500/60"
            >
              <Target className="h-3 w-3 text-emerald-400" />
              Reset Targets
            </button>

            <button
              type="button"
              data-testid="toggle-dreamcast"
              onClick={(e) => {
                e.currentTarget.blur();
                onUpdateDreamcast({ enabled: !dreamcast.enabled });
              }}
              className={`flex items-center gap-1.5 rounded border px-2 py-1 font-medium transition ${
                dreamcast.enabled
                  ? 'border-emerald-500/60 bg-emerald-950/50 text-emerald-300'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Dreamcast
            </button>

            <button
              type="button"
              data-testid="toggle-pixelsnap"
              disabled={!dreamcast.enabled}
              onClick={(e) => {
                e.currentTarget.blur();
                onUpdateDreamcast({ pixelSnap: !dreamcast.pixelSnap });
              }}
              className={`flex items-center gap-1 rounded border px-2 py-1 font-mono text-[11px] transition disabled:opacity-40 ${
                dreamcast.pixelSnap
                  ? 'border-sky-500/60 bg-sky-950/50 text-sky-300'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-400'
              }`}
            >
              <Monitor className="h-3 w-3" />
              480p
            </button>

            <button
              type="button"
              data-testid="toggle-rgb555"
              disabled={!dreamcast.enabled}
              onClick={(e) => {
                e.currentTarget.blur();
                onUpdateDreamcast({ rgb555: !dreamcast.rgb555 });
              }}
              className={`flex items-center gap-1 rounded border px-2 py-1 font-mono text-[11px] transition disabled:opacity-40 ${
                dreamcast.rgb555
                  ? 'border-amber-500/60 bg-amber-950/50 text-amber-300'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-400'
              }`}
            >
              <Palette className="h-3 w-3" />
              RGB555
            </button>
          </>
        )}
      </div>
    </div>
  );
}
