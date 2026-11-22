import { useState } from 'react';
import { shouldStopControlKeyPropagation } from './controlKeyGuard';
import {
  clearRangeImportedModel,
  setRangeCanLod,
  setRangeCustomLabel,
  setRangeImportedModel,
  setRangeImportError,
  setRangeLabelId,
  setRangePoseTag,
  setRangePoseWeight,
  setRangeShatterCount,
  setRangeWiggleEnabled,
  setRangeWiggleIntensity,
  setSingleItemEditMode,
  spawnRangeTarget,
  updateRangeImportedSegment,
  useRangeState,
} from '../range/useRangeTargets';
import { ImporterPanel } from './ImporterPanel';
import { JunkPanel, type PanelStatusMessage } from './JunkPanel';
import { PosePanel } from './PosePanel';

interface ScopedStatus extends PanelStatusMessage {
  source: 'junk' | 'importer';
}

export function RangeControlDock() {
  const range = useRangeState();
  const [status, setStatus] = useState<ScopedStatus | null>(null);

  return (
    <>
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (shouldStopControlKeyPropagation(e)) e.stopPropagation(); }}
        className="pointer-events-none fixed left-2.5 top-14 bottom-10 z-20 flex max-w-[264px] flex-col gap-2 overflow-y-auto pr-1"
      >
        <div className="pointer-events-auto flex flex-col gap-2">
          <JunkPanel
            canLodMode={range.canLodMode}
            onCanLodModeChange={setRangeCanLod}
            labelId={range.labelId}
            onLabelIdChange={setRangeLabelId}
            customLabelName={range.customLabelName}
            onCustomLabelUpload={setRangeCustomLabel}
            onSpawnTinCan={() => spawnRangeTarget('tin-can')}
            onSpawnGlassBottle={() => spawnRangeTarget('glass-bottle')}
            shatterPieceCount={range.shatterPieceCount}
            onShatterPieceCountChange={setRangeShatterCount}
            singleItemEditMode={range.singleItemEditMode}
            onEnterJunkEditor={() => setSingleItemEditMode('junk-generator')}
            onEnterGlbImporter={() => setSingleItemEditMode('glb-import')}
            onCloseSingleItemEdit={() => setSingleItemEditMode('none')}
            statusMessage={status?.source === 'junk' ? status : null}
            onReportStatus={(msg) =>
              setStatus(msg ? { source: 'junk', ...msg } : null)
            }
          />

          <PosePanel
            poseTag={range.poseTag}
            onPoseTagChange={setRangePoseTag}
            poseWeight={range.poseWeight}
            onPoseWeightChange={setRangePoseWeight}
            wiggleEnabled={range.wiggleEnabled}
            onWiggleEnabledChange={setRangeWiggleEnabled}
            wiggleIntensity={range.wiggleIntensity}
            onWiggleIntensityChange={setRangeWiggleIntensity}
            hideWeaponPicker={true}
          />
        </div>
      </div>

      <div
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (shouldStopControlKeyPropagation(e)) e.stopPropagation(); }}
        className="pointer-events-none fixed right-2.5 top-14 bottom-10 z-20 flex max-w-[292px] flex-col gap-2 overflow-y-auto pl-1"
      >
        <div className="pointer-events-auto">
          <ImporterPanel
            segments={range.importedSegments}
            importedName={range.importedName}
            normalizedExtent={range.importedAsset?.normalizedExtent ?? null}
            lastError={range.importedError}
            singleItemEditMode={range.singleItemEditMode}
            statusMessage={status?.source === 'importer' ? status : null}
            onReportStatus={(msg) =>
              setStatus(msg ? { source: 'importer', ...msg } : null)
            }
            onImportSuccess={setRangeImportedModel}
            onImportError={setRangeImportError}
            onUpdateSegment={updateRangeImportedSegment}
            onSpawnImportedTarget={() => spawnRangeTarget('imported-glb')}
            onClearImported={clearRangeImportedModel}
            onCloseSingleItemEdit={() => setSingleItemEditMode('none')}
          />
        </div>
      </div>
    </>
  );
}
