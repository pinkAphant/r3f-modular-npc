import type { DestructibleTargetSnapshot } from '../junk/targetHelpers';
import {
  activePoseTagSignal,
  activeWeaponSignal,
  ammoSignal,
  hitsSignal,
  hudIsolatedSignal,
  hudMountedSignal,
  rawLodModeSignal,
  rawPerspectiveSignal,
  shattersSignal,
  shotsFiredSignal,
} from '../hud/hudSignals';
import type { AppMode, CameraPerspective, SingleItemEditMode } from '../types/range';
import type { FingerPoseTag } from '../types/posing';
import type {
  RangeTelemetrySnapshot,
  RangeTelemetryTarget,
  TelemetryHeroVariant,
} from '../types/telemetry';

export type { RangeTelemetrySnapshot, RangeTelemetryTarget, TelemetryHeroVariant };

interface TelemetryStore {
  ready: boolean;
  mode: AppMode;
  singleItemEditMode: SingleItemEditMode;
  heroVariant: TelemetryHeroVariant;
  boneCount: number;
  activeAnimation: string | null;
  camera: RangeTelemetrySnapshot['camera'];
  player: RangeTelemetrySnapshot['player'];
  dreamcastPass: RangeTelemetrySnapshot['dreamcastPass'];
  ikAnchorsFound: string[];
  appliedPoseTag: FingerPoseTag;
  fingerEulerRad: Record<string, [number, number, number]>;
  wiggle: RangeTelemetrySnapshot['wiggle'];
  importedModel: RangeTelemetrySnapshot['importedModel'];
}

const store: TelemetryStore = {
  ready: false,
  mode: 'range',
  singleItemEditMode: 'none',
  heroVariant: 'custom',
  boneCount: 0,
  activeAnimation: null,
  camera: { perspective: 'first', yaw: 0, pitch: 0, heroInFrame: false },
  player: { position: [0, 0.95, 2.5], velocity: [0, 0, 0], grounded: false },
  dreamcastPass: {
    enabled: false,
    pixelSnapWidth: 0,
    pixelSnapHeight: 0,
    rgb555Enabled: false,
  },
  ikAnchorsFound: [],
  appliedPoseTag: 'pistol_grip',
  fingerEulerRad: {},
  wiggle: {
    activeBoneCount: 0,
    intensity: 0.65,
    hasNaN: false,
    maxTransformDrift: 0,
    velocityMagnitude: 0,
  },
  importedModel: {
    loaded: false,
    name: null,
    segmentCount: 0,
    normalizedExtent: 0,
    lastError: null,
  },
};

let targetsReader: (() => DestructibleTargetSnapshot[]) | null = null;

export function registerTelemetryTargetsReader(
  reader: (() => DestructibleTargetSnapshot[]) | null
): void {
  targetsReader = reader;
}

export function setTelemetryReady(ready: boolean): void {
  store.ready = ready;
}

export function setTelemetryApp(
  mode: AppMode,
  singleItemEditMode: SingleItemEditMode
): void {
  store.mode = mode;
  store.singleItemEditMode = singleItemEditMode;
}

export function setTelemetryMode(mode: AppMode): void {
  store.mode = mode;
}

export function setTelemetrySingleItemEditMode(
  singleItemEditMode: SingleItemEditMode
): void {
  store.singleItemEditMode = singleItemEditMode;
}

export function setTelemetryHero(
  heroVariant: TelemetryHeroVariant,
  boneCount: number,
  activeAnimation: string | null
): void {
  store.heroVariant = heroVariant;
  store.boneCount = boneCount;
  store.activeAnimation = activeAnimation;
}

export function setTelemetryCamera(
  perspective: CameraPerspective,
  yaw: number,
  pitch: number,
  heroInFrame: boolean
): void {
  store.camera = { perspective, yaw, pitch, heroInFrame };
}

export function setTelemetryPlayer(
  position: [number, number, number],
  velocity: [number, number, number],
  grounded: boolean
): void {
  store.player = { position: [...position], velocity: [...velocity], grounded };
}

export function getTelemetryPlayerPlanar(): [number, number] {
  return [store.player.position[0], store.player.velocity[0]];
}

export function setTelemetryDreamcast(
  pass: RangeTelemetrySnapshot['dreamcastPass']
): void {
  store.dreamcastPass = { ...pass };
}

export function setTelemetryWeaponAnchors(ikAnchorsFound: string[]): void {
  store.ikAnchorsFound = [...ikAnchorsFound];
}

export function setTelemetryAppliedPoseTag(tag: FingerPoseTag): void {
  store.appliedPoseTag = tag;
}

export function setTelemetryRigFrame(
  ikAnchorsFound: string[],
  fingerEulerRad: Record<string, [number, number, number]>,
  wiggle: RangeTelemetrySnapshot['wiggle'],
  appliedPoseTag?: FingerPoseTag
): void {
  if (ikAnchorsFound.length > 0) store.ikAnchorsFound = [...ikAnchorsFound];
  if (appliedPoseTag) store.appliedPoseTag = appliedPoseTag;
  const cloned: Record<string, [number, number, number]> = {};
  for (const [k, v] of Object.entries(fingerEulerRad)) cloned[k] = [v[0], v[1], v[2]];
  store.fingerEulerRad = cloned;
  store.wiggle = { ...wiggle };
}

export function setTelemetryImported(
  imported: RangeTelemetrySnapshot['importedModel']
): void {
  store.importedModel = { ...imported };
}

export function getRangeTelemetrySnapshot(): RangeTelemetrySnapshot {
  const rawTargets = targetsReader ? targetsReader() : [];
  let activeShardCount = 0;
  const targets: RangeTelemetryTarget[] = rawTargets.map((t) => {
    activeShardCount += t.activeShardCount;
    return {
      id: t.id,
      kind: t.kind,
      lodMode: t.lodMode,
      triCount: t.triCount,
      labelId: t.labelId,
      customLabelLoaded: t.customLabelLoaded,
      materialTransparent: t.materialTransparent,
      opacity: t.opacity,
      hp: t.hp,
      alive: t.alive,
      decalCount: t.decalCount,
      position: [...t.position],
      linearVelocity: [...t.linearVelocity],
    };
  });

  const clonedEulers: Record<string, [number, number, number]> = {};
  for (const [k, v] of Object.entries(store.fingerEulerRad)) {
    clonedEulers[k] = [v[0], v[1], v[2]];
  }

  return {
    ready: store.ready,
    mode: store.mode,
    singleItemEditMode: store.singleItemEditMode,
    heroVariant: store.heroVariant,
    boneCount: store.boneCount,
    activeAnimation: store.activeAnimation,
    camera: { ...store.camera },
    player: {
      position: [...store.player.position],
      velocity: [...store.player.velocity],
      grounded: store.player.grounded,
    },
    dreamcastPass: { ...store.dreamcastPass },
    hud: {
      mounted: hudMountedSignal.value,
      isolatedFromPostProcess: hudIsolatedSignal.value,
      ammo: ammoSignal.value,
      shotsFired: shotsFiredSignal.value,
      hits: hitsSignal.value,
      shatters: shattersSignal.value,
      cameraMode: rawPerspectiveSignal.value,
      poseTag: activePoseTagSignal.value,
      lodMode: rawLodModeSignal.value,
    },
    weapon: {
      archetype: activeWeaponSignal.value,
      ikAnchorsFound: [...store.ikAnchorsFound],
    },
    posing: { activeTag: store.appliedPoseTag, fingerEulerRad: clonedEulers },
    wiggle: { ...store.wiggle },
    targets,
    activeShardCount,
    importedModel: { ...store.importedModel },
  };
}

export function installRangeTelemetry(): void {
  if (typeof window === 'undefined') return;
  (
    window as unknown as {
      __RANGE_TELEMETRY__?: { getSnapshot: () => RangeTelemetrySnapshot };
    }
  ).__RANGE_TELEMETRY__ = { getSnapshot: getRangeTelemetrySnapshot };
}
