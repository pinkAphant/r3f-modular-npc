import {
  AlertCircle, Box, Image as ImageIcon, Layers, PackagePlus, Sparkles, Tag, Upload, X,
} from 'lucide-react';
import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { decodeLabelImageUrl, validateLabelImageFile } from '../junk/junkLabels';
import type { CanLodMode, ProceduralLabelId } from '../types/junk';
import type { SingleItemEditMode } from '../types/range';
import { shouldStopControlKeyPropagation } from './controlKeyGuard';

export interface PanelStatusMessage {
  kind: 'info' | 'error';
  text: string;
}

export interface JunkPanelProps {
  canLodMode: CanLodMode;
  onCanLodModeChange: (mode: CanLodMode) => void;
  labelId: ProceduralLabelId;
  onLabelIdChange: (id: ProceduralLabelId) => void;
  customLabelName?: string | null;
  onCustomLabelUpload: (url: string, fileName: string) => void;
  onSpawnTinCan: () => void;
  onSpawnGlassBottle: () => void;
  shatterPieceCount?: number;
  onShatterPieceCountChange?: (count: number) => void;
  singleItemEditMode?: SingleItemEditMode;
  onEnterJunkEditor?: () => void;
  onEnterGlbImporter?: () => void;
  onCloseSingleItemEdit?: () => void;
  statusMessage?: PanelStatusMessage | null;
  onReportStatus?: (msg: PanelStatusMessage | null) => void;
}

export function JunkPanel({
  canLodMode,
  onCanLodModeChange,
  labelId,
  onLabelIdChange,
  customLabelName,
  onCustomLabelUpload,
  onSpawnTinCan,
  onSpawnGlassBottle,
  shatterPieceCount = 6,
  onShatterPieceCountChange,
  singleItemEditMode = 'none',
  onEnterJunkEditor,
  onEnterGlbImporter,
  onCloseSingleItemEdit,
  statusMessage,
  onReportStatus,
}: JunkPanelProps) {
  const [localStatus, setLocalStatus] = useState<PanelStatusMessage | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const controlled = onReportStatus !== undefined;
  const activeStatus = controlled ? (statusMessage ?? null) : localStatus;
  const setStatus = (msg: PanelStatusMessage | null) => {
    if (!controlled) setLocalStatus(msg);
    onReportStatus?.(msg);
  };

  const handleLabelFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const err = validateLabelImageFile(file);
    if (err) { setStatus({ kind: 'error', text: err }); return; }
    const url = URL.createObjectURL(file);
    try {
      await decodeLabelImageUrl(url);
    } catch {
      URL.revokeObjectURL(url);
      if (mountedRef.current) setStatus({ kind: 'error', text: `Failed to decode image "${file.name}".` });
      return;
    }
    if (!mountedRef.current) { URL.revokeObjectURL(url); return; }
    onCustomLabelUpload(url, file.name);
    setStatus({ kind: 'info', text: `Loaded label "${file.name}".` });
  };

  return (
    <section
      data-testid="junk-panel"
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (shouldStopControlKeyPropagation(e)) e.stopPropagation(); }}
      className="flex w-64 flex-col gap-2.5 rounded-lg border border-zinc-800 bg-zinc-950/90 p-3 text-xs text-zinc-200 shadow-lg backdrop-blur-md"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-sky-400">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Procedural Junk</span>
        </div>
        {singleItemEditMode === 'junk-generator' && onCloseSingleItemEdit && (
          <button
            type="button"
            data-testid="close-single-item-edit"
            onClick={(e) => { e.currentTarget.blur(); onCloseSingleItemEdit(); }}
            className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:border-sky-500/60 hover:text-white"
          >
            <X className="h-3 w-3" /> Done
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          data-testid="spawn-tin-can"
          onClick={(e) => { e.currentTarget.blur(); onSpawnTinCan(); }}
          className="flex items-center justify-center gap-1.5 rounded border border-sky-500/50 bg-sky-500/15 px-2 py-1.5 font-medium text-sky-200 transition hover:bg-sky-500/25"
        >
          <PackagePlus className="h-3.5 w-3.5" /> Tin Can
        </button>
        <button
          type="button"
          data-testid="spawn-glass-bottle"
          onClick={(e) => { e.currentTarget.blur(); onSpawnGlassBottle(); }}
          className="flex items-center justify-center gap-1.5 rounded border border-emerald-500/50 bg-emerald-950/40 px-2 py-1.5 font-medium text-emerald-300 transition hover:bg-emerald-900/50"
        >
          <PackagePlus className="h-3.5 w-3.5" /> Bottle
        </button>
      </div>

      <div className="space-y-1">
        <label className="flex items-center gap-1 text-[11px] font-medium text-zinc-400">
          <Layers className="h-3 w-3" /> Can Geometry LOD
        </label>
        <select
          data-testid="can-lod-select"
          value={canLodMode}
          onChange={(e) => { onCanLodModeChange(e.target.value as CanLodMode); e.currentTarget.blur(); }}
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus:border-sky-500 focus:outline-none"
        >
          <option value="auto">Auto (Distance)</option>
          <option value="3-gon">3-Gon (Low Poly)</option>
          <option value="12-gon">12-Gon (Close-Up)</option>
        </select>
      </div>

      <div className="space-y-1">
        <label className="flex items-center gap-1 text-[11px] font-medium text-zinc-400">
          <Tag className="h-3 w-3" /> Can Label
        </label>
        <select
          data-testid="label-select"
          value={labelId}
          onChange={(e) => { onLabelIdChange(e.target.value as ProceduralLabelId); e.currentTarget.blur(); }}
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus:border-sky-500 focus:outline-none"
        >
          <option value="target">Bullseye Target</option>
          <option value="goofy-emoji">Goofy Emoji</option>
          <option value="tris-soda">Tris&apos; Soda</option>
          <option value="garys-beans">Gary&apos;s Beans</option>
          <option value="custom">Custom Image</option>
        </select>
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-2 rounded border border-dashed border-zinc-700 bg-zinc-900/60 px-2 py-1.5 text-[11px] text-zinc-300 transition hover:border-sky-500/60">
        <span className="flex items-center gap-1.5 truncate">
          <ImageIcon className="h-3.5 w-3.5 shrink-0 text-sky-400" />
          <span className="truncate">
            {customLabelName ? customLabelName : 'Upload Custom Label'}
          </span>
        </span>
        <Upload className="h-3 w-3 shrink-0 text-zinc-400" />
        <input
          type="file"
          data-testid="label-upload-input"
          accept="image/*"
          onChange={handleLabelFileChange}
          className="sr-only"
        />
      </label>

      {onShatterPieceCountChange && (
        <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-400">
          <span>BVH Shards: {shatterPieceCount}</span>
          <input
            type="range"
            min={4}
            max={14}
            step={1}
            value={shatterPieceCount}
            onChange={(e) => onShatterPieceCountChange(Number(e.target.value))}
            onPointerUp={(e) => e.currentTarget.blur()}
            className="w-24 accent-sky-400"
          />
        </div>
      )}

      {(onEnterJunkEditor || onEnterGlbImporter) && (
        <div className="grid grid-cols-2 gap-1.5 pt-0.5">
          {onEnterJunkEditor && (
            <button
              type="button"
              data-testid="open-junk-editor"
              onClick={(e) => { e.currentTarget.blur(); onEnterJunkEditor(); }}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300 hover:border-sky-500/60"
            >
              Edit Junk
            </button>
          )}
          {onEnterGlbImporter && (
            <button
              type="button"
              data-testid="open-glb-importer"
              onClick={(e) => { e.currentTarget.blur(); onEnterGlbImporter(); }}
              className="flex items-center justify-center gap-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300 hover:border-amber-500/60"
            >
              <Box className="h-3 w-3" /> Import GLB
            </button>
          )}
        </div>
      )}

      {activeStatus && (
        <div
          data-testid="status-banner"
          role={activeStatus.kind === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-1.5 rounded border px-2 py-1.5 text-[11px] ${
            activeStatus.kind === 'error'
              ? 'border-rose-500/50 bg-rose-950/40 text-rose-200'
              : 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
          }`}
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="break-words">{activeStatus.text}</span>
        </div>
      )}
    </section>
  );
}
