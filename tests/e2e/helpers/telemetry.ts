import { expect, type Page } from '@playwright/test';

export interface TargetTelemetry {
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
  mode: 'viewer' | 'range';
  singleItemEditMode: 'none' | 'junk-generator' | 'glb-import';
  heroVariant: 'male' | 'female' | 'custom';
  boneCount: number;
  activeAnimation: string | null;
  camera: {
    perspective: 'first' | 'third';
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
    cameraMode: 'first' | 'third';
    poseTag: string;
    lodMode: string;
  };
  weapon: {
    archetype: 'pistol' | 'shotgun' | 'smg' | 'rpg';
    ikAnchorsFound: string[];
  };
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
  targets: TargetTelemetry[];
  activeShardCount: number;
  importedModel: {
    loaded: boolean;
    name: string | null;
    segmentCount: number;
    normalizedExtent: number;
    lastError: string | null;
  };
}

export async function getTelemetry(page: Page): Promise<RangeTelemetrySnapshot> {
  const snap = await page.evaluate(() => {
    const api = (window as unknown as {
      __RANGE_TELEMETRY__?: { getSnapshot?: () => RangeTelemetrySnapshot };
    }).__RANGE_TELEMETRY__;
    return api?.getSnapshot ? api.getSnapshot() : null;
  });
  if (!snap) {
    throw new Error('window.__RANGE_TELEMETRY__.getSnapshot() is unavailable');
  }
  return snap;
}

export async function waitForReady(
  page: Page,
  timeoutMs = 20_000,
): Promise<RangeTelemetrySnapshot> {
  await expect
    .poll(
      async () => {
        try {
          const snap = await getTelemetry(page);
          return snap.ready;
        } catch {
          return false;
        }
      },
      { timeout: timeoutMs, message: 'Timed out waiting for __RANGE_TELEMETRY__.ready' },
    )
    .toBe(true);
  return getTelemetry(page);
}

export async function waitTelemetry(
  page: Page,
  predicate: (snap: RangeTelemetrySnapshot) => boolean,
  message: string,
  timeoutMs = 10_000,
): Promise<RangeTelemetrySnapshot> {
  await expect
    .poll(async () => predicate(await getTelemetry(page)), { timeout: timeoutMs, message })
    .toBe(true);
  return getTelemetry(page);
}

export function vec3Len(v: [number, number, number]): number {
  return Math.hypot(v[0], v[1], v[2]);
}

export function vec3Dist(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
