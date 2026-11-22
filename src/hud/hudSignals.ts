import { batch, computed, signal } from '@preact/signals-core';
import type { EcctrlAnimationState } from '@pinkaphant/ecctrl/animation';
import type { CanLodMode } from '../types/junk';
import type { CameraPerspective, DreamcastConfig } from '../types/range';
import type { FingerPoseTag, WeaponArchetypeId } from '../types/posing';

export type HudPlayerState = 'IDLE' | 'WALK' | 'RUN' | 'JUMP';

export const ammoSignal = signal<number>(12);
export const maxAmmoSignal = signal<number>(12);
export const shotsFiredSignal = signal<number>(0);
export const hitsSignal = signal<number>(0);
export const shattersSignal = signal<number>(0);
export const hudMountedSignal = signal<boolean>(false);
export const hudIsolatedSignal = signal<boolean>(false);
export const rawPerspectiveSignal = signal<CameraPerspective>('first');
export const cameraModeSignal = signal<'1ST PERSON' | '3RD PERSON'>('1ST PERSON');
export const activeWeaponSignal = signal<WeaponArchetypeId>('pistol');
export const activePoseTagSignal = signal<FingerPoseTag>('pistol_grip');
export const rawLodModeSignal = signal<CanLodMode>('auto');
export const lodModeSignal = signal<'AUTO' | '3-GON' | '12-GON'>('AUTO');
export const dreamcastEnabledSignal = signal<boolean>(true);
export const dreamcastPixelSnapSignal = signal<boolean>(true);
export const dreamcastRgb555Signal = signal<boolean>(true);
export const pointerLockedSignal = signal<boolean>(false);
export const playerStateSignal = signal<HudPlayerState>('IDLE');

export const ammoDisplaySignal = computed(
  () => `${ammoSignal.value} / ${maxAmmoSignal.value}`
);
export const hitsDisplaySignal = computed(() => `HITS ${hitsSignal.value}`);
export const shattersDisplaySignal = computed(
  () => `SHATTERS ${shattersSignal.value}`
);
export const shaderBadgeSignal = computed(() => {
  if (!dreamcastEnabledSignal.value) return 'NATIVE DPR';
  const snap = dreamcastPixelSnapSignal.value ? '480P' : 'FULL';
  const color = dreamcastRgb555Signal.value ? 'RGB555' : '24BIT';
  return `DC ${snap} | ${color}`;
});
export const poseDisplaySignal = computed(
  () => `POSE ${activePoseTagSignal.value.toUpperCase()}`
);
export const lodDisplaySignal = computed(() => `CAN LOD ${lodModeSignal.value}`);
export const pointerPromptDisplaySignal = computed<'flex' | 'none'>(() =>
  pointerLockedSignal.value ? 'none' : 'flex'
);

export function setHudPerspective(perspective: CameraPerspective): void {
  const next = perspective === 'first' ? '1ST PERSON' : '3RD PERSON';
  batch(() => {
    if (rawPerspectiveSignal.value !== perspective) {
      rawPerspectiveSignal.value = perspective;
    }
    if (cameraModeSignal.value !== next) {
      cameraModeSignal.value = next;
    }
  });
}

export function setHudDreamcastConfig(config: DreamcastConfig): void {
  batch(() => {
    if (dreamcastEnabledSignal.value !== config.enabled) {
      dreamcastEnabledSignal.value = config.enabled;
    }
    if (dreamcastPixelSnapSignal.value !== config.pixelSnap) {
      dreamcastPixelSnapSignal.value = config.pixelSnap;
    }
    if (dreamcastRgb555Signal.value !== config.rgb555) {
      dreamcastRgb555Signal.value = config.rgb555;
    }
  });
}

export function setHudMounted(mounted: boolean): void {
  if (hudMountedSignal.value !== mounted) {
    hudMountedSignal.value = mounted;
  }
}

export function setHudIsolated(isolated: boolean): void {
  if (hudIsolatedSignal.value !== isolated) {
    hudIsolatedSignal.value = isolated;
  }
}

export function setHudPointerLocked(locked: boolean): void {
  if (pointerLockedSignal.value !== locked) {
    pointerLockedSignal.value = locked;
  }
}

export function setHudPlayerState(animState: EcctrlAnimationState): void {
  const mapped: HudPlayerState =
    animState === 'WALK'
      ? 'WALK'
      : animState === 'RUN'
      ? 'RUN'
      : animState.startsWith('JUMP')
      ? 'JUMP'
      : 'IDLE';
  if (playerStateSignal.value !== mapped) {
    playerStateSignal.value = mapped;
  }
}

export function setHudPoseTag(tag: FingerPoseTag): void {
  if (activePoseTagSignal.value !== tag) {
    activePoseTagSignal.value = tag;
  }
}

export function setHudLodMode(mode: CanLodMode | 'AUTO' | '3-GON' | '12-GON'): void {
  const raw = mode.toLowerCase() as CanLodMode;
  const upper = mode.toUpperCase() as 'AUTO' | '3-GON' | '12-GON';
  batch(() => {
    if (rawLodModeSignal.value !== raw) rawLodModeSignal.value = raw;
    if (lodModeSignal.value !== upper) lodModeSignal.value = upper;
  });
}

export function setHudWeapon(
  archetype: WeaponArchetypeId,
  maxAmmo: number,
  poseTag?: FingerPoseTag
): void {
  batch(() => {
    activeWeaponSignal.value = archetype;
    maxAmmoSignal.value = maxAmmo;
    ammoSignal.value = maxAmmo;
    if (poseTag) activePoseTagSignal.value = poseTag;
  });
}

export function recordHudShot(): boolean {
  if (ammoSignal.value <= 0) return false;
  batch(() => {
    ammoSignal.value = Math.max(0, ammoSignal.value - 1);
    shotsFiredSignal.value = shotsFiredSignal.value + 1;
  });
  return true;
}

export function reloadHudAmmo(): void {
  ammoSignal.value = maxAmmoSignal.value;
}

export function recordHudHit(shattered: boolean): void {
  batch(() => {
    hitsSignal.value = hitsSignal.value + 1;
    if (shattered) {
      shattersSignal.value = shattersSignal.value + 1;
    }
  });
}

export function resetHudTelemetry(): void {
  batch(() => {
    ammoSignal.value = maxAmmoSignal.value;
    shotsFiredSignal.value = 0;
    hitsSignal.value = 0;
    shattersSignal.value = 0;
  });
}
