import { useSyncExternalStore } from 'react';
import { recordHudHit } from '../hud/hudSignals';
import type { DestructibleTargetHandle } from '../junk/DestructibleTarget';
import type { ImportedGlbAsset } from '../junk/junkImporter';
import type { DestructibleTargetSnapshot } from '../junk/targetHelpers';
import type {
  CanLodMode,
  DestructibleTargetSpec,
  ImportedJunkSegment,
  ProceduralLabelId,
} from '../types/junk';
import type { FingerPoseTag, WeaponArchetypeId } from '../types/posing';
import type { SingleItemEditMode } from '../types/range';
import { createInitialTargets } from './rangeSeedTargets';
import { registerTelemetryTargetsReader } from './rangeTelemetry';

export interface RangeStoreState {
  singleItemEditMode: SingleItemEditMode;
  activeWeapon: WeaponArchetypeId;
  poseTag: FingerPoseTag;
  poseWeight: number;
  wiggleEnabled: boolean;
  wiggleIntensity: number;
  canLodMode: CanLodMode;
  labelId: ProceduralLabelId;
  customLabelUrl: string | null;
  customLabelName: string | null;
  shatterPieceCount: number;
  importedAsset: ImportedGlbAsset | null;
  importedName: string | null;
  importedSegments: ImportedJunkSegment[];
  importedError: string | null;
  targets: DestructibleTargetSpec[];
  resetSeq: number;
}

export const rangeHandles = new Map<string, DestructibleTargetHandle>();
export const rangeSnapshots = new Map<string, DestructibleTargetSnapshot>();
export const retainedLabelBlobUrls = new Set<string>();

let state: RangeStoreState = {
  singleItemEditMode: 'none',
  activeWeapon: 'pistol',
  poseTag: 'pistol_grip',
  poseWeight: 1,
  wiggleEnabled: true,
  wiggleIntensity: 0.65,
  canLodMode: 'auto',
  labelId: 'target',
  customLabelUrl: null,
  customLabelName: null,
  shatterPieceCount: 6,
  importedAsset: null,
  importedName: null,
  importedSegments: [],
  importedError: null,
  targets: createInitialTargets(),
  resetSeq: 0,
};

const listeners = new Set<() => void>();

export function getRangeStore(): RangeStoreState {
  return state;
}

export function updateRangeStore(
  updater: (prev: RangeStoreState) => RangeStoreState
): void {
  state = updater(state);
  listeners.forEach((fn) => fn());
}

registerTelemetryTargetsReader(() =>
  state.targets
    .map(
      (spec) =>
        rangeHandles.get(spec.id)?.getSnapshot() ?? rangeSnapshots.get(spec.id)
    )
    .filter((item): item is DestructibleTargetSnapshot => Boolean(item))
);

export function useRangeState(): RangeStoreState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state
  );
}

export function registerRangeTargetHandle(
  id: string,
  handle: DestructibleTargetHandle | null
): void {
  if (handle) {
    rangeHandles.set(id, handle);
    rangeSnapshots.set(id, handle.getSnapshot());
  } else {
    const prev = rangeHandles.get(id);
    if (prev) rangeSnapshots.set(id, prev.getSnapshot());
    rangeHandles.delete(id);
  }
}

export function getRangeTargetHandle(id: string): DestructibleTargetHandle | null {
  return rangeHandles.get(id) ?? null;
}

export function notifyRangeTargetSnapshot(snap: DestructibleTargetSnapshot): void {
  rangeSnapshots.set(snap.id, snap);
}

export function notifyRangeTargetHit(shattered: boolean): void {
  recordHudHit(shattered);
}
