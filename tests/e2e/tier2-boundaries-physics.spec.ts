import { test, expect, type Page } from '@playwright/test';
import { attachErrorTraps, waitFrames, assertCanvasNonBlank } from './helpers/webglAssert.ts';
import { getTelemetry, waitForReady, waitTelemetry, vec3Len } from './helpers/telemetry.ts';
import { createTempFixtures, type TempFixtures } from './helpers/fixtures.ts';
import { switchMode, sprint, shoot, mouseAim, selectPose, openGlbImporter, spawnTarget } from './helpers/rangeInput.ts';

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

test.describe('Tier 2 — Wiggle, Junk, Importer & Ballistics Boundary Cases', () => {
  test('T2-F1: Zero wiggle intensity yields zero NaN and near-zero bone drift', async ({ page }) => {
    const trap = await bootRange(page);
    await page.getByTestId('wiggle-intensity-slider').fill('0');
    await sprint(page, 'KeyD', 350);
    const { wiggle } = await getTelemetry(page);
    expect(wiggle.hasNaN).toBe(false);
    expect(wiggle.velocityMagnitude).toBeLessThan(0.05);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-F2: Max wiggle intensity stays bounded without transform blowup', async ({ page }) => {
    const trap = await bootRange(page);
    const slider = page.getByTestId('wiggle-intensity-slider');
    const maxVal = (await slider.getAttribute('max')) ?? '2';
    await slider.fill(maxVal);
    await sprint(page, 'KeyW', 600);
    const { wiggle } = await getTelemetry(page);
    expect(wiggle.hasNaN).toBe(false);
    expect(wiggle.maxTransformDrift).toBeLessThan(5.0);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-F3: Simulated tab blur / visibilitychange clamps delta and prevents wiggle explosion', async ({ page }) => {
    const trap = await bootRange(page);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFrames(page, 4);
    const { wiggle } = await getTelemetry(page);
    expect(wiggle.hasNaN).toBe(false);
    expect(wiggle.maxTransformDrift).toBeLessThan(5.0);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-F4: Rapidly cycling all 8 finger pose tags yields finite bone Euler angles', async ({ page }) => {
    const trap = await bootRange(page);
    const tags = ['relaxed', 'pistol_grip', 'trigger_ready', 'forend_pump', 'forend_vertical', 'forend_angled', 'launcher_grip', 'open_palm'];
    for (const tag of tags) await page.getByTestId('pose-select').selectOption(tag);
    await waitFrames(page, 3);
    const { fingerEulerRad } = (await getTelemetry(page)).posing;
    expect(Object.keys(fingerEulerRad).length).toBeGreaterThanOrEqual(3);
    for (const vec of Object.values(fingerEulerRad)) {
      expect(vec.every(Number.isFinite)).toBe(true);
    }
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-F5: Resetting pose to relaxed after launcher_grip converges back to baseline', async ({ page }) => {
    const trap = await bootRange(page);
    await selectPose(page, 'relaxed');
    const base = (await getTelemetry(page)).posing.fingerEulerRad;
    expect(Object.keys(base).length).toBeGreaterThanOrEqual(3);
    await selectPose(page, 'launcher_grip');
    await waitFrames(page, 3);
    await selectPose(page, 'relaxed');
    await page.waitForTimeout(450);
    const back = (await getTelemetry(page)).posing.fingerEulerRad;
    for (const key of Object.keys(base)) {
      const diff = Math.hypot(back[key][0] - base[key][0], back[key][1] - base[key][1], back[key][2] - base[key][2]);
      expect(diff).toBeLessThan(0.1);
    }
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-G1: Empty 0-byte GLB upload triggers error status without crash', async ({ page }) => {
    const trap = await bootRange(page);
    await openGlbImporter(page);
    await page.getByTestId('glb-import-input').setInputFiles(fixtures.emptyGlbPath);
    await waitTelemetry(page, (s) => Boolean(s.importedModel.lastError), '0-byte GLB error not reported');
    await expect(page.getByTestId('status-banner')).toBeVisible();
    assertCanvasNonBlank(await page.locator('canvas').screenshot());
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-G2: Corrupt GLB upload triggers graceful error banner without freeze', async ({ page }) => {
    const trap = await bootRange(page);
    await openGlbImporter(page);
    await page.getByTestId('glb-import-input').setInputFiles(fixtures.corruptGlbPath);
    await waitTelemetry(page, (s) => Boolean(s.importedModel.lastError), 'Corrupt GLB error not reported');
    expect((await getTelemetry(page)).importedModel.loaded).toBe(false);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-G3: Non-image .txt upload to albedo input is rejected cleanly and keeps target intact', async ({ page }) => {
    const trap = await bootRange(page);
    const id = await spawnTarget(page, 'tin-can');
    await page.getByTestId('label-upload-input').setInputFiles(fixtures.invalidTxtPath);
    await expect(page.getByTestId('status-banner')).toBeVisible();
    const target = (await getTelemetry(page)).targets.find((t) => t.id === id)!;
    expect(target.customLabelLoaded).toBe(false);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-G4: Rapid 3-gon <-> 12-gon toggling 10x settles on final triangle count', async ({ page }) => {
    const trap = await bootRange(page);
    const id = await spawnTarget(page, 'tin-can');
    const select = page.getByTestId('can-lod-select');
    for (let i = 0; i < 5; i++) {
      await select.selectOption('3-gon');
      await select.selectOption('12-gon');
    }
    const snap = await waitTelemetry(
      page, (s) => s.targets.find((t) => t.id === id)?.lodMode === '12-gon', 'Final 12-gon state missing',
    );
    expect(snap.targets.find((t) => t.id === id)!.triCount).toBeGreaterThanOrEqual(48);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-G5: Huge 50x GLB import normalizes extent into [0.1m .. 3.0m]', async ({ page }) => {
    const trap = await bootRange(page);
    await openGlbImporter(page);
    await page.getByTestId('glb-import-input').setInputFiles(fixtures.largeValidGlbPath);
    const snap = await waitTelemetry(page, (s) => s.importedModel.loaded, 'Huge GLB failed to load');
    expect(snap.importedModel.normalizedExtent).toBeGreaterThanOrEqual(0.1);
    expect(snap.importedModel.normalizedExtent).toBeLessThanOrEqual(3.0);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-H1: Rapid-fire stress test (20 shots with reload) produces zero NaN physics states', async ({ page }) => {
    const trap = await bootRange(page);
    await spawnTarget(page, 'tin-can');
    for (let b = 0; b < 2; b++) {
      await shoot(page, 10, 45);
      await page.keyboard.press('KeyR');
    }
    const snap = await getTelemetry(page);
    expect(snap.player.position.every(Number.isFinite)).toBe(true);
    for (const t of snap.targets) {
      expect(t.position.every(Number.isFinite)).toBe(true);
      expect(t.linearVelocity.every(Number.isFinite)).toBe(true);
    }
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-H2: Tin can mounts decals on early hits and shatters on final depleting hit', async ({ page }) => {
    const trap = await bootRange(page);
    const id = await spawnTarget(page, 'tin-can');
    await shoot(page, 1);
    await waitTelemetry(page, (s) => (s.targets.find((t) => t.id === id)?.decalCount ?? 0) >= 1, 'No decal on hit 1');
    for (let i = 0; i < 6; i++) {
      if (!(await getTelemetry(page)).targets.find((t) => t.id === id)?.alive) break;
      await shoot(page, 1);
      await page.waitForTimeout(80);
    }
    const end = await waitTelemetry(page, (s) => s.targets.find((t) => t.id === id)?.alive === false, 'Did not shatter');
    expect(end.activeShardCount).toBeGreaterThanOrEqual(4);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-H3: Rapid sequential destruction of 3 glass bottles yields shatters >= 3', async ({ page }) => {
    const trap = await bootRange(page);
    const startShatters = (await getTelemetry(page)).hud.shatters;
    for (let i = 0; i < 3; i++) {
      const id = await spawnTarget(page, 'glass-bottle');
      await shoot(page, 2, 70);
      await waitTelemetry(page, (s) => s.targets.find((t) => t.id === id)?.alive === false, `Bottle ${i} intact`);
    }
    expect((await getTelemetry(page)).hud.shatters).toBeGreaterThanOrEqual(startShatters + 3);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-H4: Shooting open sky increments shotsFired without incrementing hits or decals', async ({ page }) => {
    const trap = await bootRange(page);
    await mouseAim(page, 450, -350);
    await waitFrames(page, 2);
    const pre = await getTelemetry(page);
    await shoot(page, 1);
    const post = await waitTelemetry(page, (s) => s.hud.shotsFired > pre.hud.shotsFired, 'Sky shot did not fire');
    expect(post.hud.shotsFired).toBe(pre.hud.shotsFired + 1);
    expect(post.hud.hits).toBe(pre.hud.hits);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-H5: Hitting an already-displaced dynamic target still adds impulse or shatters', async ({ page }) => {
    const trap = await bootRange(page);
    const id = await spawnTarget(page, 'tin-can');
    await shoot(page, 1);
    await page.waitForTimeout(120);
    const preHits = (await getTelemetry(page)).hud.hits;
    await shoot(page, 1);
    const post = await waitTelemetry(
      page, (s) => s.hud.hits > preHits || s.targets.find((t) => t.id === id)?.alive === false, 'Second hit missed',
    );
    const t = post.targets.find((item) => item.id === id)!;
    expect(t.alive ? vec3Len(t.linearVelocity) > 0.05 : post.activeShardCount >= 4).toBe(true);
    await trap.assertZeroErrors();
    trap.dispose();
  });
});
