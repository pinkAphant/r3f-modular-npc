import { test, expect } from '@playwright/test';
import {
  attachErrorTraps,
  waitFrames,
  assertCanvasNonBlank,
  assertRgb555Signature,
  assertReticleContrast,
} from './helpers/webglAssert.ts';
import { getTelemetry, waitForReady, waitTelemetry, vec3Dist, vec3Len } from './helpers/telemetry.ts';
import { createTempFixtures, type TempFixtures } from './helpers/fixtures.ts';
import {
  switchMode,
  moveWASD,
  jump,
  sprint,
  shoot,
  togglePerspective,
  selectWeapon,
  selectPose,
  openJunkEditor,
  openGlbImporter,
  closeSingleItemEdit,
  spawnTarget,
} from './helpers/rangeInput.ts';

let fixtures: TempFixtures;
test.beforeAll(() => { fixtures = createTempFixtures(); });
test.afterAll(() => { fixtures.cleanup(); });

test.describe('Tier 4 — Real-World Shooting Range Scenarios', () => {
  test('T4-S1: Full new-player shooting range session (locomotion, decals, knockback, shatter)', async ({ page }) => {
    const trap = await attachErrorTraps(page);
    await page.goto('/');
    await waitForReady(page);
    await switchMode(page, 'range');
    const png = await page.locator('canvas').screenshot();
    assertCanvasNonBlank(png);
    assertRgb555Signature(png);
    assertReticleContrast(png);

    const p0 = (await getTelemetry(page)).player.position;
    await moveWASD(page, 'KeyW', 300);
    await moveWASD(page, 'KeyA', 200);
    await moveWASD(page, 'KeyD', 200);
    await jump(page, 140);
    await waitTelemetry(page, (s) => s.player.grounded, 'Player did not land');
    expect(vec3Dist(p0, (await getTelemetry(page)).player.position)).toBeGreaterThan(0.15);

    const canId = await spawnTarget(page, 'tin-can');
    await page.getByTestId('label-select').selectOption('tris-soda');
    await selectWeapon(page, 'pistol');
    await shoot(page, 1);
    await waitTelemetry(page, (s) => (s.targets.find((t) => t.id === canId)?.decalCount ?? 0) >= 1, 'Can decal missing');
    for (let i = 0; i < 6; i++) {
      if (!(await getTelemetry(page)).targets.find((t) => t.id === canId)?.alive) break;
      await shoot(page, 1);
      await page.waitForTimeout(80);
    }
    await waitTelemetry(page, (s) => s.targets.find((t) => t.id === canId)?.alive === false, 'Can did not shatter');

    const bottleId = await spawnTarget(page, 'glass-bottle');
    await selectWeapon(page, 'shotgun');
    await shoot(page, 2, 100);
    const finalSnap = await waitTelemetry(
      page, (s) => s.targets.find((t) => t.id === bottleId)?.alive === false, 'Bottle did not shatter',
    );
    expect(finalSnap.hud.shatters).toBeGreaterThanOrEqual(2);
    expect(finalSnap.hud.hits).toBeGreaterThanOrEqual(2);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T4-S2: Custom branded target creation (3-gon -> 12-gon, Garys Beans, PNG upload) & shatter', async ({ page }) => {
    const trap = await attachErrorTraps(page);
    await page.goto('/');
    await waitForReady(page);
    await switchMode(page, 'range');
    await openJunkEditor(page);
    await expect(page.getByTestId('weapon-switcher')).toHaveCount(0);

    const canId = await spawnTarget(page, 'tin-can');
    await page.getByTestId('can-lod-select').selectOption('3-gon');
    await page.getByTestId('can-lod-select').selectOption('12-gon');
    await page.getByTestId('label-select').selectOption('garys-beans');
    await page.getByTestId('label-upload-input').setInputFiles(fixtures.validPngPath);
    await waitTelemetry(page, (s) => Boolean(s.targets.find((t) => t.id === canId)?.customLabelLoaded), 'Upload missing');

    await closeSingleItemEdit(page);
    await expect(page.getByTestId('weapon-switcher')).toBeVisible();
    await selectWeapon(page, 'shotgun');
    await shoot(page, 3, 90);
    await waitTelemetry(page, (s) => s.targets.find((t) => t.id === canId)?.alive === false, 'Custom can intact');
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T4-S3: Armory GLB single-item import, invalid rejection, deploy & shatter', async ({ page }) => {
    const trap = await attachErrorTraps(page);
    await page.goto('/');
    await waitForReady(page);
    await switchMode(page, 'range');
    await openGlbImporter(page);
    await expect(page.getByTestId('weapon-switcher')).toHaveCount(0);

    await page.getByTestId('glb-import-input').setInputFiles(fixtures.corruptGlbPath);
    await waitTelemetry(page, (s) => Boolean(s.importedModel.lastError), 'Corrupt GLB not rejected');
    await expect(page.getByTestId('status-banner')).toBeVisible();

    await page.getByTestId('glb-import-input').setInputFiles(fixtures.validMultiMeshGlbPath);
    const loaded = await waitTelemetry(page, (s) => s.importedModel.loaded, 'Valid GLB did not load');
    expect(loaded.importedModel.segmentCount).toBeGreaterThanOrEqual(2);
    await closeSingleItemEdit(page);

    const target = await waitTelemetry(
      page, (s) => s.targets.some((t) => t.alive && t.kind === 'imported-glb'), 'Imported target not deployed',
    );
    const id = target.targets.find((t) => t.alive && t.kind === 'imported-glb')!.id;
    await shoot(page, 3, 90);
    const after = await waitTelemetry(
      page, (s) => s.targets.find((t) => t.id === id)?.alive === false || s.hud.hits >= 1, 'Imported target not hit',
    );
    expect(after.activeShardCount + after.hud.hits).toBeGreaterThanOrEqual(1);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T4-S4: 3rd-person character rig, fingers, wiggle & 4-weapon cycle showcase', async ({ page }) => {
    const trap = await attachErrorTraps(page);
    await page.goto('/');
    await waitForReady(page);
    await switchMode(page, 'range');
    expect(await togglePerspective(page)).toBe('third');
    await waitTelemetry(page, (s) => s.camera.heroInFrame, 'Hero not in 3rd-person frame');

    const observedPoses = new Set<string>();
    for (const weapon of ['pistol', 'shotgun', 'smg', 'rpg'] as const) {
      await selectWeapon(page, weapon);
      await sprint(page, 'KeyD', 200);
      await jump(page, 120);
      await shoot(page, 1);
      const snap = await getTelemetry(page);
      observedPoses.add(snap.posing.activeTag);
      expect(snap.wiggle.hasNaN).toBe(false);
      expect(snap.wiggle.maxTransformDrift).toBeLessThan(5.0);
    }
    expect(observedPoses.size).toBeGreaterThanOrEqual(2);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T4-S5: Viewer male/female inspection -> range goofy-emoji shot -> return cleanly', async ({ page }) => {
    const trap = await attachErrorTraps(page);
    await page.goto('/');
    await waitForReady(page);
    await switchMode(page, 'viewer');
    await page.getByTestId('char-male').click();
    await waitTelemetry(page, (s) => s.heroVariant === 'male', 'Male not loaded');
    await page.getByTestId('char-female').click();
    await waitTelemetry(page, (s) => s.heroVariant === 'female', 'Female not loaded');
    await selectPose(page, 'open_palm');
    await selectPose(page, 'trigger_ready');

    await switchMode(page, 'range');
    const canId = await spawnTarget(page, 'tin-can');
    await page.getByTestId('label-select').selectOption('goofy-emoji');
    await shoot(page, 1);
    await waitTelemetry(page, (s) => s.hud.hits >= 1 || s.targets.find((t) => t.id === canId)?.decalCount === 1, 'No hit');
    await switchMode(page, 'viewer');
    assertCanvasNonBlank(await page.locator('canvas').screenshot());
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T4-S6: Stress & recovery session (rapid fire, LOD/camera switch, blur, Escape, reload)', async ({ page }) => {
    const trap = await attachErrorTraps(page);
    await page.goto('/');
    await waitForReady(page);
    await switchMode(page, 'range');
    await spawnTarget(page, 'tin-can');
    await spawnTarget(page, 'glass-bottle');
    await shoot(page, 8, 45);
    await page.getByTestId('can-lod-select').selectOption('3-gon');
    await togglePerspective(page);
    await sprint(page, 'KeyA', 250);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.keyboard.press('Escape');
    await page.keyboard.press('KeyR');
    await waitFrames(page, 4);
    const snap = await getTelemetry(page);
    expect(snap.wiggle.hasNaN).toBe(false);
    expect(vec3Len(snap.player.position)).toBeLessThan(150);
    expect(snap.hud.ammo).toBeGreaterThan(0);
    await trap.assertZeroErrors();
    trap.dispose();
  });
});
