import type { FingerPoseTag, WeaponArchetypeId } from './posing';

export type AppMode = 'viewer' | 'range';

export type CameraPerspective = 'first' | 'third';

export type SingleItemEditMode = 'none' | 'junk-generator' | 'glb-import';

export interface DreamcastConfig {
  enabled: boolean;
  /** Target internal vertical resolution; width scales by canvas aspect (e.g. 640x480 at 4:3). */
  virtualHeight: number;
  /** Snap screen/render sampling to integer virtual texels (clean Dreamcast pixel snap). */
  pixelSnap: boolean;
  /** Quantize color channels to 5-bit (31 levels) with 4x4 Bayer ordered dithering. */
  rgb555: boolean;
  /** Dither amplitude in [0, 1]; default ~0.85 for smooth 5-bit gradients without noise. */
  ditherStrength: number;
}

export interface RangeHudSnapshot {
  ammo: number;
  maxAmmo: number;
  hits: number;
  shatters: number;
  perspective: CameraPerspective;
  activePoseTag: FingerPoseTag;
  activeWeapon: WeaponArchetypeId;
  pointerLocked: boolean;
  canLodLabel: string;
}

export interface BallisticHitEvent {
  targetId: string;
  point: [number, number, number];
  normal: [number, number, number];
  impulse: [number, number, number];
  distance: number;
}
