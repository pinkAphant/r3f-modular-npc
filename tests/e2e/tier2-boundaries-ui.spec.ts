import { test, expect, type Page } from '@playwright/test';
import {
  attachErrorTraps,
  waitFrames,
  assertCanvasNonBlank,
  assertReticleContrast,
  assertRgb555Signature,
} from './helpers/webglAssert.ts';
import { getTelemetry, waitForReady, waitTelemetry } from './helpers/telemetry.ts';
import { createTempFixtures, type TempFixtures } from './helpers/fixtures.ts';
import { acquirePointerLock, switchMode, mouseAim, shoot, spawnTarget } from './helpers/rangeInput.ts';

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

test.describe('Tier 2 — Boot, Controller & Shader Boundary Cases', () => {
  test('T2-A1: Rapid mode toggling viewer <-> range 8x leaks zero WebGL contexts', async ({ page }) => {
    const trap = await attachErrorTraps(page);
    await page.goto('/');
    await waitForReady(page);
    for (let i = 0; i < 4; i++) {
      await page.getByTestId('mode-range').click();
      await page.getByTestId('mode-viewer').click();
    }
    const snap = await waitTelemetry(page, (s) => s.mode === 'viewer', 'Final mode mismatch');
    expect(snap.mode).toBe('viewer');
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-A2: Switching mode while custom label is active cleans up without object-URL errors', async ({ page }) => {
    const trap = await bootRange(page);
    await spawnTarget(page, 'tin-can');
    await page.getByTestId('label-upload-input').setInputFiles(fixtures.validPngPath);
    await waitTelemetry(page, (s) => s.targets.some((t) => t.customLabelLoaded), 'Custom label missing');
    await switchMode(page, 'viewer');
    await switchMode(page, 'range');
    assertCanvasNonBlank(await page.locator('canvas').screenshot());
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-A3: Reload page cleanly resets runtime without leaked state', async ({ page }) => {
    const trap = await bootRange(page);
    await shoot(page, 1);
    await page.reload();
    const snap = await waitForReady(page);
    expect(snap.hud.shotsFired).toBe(0);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-A4: Rapid male <-> female character clicks settle on final selection', async ({ page }) => {
    const trap = await attachErrorTraps(page);
    await page.goto('/');
    await waitForReady(page);
    await switchMode(page, 'viewer');
    await page.getByTestId('char-female').click();
    await page.getByTestId('char-male').click();
    await page.getByTestId('char-female').click();
    const snap = await waitTelemetry(page, (s) => s.heroVariant === 'female', 'Did not settle on female');
    expect(snap.boneCount).toBeGreaterThanOrEqual(65);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-A5: Extreme narrow (375x667) and ultrawide (1920x480) viewports remain usable', async ({ page }) => {
    const trap = await bootRange(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await waitFrames(page, 3);
    expect((await page.locator('canvas').boundingBox())!.width).toBeGreaterThan(200);
    await page.setViewportSize({ width: 1920, height: 480 });
    await waitFrames(page, 3);
    assertCanvasNonBlank(await page.locator('canvas').screenshot());
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-B1: Pointer lock click + Escape cleanly unlocks pointer and keeps UI clickable', async ({ page }) => {
    const trap = await bootRange(page);
    await acquirePointerLock(page);
    await waitFrames(page, 2);
    expect(await page.evaluate(() => Boolean(document.pointerLockElement))).toBe(true);
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => Boolean(document.pointerLockElement))).toBe(false);
    await page.getByTestId('toggle-perspective').click();
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-B2: Toggling 1st/3rd person mid-KeyW movement yields finite velocity', async ({ page }) => {
    const trap = await bootRange(page);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(200);
    await page.getByTestId('toggle-perspective').click();
    await page.waitForTimeout(250);
    await page.keyboard.up('KeyW');
    const snap = await getTelemetry(page);
    expect(snap.camera.perspective).toBe('third');
    expect(snap.player.position.every(Number.isFinite)).toBe(true);
    expect(snap.player.velocity.every(Number.isFinite)).toBe(true);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-B3: Simultaneous opposing keys KeyW+KeyS and KeyA+KeyD stay finite', async ({ page }) => {
    const trap = await bootRange(page);
    for (const k of ['KeyW', 'KeyS', 'KeyA', 'KeyD']) await page.keyboard.down(k);
    await page.waitForTimeout(350);
    for (const k of ['KeyW', 'KeyS', 'KeyA', 'KeyD']) await page.keyboard.up(k);
    const snap = await getTelemetry(page);
    expect(snap.player.position.every(Number.isFinite)).toBe(true);
    expect(snap.player.velocity.every(Number.isFinite)).toBe(true);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-B4: Jump spam does not double-jump infinitely into sky', async ({ page }) => {
    const trap = await bootRange(page);
    const baseY = (await getTelemetry(page)).player.position[1];
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(80);
    }
    const peakY = (await getTelemetry(page)).player.position[1];
    expect(peakY).toBeLessThan(baseY + 4.0);
    await waitTelemetry(page, (s) => s.player.grounded, 'Player stuck mid-air after jump spam');
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-B5: Extreme vertical pitch look clamps safely without NaN or gimbal flip', async ({ page }) => {
    const trap = await bootRange(page);
    for (let i = 0; i < 6; i++) await mouseAim(page, 0, 220);
    for (let i = 0; i < 6; i++) await mouseAim(page, 0, -220);
    const { camera } = await getTelemetry(page);
    expect(Number.isFinite(camera.pitch)).toBe(true);
    expect(Math.abs(camera.pitch)).toBeLessThanOrEqual(Math.PI / 2 + 0.05);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-C1: Dreamcast pass maintains legible reticle across extreme look angles', async ({ page }) => {
    const trap = await bootRange(page);
    await mouseAim(page, 400, 120);
    await waitFrames(page, 3);
    assertReticleContrast(await page.locator('canvas').screenshot());
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-C2: Rapid viewport resize with Dreamcast render target causes zero GL framebuffer errors', async ({ page }) => {
    const trap = await bootRange(page);
    for (const size of [{ width: 640, height: 360 }, { width: 1024, height: 768 }, { width: 1280, height: 720 }]) {
      await page.setViewportSize(size);
      await waitFrames(page, 2);
    }
    assertCanvasNonBlank(await page.locator('canvas').screenshot());
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-C3: Mode switch viewer <-> range cleans Dreamcast render state cleanly', async ({ page }) => {
    const trap = await bootRange(page);
    await switchMode(page, 'viewer');
    await waitFrames(page, 3);
    await switchMode(page, 'range');
    await waitFrames(page, 3);
    expect((await getTelemetry(page)).dreamcastPass.enabled).toBe(true);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-C4: Pure #ff0000 custom texture quantizes cleanly in RGB555 without wrap artifacts', async ({ page }) => {
    const trap = await bootRange(page);
    await spawnTarget(page, 'tin-can');
    await page.getByTestId('label-upload-input').setInputFiles(fixtures.redPngPath);
    await waitTelemetry(page, (s) => s.targets.some((t) => t.customLabelLoaded), 'Red PNG did not load');
    await waitFrames(page, 3);
    assertRgb555Signature(await page.locator('canvas').screenshot());
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-C5: Rapid consecutive shots with muzzle flash preserve HUD legibility', async ({ page }) => {
    const trap = await bootRange(page);
    await shoot(page, 5, 45);
    await waitFrames(page, 2);
    assertReticleContrast(await page.locator('canvas').screenshot());
    await trap.assertZeroErrors();
    trap.dispose();
  });
});
