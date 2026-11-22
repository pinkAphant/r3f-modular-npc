import { test, expect, type Page } from '@playwright/test';
import {
  attachErrorTraps,
  waitFrames,
  assertPixelSnapGrid,
  assertRgb555Signature,
  assertReticleContrast,
  measureFrameDiff,
  measureRegionContrast,
} from './helpers/webglAssert.ts';
import { getTelemetry, waitForReady, waitTelemetry } from './helpers/telemetry.ts';
import {
  switchMode,
  shoot,
  togglePerspective,
  selectWeapon,
  openJunkEditor,
  openGlbImporter,
  closeSingleItemEdit,
  spawnTarget,
} from './helpers/rangeInput.ts';

async function bootRange(page: Page) {
  const trap = await attachErrorTraps(page);
  await page.goto('/');
  await waitForReady(page);
  await switchMode(page, 'range');
  await waitFrames(page, 3);
  return trap;
}

test.describe('Tier 1 — Dreamcast Shader, UIKit HUD & Focused Single-Item UX', () => {
  test('T1-C1: Zero GLSL shader compile or WebGL program warnings in range mode', async ({ page }) => {
    const trap = await bootRange(page);
    await waitFrames(page, 6);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-C2: Pixel-snap pass active at crisp Dreamcast resolution (not coarse Atari)', async ({ page }) => {
    const trap = await bootRange(page);
    const { dreamcastPass } = await getTelemetry(page);
    expect(dreamcastPass.enabled).toBe(true);
    expect(dreamcastPass.pixelSnapWidth).toBeGreaterThanOrEqual(240);
    expect(dreamcastPass.pixelSnapWidth).toBeLessThanOrEqual(960);
    expect(dreamcastPass.pixelSnapHeight).toBeGreaterThanOrEqual(180);
    assertPixelSnapGrid(await page.locator('canvas').screenshot(), dreamcastPass.pixelSnapWidth);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-C3: RGB555 color quantization signature present in 3D scene buffer', async ({ page }) => {
    const trap = await bootRange(page);
    expect((await getTelemetry(page)).dreamcastPass.rgb555Enabled).toBe(true);
    const png = await page.locator('canvas').screenshot();
    assertRgb555Signature(png);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-C4: FPS HUD isolated from Dreamcast crush with high-contrast reticle', async ({ page }) => {
    const trap = await bootRange(page);
    const snap = await getTelemetry(page);
    expect(snap.hud.isolatedFromPostProcess).toBe(true);
    assertReticleContrast(await page.locator('canvas').screenshot());
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-C5: Procedural labels remain legible under Dreamcast shader', async ({ page }) => {
    const trap = await bootRange(page);
    await openJunkEditor(page);
    await spawnTarget(page, 'tin-can');
    await page.getByTestId('label-select').selectOption('tris-soda');
    await waitFrames(page, 4);
    const sodaRegion = measureRegionContrast(await page.locator('canvas').screenshot(), 0.35, 0.3, 0.65, 0.7);
    expect(sodaRegion.contrast).toBeGreaterThan(50);
    await page.getByTestId('label-select').selectOption('garys-beans');
    await waitFrames(page, 4);
    const beansRegion = measureRegionContrast(await page.locator('canvas').screenshot(), 0.35, 0.3, 0.65, 0.7);
    expect(beansRegion.contrast).toBeGreaterThan(50);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-D1: FPS HUD renders inside WebGL canvas via uikit, not React DOM text nodes', async ({ page }) => {
    const trap = await bootRange(page);
    expect((await getTelemetry(page)).hud.mounted).toBe(true);
    const domHudTexts = await page.evaluate(() => {
      const text = document.body.innerText;
      return /\b(SHATTERS|CROSSHAIR|HITS:\s*\d+)\b/i.test(text);
    });
    expect(domHudTexts).toBe(false);
    assertReticleContrast(await page.locator('canvas').screenshot());
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-D2: Junk, Pose and Importer controls live in accessible standard React DOM', async ({ page }) => {
    const trap = await bootRange(page);
    await expect(page.getByTestId('junk-panel')).toBeVisible();
    await expect(page.getByTestId('pose-panel')).toBeVisible();
    await expect(page.getByTestId('importer-panel')).toBeVisible();
    await expect(page.getByTestId('pose-select')).toBeVisible();
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-D3: HUD ammo, shotsFired, hits and shatters update on target fire', async ({ page }) => {
    const trap = await bootRange(page);
    const id = await spawnTarget(page, 'glass-bottle');
    await waitFrames(page, 4);
    const prePng = await page.locator('canvas').screenshot();
    const pre = await getTelemetry(page);
    await shoot(page, 1);
    const post = await waitTelemetry(
      page,
      (s) => s.hud.shotsFired > pre.hud.shotsFired && s.hud.hits > pre.hud.hits,
      'shotsFired and hits did not increment',
    );
    expect(post.hud.shotsFired).toBeGreaterThan(pre.hud.shotsFired);
    expect(post.hud.hits).toBeGreaterThan(pre.hud.hits);
    expect(post.hud.ammo).toBeLessThan(pre.hud.ammo);
    expect(measureFrameDiff(prePng, await page.locator('canvas').screenshot())).toBeGreaterThan(0.001);
    if (post.hud.shatters <= pre.hud.shatters && post.targets.find((t) => t.id === id)?.alive) {
      await shoot(page, 2, 100);
    }
    const postShatter = await waitTelemetry(
      page,
      (s) => s.hud.shatters > pre.hud.shatters,
      'hud.shatters did not increment on glass bottle shatter',
    );
    expect(postShatter.hud.shatters).toBeGreaterThan(pre.hud.shatters);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-D4: HUD cameraMode and poseTag sync with perspective and weapon selection', async ({ page }) => {
    const trap = await bootRange(page);
    await togglePerspective(page);
    await selectWeapon(page, 'shotgun');
    const snap = await getTelemetry(page);
    expect(snap.hud.cameraMode).toBe('third');
    expect(snap.hud.poseTag).toBe(snap.posing.activeTag);
    expect(snap.hud.poseTag).not.toBe('relaxed');
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-D5: HUD lodMode mirrors tin-can 3-gon <-> 12-gon toggle', async ({ page }) => {
    const trap = await bootRange(page);
    await spawnTarget(page, 'tin-can');
    await page.getByTestId('can-lod-select').selectOption('3-gon');
    await waitTelemetry(page, (s) => s.hud.lodMode === '3-gon', 'HUD lodMode not 3-gon');
    await page.getByTestId('can-lod-select').selectOption('12-gon');
    await waitTelemetry(page, (s) => s.hud.lodMode === '12-gon', 'HUD lodMode not 12-gon');
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-E1: Multi-weapon switcher renders and Digit1..Digit4 hotkeys switch when singleItemEditMode === none', async ({ page }) => {
    const trap = await bootRange(page);
    expect((await getTelemetry(page)).singleItemEditMode).toBe('none');
    await expect(page.getByTestId('weapon-switcher')).toBeVisible();
    for (const w of ['pistol', 'shotgun', 'smg', 'rpg']) {
      await expect(page.getByTestId(`weapon-opt-${w}`)).toBeVisible();
    }
    await page.keyboard.press('Digit2');
    await waitTelemetry(page, (s) => s.weapon.archetype === 'shotgun', 'Digit2 did not switch to shotgun');
    await page.keyboard.press('Digit1');
    await waitTelemetry(page, (s) => s.weapon.archetype === 'pistol', 'Digit1 did not switch to pistol');
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-E2: Opening procedural junk editor hides multi-weapon switcher and blocks hotkeys', async ({ page }) => {
    const trap = await bootRange(page);
    await openJunkEditor(page);
    await expect(page.getByTestId('weapon-switcher')).toHaveCount(0);
    await page.keyboard.press('Digit2');
    await waitFrames(page, 2);
    await expect(page.getByTestId('weapon-switcher')).toHaveCount(0);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-E3: Opening GLB importer hides multi-weapon switcher', async ({ page }) => {
    const trap = await bootRange(page);
    await openGlbImporter(page);
    await expect(page.getByTestId('weapon-switcher')).toHaveCount(0);
    await expect(page.getByTestId('weapon-opt-pistol')).toHaveCount(0);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-E4: Closing single-item editor restores normal multi-weapon switcher', async ({ page }) => {
    const trap = await bootRange(page);
    await openJunkEditor(page);
    await expect(page.getByTestId('weapon-switcher')).toHaveCount(0);
    await closeSingleItemEdit(page);
    await expect(page.getByTestId('weapon-switcher')).toBeVisible();
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-E5: Viewer inspection with single-item edit active hides weapon switcher', async ({ page }) => {
    const trap = await bootRange(page);
    await openGlbImporter(page);
    await switchMode(page, 'viewer');
    await expect(page.getByTestId('weapon-switcher')).toHaveCount(0);
    await trap.assertZeroErrors();
    trap.dispose();
  });
});
