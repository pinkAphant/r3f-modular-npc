import { resetHudTelemetry, setHudLodMode, setHudWeapon } from '../hud/hudSignals';
import { BOTTLE_HEIGHT, TIN_CAN_HEIGHT } from '../junk/junkGeometry';
import type { ImportedGlbAsset } from '../junk/junkImporter';
import { poseTagForWeapon } from '../npc/fingerPoseSchema';
import type {
  CanLodMode, DestructibleTargetSpec, ImportedJunkSegment, JunkKind, ProceduralLabelId,
} from '../types/junk';
import type { FingerPoseTag, WeaponArchetypeId } from '../types/posing';
import type { SingleItemEditMode } from '../types/range';
import { WEAPON_SPECS } from './ballistics';
import { createInitialTargets, pickShelfSlot, SHELF_TOP_Y } from './rangeSeedTargets';
import {
  getRangeStore, getRangeTargetHandle, notifyRangeTargetHit, notifyRangeTargetSnapshot,
  rangeHandles, rangeSnapshots, registerRangeTargetHandle, retainedLabelBlobUrls,
  updateRangeStore, useRangeState,
} from './rangeStoreCore';
import { setTelemetryAppliedPoseTag, setTelemetryImported } from './rangeTelemetry';

export {
  getRangeTargetHandle, notifyRangeTargetHit, notifyRangeTargetSnapshot,
  registerRangeTargetHandle, useRangeState,
};

let nextTargetSeq = 1;

export function setRangeWeapon(archetype: WeaponArchetypeId): void {
  const nextPose = poseTagForWeapon(archetype);
  updateRangeStore((prev) => ({ ...prev, activeWeapon: archetype, poseTag: nextPose }));
  setTelemetryAppliedPoseTag(nextPose);
  setHudWeapon(archetype, WEAPON_SPECS[archetype].maxAmmo, nextPose);
}

export function setRangePoseTag(poseTag: FingerPoseTag): void {
  updateRangeStore((prev) => ({ ...prev, poseTag }));
}

export function setRangePoseWeight(poseWeight: number): void {
  updateRangeStore((prev) => ({ ...prev, poseWeight: Math.min(1, Math.max(0, poseWeight)) }));
}

export function setRangeWiggleEnabled(wiggleEnabled: boolean): void {
  updateRangeStore((prev) => ({ ...prev, wiggleEnabled }));
}

export function setRangeWiggleIntensity(wiggleIntensity: number): void {
  updateRangeStore((prev) => ({
    ...prev, wiggleIntensity: Math.min(1, Math.max(0, wiggleIntensity)),
  }));
}

export function setRangeCanLod(canLodMode: CanLodMode): void {
  setHudLodMode(canLodMode);
  updateRangeStore((prev) => ({
    ...prev,
    canLodMode,
    targets: prev.targets.map((t) => (t.kind === 'tin-can' ? { ...t, canLodMode } : t)),
  }));
}

export function setRangeLabelId(labelId: ProceduralLabelId): void {
  updateRangeStore((prev) => ({
    ...prev,
    labelId,
    targets: prev.targets.map((t) => (t.kind === 'tin-can' ? { ...t, labelId } : t)),
  }));
}

export function setRangeCustomLabel(url: string, fileName: string): void {
  if (url.startsWith('blob:')) retainedLabelBlobUrls.add(url);
  updateRangeStore((prev) => ({
    ...prev,
    labelId: 'custom',
    customLabelUrl: url,
    customLabelName: fileName,
    targets: prev.targets.map((t) =>
      t.kind === 'tin-can'
        ? { ...t, labelId: 'custom', customAlbedoUrl: url }
        : t
    ),
  }));
}

export function setRangeShatterCount(shatterPieceCount: number): void {
  updateRangeStore((prev) => ({ ...prev, shatterPieceCount }));
}

export function setSingleItemEditMode(singleItemEditMode: SingleItemEditMode): void {
  const cur = getRangeStore();
  if (singleItemEditMode === 'none' && cur.importedAsset) {
    const hasAliveImported = cur.targets.some((t) => {
      if (t.kind !== 'imported-glb') return false;
      const snap = rangeHandles.get(t.id)?.getSnapshot() ?? rangeSnapshots.get(t.id);
      return snap ? snap.alive : true;
    });
    if (!hasAliveImported) spawnRangeTarget('imported-glb');
  }
  updateRangeStore((prev) => ({ ...prev, singleItemEditMode }));
}

export function spawnRangeTarget(kind: JunkKind): string | null {
  const cur = getRangeStore();
  if (kind === 'imported-glb' && !cur.importedAsset) return null;
  const [sx, sz] = pickShelfSlot(cur.targets, rangeHandles, rangeSnapshots);
  const halfH =
    kind === 'tin-can'
      ? TIN_CAN_HEIGHT * 0.5
      : kind === 'glass-bottle'
        ? BOTTLE_HEIGHT * 0.5
        : cur.importedAsset!.halfExtents[1];
  const id = `target-${kind}-${nextTargetSeq++}`;
  const spec: DestructibleTargetSpec = {
    id,
    kind,
    labelId: cur.labelId,
    customAlbedoUrl: cur.customLabelUrl,
    canLodMode: cur.canLodMode,
    position: [sx, SHELF_TOP_Y + halfH + 0.005, sz],
    hp: kind === 'glass-bottle' ? 1 : 3,
    maxHp: kind === 'glass-bottle' ? 1 : 3,
    fragile: kind === 'glass-bottle',
    shatterPieceCount: cur.shatterPieceCount,
    segments: kind === 'imported-glb' ? cur.importedSegments : undefined,
  };
  updateRangeStore((prev) => ({ ...prev, targets: [...prev.targets, spec] }));
  return id;
}

function purgeImportedTargets(targets: DestructibleTargetSpec[]): DestructibleTargetSpec[] {
  for (const t of targets) {
    if (t.kind === 'imported-glb') {
      rangeHandles.delete(t.id);
      rangeSnapshots.delete(t.id);
    }
  }
  return targets.filter((t) => t.kind !== 'imported-glb');
}

function scheduleImportedDispose(asset: ImportedGlbAsset | null | undefined): void {
  if (!asset) return;
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => asset.dispose());
  else asset.dispose();
}

export function setRangeImportedModel(asset: ImportedGlbAsset, fileName: string): void {
  const prevAsset = getRangeStore().importedAsset;
  updateRangeStore((prev) => ({
    ...prev,
    targets: purgeImportedTargets(prev.targets),
    importedAsset: asset,
    importedName: fileName,
    importedSegments: asset.segments,
    importedError: null,
  }));
  scheduleImportedDispose(prevAsset);
  setTelemetryImported({
    loaded: true,
    name: fileName,
    segmentCount: asset.segments.length,
    normalizedExtent: asset.normalizedExtent,
    lastError: null,
  });
  spawnRangeTarget('imported-glb');
}

export function setRangeImportError(message: string): void {
  const cur = getRangeStore();
  updateRangeStore((prev) => ({ ...prev, importedError: message }));
  setTelemetryImported({
    loaded: Boolean(cur.importedAsset),
    name: cur.importedName,
    segmentCount: cur.importedSegments.length,
    normalizedExtent: cur.importedAsset?.normalizedExtent ?? 0,
    lastError: message,
  });
}

export function updateRangeImportedSegment(
  segmentId: string,
  patch: Partial<Pick<ImportedJunkSegment, 'customName' | 'destructible'>>
): void {
  updateRangeStore((prev) => {
    const nextSegs = prev.importedSegments.map((s) =>
      s.segmentId === segmentId ? { ...s, ...patch } : s
    );
    return {
      ...prev,
      importedSegments: nextSegs,
      targets: prev.targets.map((t) =>
        t.kind === 'imported-glb' ? { ...t, segments: nextSegs } : t
      ),
    };
  });
}

export function clearRangeImportedModel(): void {
  const prevAsset = getRangeStore().importedAsset;
  updateRangeStore((prev) => ({
    ...prev,
    importedAsset: null,
    importedName: null,
    importedSegments: [],
    importedError: null,
    targets: purgeImportedTargets(prev.targets),
  }));
  scheduleImportedDispose(prevAsset);
  setTelemetryImported({
    loaded: false,
    name: null,
    segmentCount: 0,
    normalizedExtent: 0,
    lastError: null,
  });
}

export function resetRangeTargets(): void {
  rangeHandles.clear();
  rangeSnapshots.clear();
  const activeUrl = getRangeStore().customLabelUrl;
  for (const url of retainedLabelBlobUrls) {
    if (url !== activeUrl) {
      URL.revokeObjectURL(url);
      retainedLabelBlobUrls.delete(url);
    }
  }
  resetHudTelemetry();
  updateRangeStore((prev) => ({
    ...prev,
    targets: createInitialTargets(),
    resetSeq: prev.resetSeq + 1,
  }));
}
