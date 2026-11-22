import { test, expect, type Page } from '@playwright/test';
import { attachErrorTraps, waitFrames, measureFrameDiff } from './helpers/webglAssert.ts';
import { getTelemetry, waitForReady, waitTelemetry } from './helpers/telemetry.ts';
import { createTempFixtures, type TempFixtures } from './helpers/fixtures.ts';
import {
  switchMode, sprint, selectWeapon, selectPose, openGlbImporter, spawnTarget,
} from './helpers/rangeInput.ts';

let fixtures: TempFixtures;
test.beforeAll(() => { fixtures = createTempFixtures(); });
test.afterAll(() => { fixtures.cleanup(); });

async function bootRange(page: Page) {
  const trap = await attachErrorTraps(page);
  await page.goto('/');
  await waitForReady(page);
  await switchMode(page, 'range');
  await waitFrames(page, 3);
  return trap;
}

test.describe('Tier 1 — Wiggle, Finger Posing & Procedural Junk', () => {
  test('T1-F1: wiggle secondary bones update during motion without NaN or drift', async ({ page }) => {
    const trap = await bootRange(page);
    await sprint(page, 'KeyD', 450);
    for (let i = 0; i < 6; i++) {
      await waitFrames(page, 2);
      const { wiggle } = await getTelemetry(page);
      expect(wiggle.activeBoneCount).toBeGreaterThanOrEqual(1);
      expect(wiggle.hasNaN).toBe(false);
      expect(wiggle.maxTransformDrift).toBeLessThan(5.0);
    }
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-F2: wiggle velocity rises on sprint and decays smoothly at rest', async ({ page }) => {
    const trap = await bootRange(page);
    await sprint(page, 'KeyW', 450);
    const peakVel = (await getTelemetry(page)).wiggle.velocityMagnitude;
    expect(peakVel).toBeGreaterThan(0);
    await page.waitForTimeout(900);
    const settled = await getTelemetry(page);
    expect(settled.wiggle.hasNaN).toBe(false);
    expect(settled.wiggle.velocityMagnitude).toBeLessThan(peakVel * 0.6);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-F3: Tagged finger-posing drives distinct finite Mixamo finger Euler angles', async ({ page }) => {
    const trap = await bootRange(page);
    await selectPose(page, 'relaxed');
    const relaxed = (await getTelemetry(page)).posing.fingerEulerRad;
    await selectPose(page, 'pistol_grip');
    const grip = (await getTelemetry(page)).posing.fingerEulerRad;
    const keys = Object.keys(grip);
    expect(keys.length).toBeGreaterThanOrEqual(3);
    const maxDiff = Math.max(...keys.flatMap((k) => [0, 1, 2].map((i) => {
      const val = grip[k][i];
      expect(Number.isFinite(val)).toBe(true);
      return Math.abs(val - (relaxed[k]?.[i] ?? 0));
    })));
    expect(maxDiff).toBeGreaterThan(0.15);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-F4: trigger_ready pose differentiates Index1 from Middle1/Ring1 curl', async ({ page }) => {
    const trap = await bootRange(page);
    await selectPose(page, 'trigger_ready');
    const eulers = (await getTelemetry(page)).posing.fingerEulerRad;
    const idx = eulers.RightHandIndex1;
    const mid = eulers.RightHandMiddle1;
    expect(idx).toBeDefined();
    expect(mid).toBeDefined();
    expect(Math.hypot(idx[0] - mid[0], idx[1] - mid[1], idx[2] - mid[2])).toBeGreaterThan(0.1);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-F5: Weapon mounting extracts IK anchors and updates active finger pose tag', async ({ page }) => {
    const trap = await bootRange(page);
    await selectWeapon(page, 'pistol');
    const pSnap = await getTelemetry(page);
    expect(pSnap.weapon.ikAnchorsFound).toEqual(expect.arrayContaining(['IK_Palm_Primary', 'Socket_Muzzle']));
    const pistolTag = pSnap.posing.activeTag;
    await selectWeapon(page, 'rpg');
    const rSnap = await getTelemetry(page);
    expect(rSnap.weapon.archetype).toBe('rpg');
    expect(rSnap.posing.activeTag).not.toBe(pistolTag);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-G1: Procedural tin can switches 3-gon LOD vs 12-gon close-up geometry', async ({ page }) => {
    const trap = await bootRange(page);
    const id = await spawnTarget(page, 'tin-can');
    await page.getByTestId('can-lod-select').selectOption('3-gon');
    const low = await waitTelemetry(
      page, (s) => s.targets.find((t) => t.id === id)?.lodMode === '3-gon', 'Can did not switch to 3-gon',
    );
    const lowTris = low.targets.find((t) => t.id === id)!.triCount;
    const lowPng = await page.locator('canvas').screenshot();
    await page.getByTestId('can-lod-select').selectOption('12-gon');
    const high = await waitTelemetry(
      page, (s) => s.targets.find((t) => t.id === id)?.lodMode === '12-gon', 'Can did not switch to 12-gon',
    );
    const highTris = high.targets.find((t) => t.id === id)!.triCount;
    expect(highTris).toBeGreaterThan(lowTris);
    expect(lowTris).toBeLessThanOrEqual(36);
    expect(highTris).toBeGreaterThanOrEqual(48);
    expect(measureFrameDiff(lowPng, await page.locator('canvas').screenshot())).toBeGreaterThan(0.0005);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-G2: Procedural glass bottle spawns with transparent material', async ({ page }) => {
    const trap = await bootRange(page);
    const id = await spawnTarget(page, 'glass-bottle');
    const target = (await getTelemetry(page)).targets.find((t) => t.id === id)!;
    expect(target.kind).toBe('glass-bottle');
    expect(target.materialTransparent).toBe(true);
    expect(target.opacity).toBeLessThan(1.0);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-G3: All 4 procedural albedo labels apply and render distinct visuals', async ({ page }) => {
    const trap = await bootRange(page);
    const id = await spawnTarget(page, 'tin-can');
    const shots: Uint8Array[] = [];
    for (const label of ['target', 'goofy-emoji', 'tris-soda', 'garys-beans'] as const) {
      await page.getByTestId('label-select').selectOption(label);
      await waitTelemetry(
        page, (s) => s.targets.find((t) => t.id === id)?.labelId === label, `Label ${label} not applied`,
      );
      await waitFrames(page, 3);
      shots.push(await page.locator('canvas').screenshot());
    }
    expect(measureFrameDiff(shots[0], shots[1])).toBeGreaterThan(0.0005);
    expect(measureFrameDiff(shots[2], shots[3])).toBeGreaterThan(0.0005);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-G4: Custom PNG upload applies custom albedo label to junk target', async ({ page }) => {
    const trap = await bootRange(page);
    const id = await spawnTarget(page, 'tin-can');
    await page.getByTestId('label-upload-input').setInputFiles(fixtures.validPngPath);
    const snap = await waitTelemetry(
      page, (s) => Boolean(s.targets.find((t) => t.id === id)?.customLabelLoaded), 'Custom label did not load',
    );
    expect(snap.targets.find((t) => t.id === id)?.labelId).toBe('custom');
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-G5: Armory-style valid multi-mesh GLB upload normalizes scale and counts segments', async ({ page }) => {
    const trap = await bootRange(page);
    await openGlbImporter(page);
    await page.getByTestId('glb-import-input').setInputFiles(fixtures.validMultiMeshGlbPath);
    const snap = await waitTelemetry(page, (s) => s.importedModel.loaded, 'Valid GLB failed to import');
    expect(snap.importedModel.segmentCount).toBeGreaterThanOrEqual(2);
    expect(snap.importedModel.normalizedExtent).toBeLessThanOrEqual(2.5);
    expect(snap.importedModel.lastError).toBeNull();
    await trap.assertZeroErrors();
    trap.dispose();
  });
});
