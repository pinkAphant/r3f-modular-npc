import { AlertCircle, Box, Check, PackagePlus, RotateCcw, Upload, X } from 'lucide-react';
import { type ChangeEvent, type DragEvent, useState } from 'react';
import { type ImportedGlbAsset, parseImportedGlbBuffer } from '../junk/junkImporter';
import type { ImportedJunkSegment } from '../types/junk';
import type { SingleItemEditMode } from '../types/range';
import type { PanelStatusMessage } from './JunkPanel';
import { shouldStopControlKeyPropagation } from './controlKeyGuard';

export interface ImporterPanelProps {
  segments: ImportedJunkSegment[];
  importedName: string | null;
  normalizedExtent?: number | null;
  lastError?: string | null;
  singleItemEditMode?: SingleItemEditMode;
  statusMessage?: PanelStatusMessage | null;
  onReportStatus?: (msg: PanelStatusMessage | null) => void;
  onImportSuccess: (asset: ImportedGlbAsset, fileName: string) => void;
  onImportError?: (message: string) => void;
  onUpdateSegment: (
    segmentId: string,
    patch: Partial<Pick<ImportedJunkSegment, 'customName' | 'destructible'>>
  ) => void;
  onSpawnImportedTarget?: () => void;
  onClearImported?: () => void;
  onCloseSingleItemEdit?: () => void;
}

export function ImporterPanel({
  segments,
  importedName,
  normalizedExtent,
  lastError,
  singleItemEditMode = 'none',
  statusMessage,
  onReportStatus,
  onImportSuccess,
  onImportError,
  onUpdateSegment,
  onSpawnImportedTarget,
  onClearImported,
  onCloseSingleItemEdit,
}: ImporterPanelProps) {
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [infoText, setInfoText] = useState<string | null>(null);

  const controlled = onReportStatus !== undefined;
  const activeBanner = controlled
    ? statusMessage
    : lastError || localError
      ? { kind: 'error' as const, text: (lastError ?? localError)! }
      : infoText
        ? { kind: 'info' as const, text: infoText }
        : null;

  const processGlbFile = async (file: File) => {
    setBusy(true);
    setLocalError(null);
    setInfoText(null);
    try {
      const buffer = await file.arrayBuffer();
      const asset = await parseImportedGlbBuffer(buffer, file.name);
      const okText = `Imported "${file.name}" (${asset.segments.length} segs, ${asset.normalizedExtent.toFixed(2)}m)`;
      setInfoText(okText);
      onReportStatus?.({ kind: 'info', text: okText });
      onImportSuccess(asset, file.name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid GLB file.';
      setLocalError(msg);
      onReportStatus?.({ kind: 'error', text: msg });
      onImportError?.(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void processGlbFile(file);
  };

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) void processGlbFile(file);
  };

  return (
    <section
      data-testid="importer-panel"
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (shouldStopControlKeyPropagation(e)) e.stopPropagation(); }}
      className="flex w-72 flex-col gap-2.5 rounded-lg border border-zinc-800 bg-zinc-950/95 p-3 text-xs text-zinc-200 shadow-lg backdrop-blur-md"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-amber-400 text-[11px]">
          <Box className="h-3.5 w-3.5" />
          <span>Single-Item GLB Importer</span>
        </div>
        {singleItemEditMode === 'glb-import' && onCloseSingleItemEdit && (
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

      <label
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={handleDrop}
        className="flex cursor-pointer items-center justify-between gap-2 rounded border border-dashed border-zinc-700 bg-zinc-900/70 p-2 text-[11px] text-zinc-300 transition hover:border-amber-500/60"
      >
        <span className="truncate">
          {busy ? 'Parsing GLB...' : importedName ? importedName : 'Drop or Choose .GLB / .GLTF'}
        </span>
        <Upload className="h-3.5 w-3.5 shrink-0 text-amber-400" />
        <input
          type="file"
          data-testid="glb-import-input"
          accept=".glb,.gltf"
          onChange={handleFileChange}
          className="sr-only"
        />
      </label>

      {importedName && segments.length > 0 && (
        <div className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/80 px-2 py-1 font-mono text-[10px] text-zinc-300">
          <span>{segments.length} SEGMENTS</span>
          {normalizedExtent != null && (
            <span className="text-emerald-300">
              {normalizedExtent.toFixed(2)}m MAX
            </span>
          )}
        </div>
      )}

      {segments.length > 0 && (
        <div className="flex max-h-40 flex-col gap-1 overflow-y-auto pr-0.5">
          {segments.map((seg) => (
            <div
              key={seg.segmentId}
              className="flex items-center justify-between gap-1.5 rounded border border-zinc-800 bg-zinc-900/60 px-2 py-1"
            >
              <input
                type="text"
                value={seg.customName}
                onChange={(e) =>
                  onUpdateSegment(seg.segmentId, { customName: e.target.value })
                }
                className="min-w-0 flex-1 bg-transparent text-[11px] text-zinc-100 focus:outline-none"
              />
              <span className="font-mono text-[10px] text-zinc-500">
                {seg.triCount}t
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onUpdateSegment(seg.segmentId, {
                    destructible: !seg.destructible,
                  });
                }}
                title="Toggle destructible"
                className={`flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px] ${
                  seg.destructible
                    ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-400'
                }`}
              >
                <Check className="h-2.5 w-2.5" />
                {seg.destructible ? 'Break' : 'Anchor'}
              </button>
            </div>
          ))}
        </div>
      )}

      {(onSpawnImportedTarget || (importedName && onClearImported)) && (
        <div className="flex items-center gap-1.5">
          {onSpawnImportedTarget && (
            <button
              type="button"
              disabled={segments.length === 0 || busy}
              onClick={(e) => { e.currentTarget.blur(); onSpawnImportedTarget(); }}
              className="flex flex-1 items-center justify-center gap-1 rounded border border-sky-500/50 bg-sky-500/20 px-2 py-1.5 font-medium text-sky-200 transition hover:bg-sky-500/30 disabled:opacity-40"
            >
              <PackagePlus className="h-3.5 w-3.5" /> Spawn Target
            </button>
          )}
          {importedName && onClearImported && (
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                setLocalError(null);
                setInfoText(null);
                onReportStatus?.(null);
                onClearImported();
              }}
              className="rounded border border-amber-500/40 bg-amber-950/30 p-1.5 text-amber-200 hover:bg-amber-950/50"
              title="Clear imported GLB"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {activeBanner && (
        <div
          data-testid="status-banner"
          role={activeBanner.kind === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-1.5 rounded border px-2 py-1.5 text-[11px] ${
            activeBanner.kind === 'error'
              ? 'border-rose-500/50 bg-rose-950/40 text-rose-200'
              : 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
          }`}
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="break-words">{activeBanner.text}</span>
        </div>
      )}
    </section>
  );
}
