import type { WeaponArchetypeId } from './posing';
import type { AppMode, CameraPerspective, SingleItemEditMode } from './range';

export type TelemetryHeroVariant = 'male' | 'female' | 'custom';

export interface RangeTelemetryTarget {
  id: string;
  kind: 'tin-can' | 'glass-bottle' | 'imported-glb';
  lodMode: 'auto' | '3-gon' | '12-gon';
  triCount: number;
  labelId: 'target' | 'goofy-emoji' | 'tris-soda' | 'garys-beans' | 'custom';
  customLabelLoaded: boolean;
  materialTransparent: boolean;
  opacity: number;
  hp: number;
  alive: boolean;
  decalCount: number;
  position: [number, number, number];
  linearVelocity: [number, number, number];
}

export interface RangeTelemetrySnapshot {
  ready: boolean;
  mode: AppMode;
  singleItemEditMode: SingleItemEditMode;
  heroVariant: TelemetryHeroVariant;
  boneCount: number;
  activeAnimation: string | null;
  camera: {
    perspective: CameraPerspective;
    yaw: number;
    pitch: number;
    heroInFrame: boolean;
  };
  player: {
    position: [number, number, number];
    velocity: [number, number, number];
    grounded: boolean;
  };
  dreamcastPass: {
    enabled: boolean;
    pixelSnapWidth: number;
    pixelSnapHeight: number;
    rgb555Enabled: boolean;
  };
  hud: {
    mounted: boolean;
    isolatedFromPostProcess: boolean;
    ammo: number;
    shotsFired: number;
    hits: number;
    shatters: number;
    cameraMode: CameraPerspective;
    poseTag: string;
    lodMode: string;
  };
  weapon: { archetype: WeaponArchetypeId; ikAnchorsFound: string[] };
  posing: {
    activeTag: string;
    fingerEulerRad: Record<string, [number, number, number]>;
  };
  wiggle: {
    activeBoneCount: number;
    intensity: number;
    hasNaN: boolean;
    maxTransformDrift: number;
    velocityMagnitude: number;
  };
  targets: RangeTelemetryTarget[];
  activeShardCount: number;
  importedModel: {
    loaded: boolean;
    name: string | null;
    segmentCount: number;
    normalizedExtent: number;
    lastError: string | null;
  };
}
