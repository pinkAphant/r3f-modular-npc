import { useSyncExternalStore } from 'react';
import type { FingerPoseTag, WeaponArchetypeId } from '../types/posing';
import { poseTagForWeapon } from './fingerPoseSchema';
import type { WiggleStats } from './wiggleRig';

export type ViewerWeaponOption = 'none' | WeaponArchetypeId;

export interface ViewerTelemetry {
  boneCount: number;
  wiggle: WiggleStats;
  fingerEulerRad: Record<string, [number, number, number]>;
  ikAnchorsFound: string[];
}

export interface ViewerStateSnapshot {
  poseTag: FingerPoseTag;
  poseWeight: number;
  wiggleEnabled: boolean;
  wiggleIntensity: number;
  weaponArchetype: ViewerWeaponOption;
  telemetry: ViewerTelemetry;
}

const DEFAULT_WIGGLE_STATS: WiggleStats = {
  activeBoneCount: 0,
  intensity: 0.65,
  hasNaN: false,
  maxTransformDrift: 0,
  velocityMagnitude: 0,
};

let telemetry: ViewerTelemetry = {
  boneCount: 0,
  wiggle: DEFAULT_WIGGLE_STATS,
  fingerEulerRad: {},
  ikAnchorsFound: [],
};

let state: ViewerStateSnapshot = {
  poseTag: 'relaxed',
  poseWeight: 1,
  wiggleEnabled: true,
  wiggleIntensity: 0.65,
  weaponArchetype: 'none',
  telemetry,
};

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeViewerState(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getViewerState(): ViewerStateSnapshot {
  return state;
}

export function useViewerState(): ViewerStateSnapshot {
  return useSyncExternalStore(subscribeViewerState, getViewerState, getViewerState);
}

export function setViewerPoseTag(poseTag: FingerPoseTag): void {
  if (state.poseTag === poseTag) return;
  state = { ...state, poseTag };
  emit();
}

export function setViewerPoseWeight(poseWeight: number): void {
  const clamped = Math.min(1, Math.max(0, poseWeight));
  if (state.poseWeight === clamped) return;
  state = { ...state, poseWeight: clamped };
  emit();
}

export function setViewerWiggleEnabled(wiggleEnabled: boolean): void {
  if (state.wiggleEnabled === wiggleEnabled) return;
  state = { ...state, wiggleEnabled };
  emit();
}

export function setViewerWiggleIntensity(wiggleIntensity: number): void {
  const clamped = Math.min(1, Math.max(0, wiggleIntensity));
  if (state.wiggleIntensity === clamped) return;
  state = { ...state, wiggleIntensity: clamped };
  emit();
}

export function setViewerWeapon(weaponArchetype: ViewerWeaponOption): void {
  const nextPose =
    weaponArchetype === 'none'
      ? state.poseTag
      : poseTagForWeapon(weaponArchetype);
  state = {
    ...state,
    weaponArchetype,
    poseTag: nextPose,
  };
  emit();
}

export function getViewerTelemetry(): ViewerTelemetry {
  return telemetry;
}

export function updateViewerTelemetry(patch: Partial<ViewerTelemetry>): void {
  telemetry = { ...telemetry, ...patch };
  state.telemetry = telemetry;
}
