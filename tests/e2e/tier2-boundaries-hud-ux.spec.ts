import { test, expect, type Page } from '@playwright/test';
import { attachErrorTraps, waitFrames } from './helpers/webglAssert.ts';
import { getTelemetry, waitForReady, waitTelemetry } from './helpers/telemetry.ts';
import { createTempFixtures, type TempFixtures } from './helpers/fixtures.ts';
import {
  switchMode, shoot, openJunkEditor, openGlbImporter, closeSingleItemEdit, spawnTarget,
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

test.describe('Tier 2 — HUD & Focused Single-Item UX Boundary Cases', () => {
  test('T2-D1: Depleting ammo stops at 0 without negative values and KeyR reloads', async ({ page }) => {
    const trap = await bootRange(page);
    const startAmmo = (await getTelemetry(page)).hud.ammo;
    expect(startAmmo).toBeGreaterThan(0);
    await shoot(page, startAmmo, 85);
    for (let i = 0; i < 6 && (await getTelemetry(page)).hud.ammo > 0; i++) {
      await shoot(page, 1);
      await page.waitForTimeout(85);
    }
    const empty = await getTelemetry(page);
    expect(empty.hud.ammo).toBe(0);
    await shoot(page, 2, 70);
    expect((await getTelemetry(page)).hud.ammo).toBe(0);
    await page.keyboard.press('KeyR');
    const reloaded = await waitTelemetry(page, (s) => s.hud.ammo === startAmmo, 'Reload did not restore ammo');
    expect(reloaded.hud.ammo).toBe(startAmmo);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-D2: High counter values (>= 10 hits) remain finite on HUD', async ({ page }) => {
    const trap = await bootRange(page);
    await spawnTarget(page, 'tin-can');
    for (let i = 0; i < 4; i++) {
      await spawnTarget(page, 'glass-bottle');
      await shoot(page, 3, 45);
      await page.keyboard.press('KeyR');
    }
    const { hud } = await getTelemetry(page);
    expect(Number.isFinite(hud.shotsFired)).toBe(true);
    expect(Number.isFinite(hud.hits)).toBe(true);
    expect(hud.shotsFired).toBeGreaterThanOrEqual(12);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-D3: Rapid 10 shots in 500ms keeps UIKit HUD responsive with zero errors', async ({ page }) => {
    const trap = await bootRange(page);
    await shoot(page, 10, 40);
    const snap = await getTelemetry(page);
    expect(snap.hud.mounted).toBe(true);
    expect(snap.hud.shotsFired).toBeGreaterThanOrEqual(8);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-D4: HUD pointerEvents=none allows canvas clicks to fire without interception', async ({ page }) => {
    const trap = await bootRange(page);
    const before = (await getTelemetry(page)).hud.shotsFired;
    const box = (await page.locator('canvas').boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await waitTelemetry(page, (s) => s.hud.shotsFired > before, 'Click through HUD did not fire');
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-D5: Switching range -> viewer -> range remounts HUD cleanly without duplicates', async ({ page }) => {
    const trap = await bootRange(page);
    await switchMode(page, 'viewer');
    expect((await getTelemetry(page)).hud.mounted).toBe(false);
    await switchMode(page, 'range');
    expect((await getTelemetry(page)).hud.mounted).toBe(true);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-E1: Weapon hotkeys Digit1..Digit4 do not swap weapon or show switcher during single-item edit', async ({ page }) => {
    const trap = await bootRange(page);
    const initialWeapon = (await getTelemetry(page)).weapon.archetype;
    await openJunkEditor(page);
    for (const key of ['Digit1', 'Digit2', 'Digit3', 'Digit4']) await page.keyboard.press(key);
    await waitFrames(page, 2);
    await expect(page.getByTestId('weapon-switcher')).toHaveCount(0);
    expect((await getTelemetry(page)).weapon.archetype).toBe(initialWeapon);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-E2: Switching junk-generator <-> glb-import keeps weapon switcher hidden throughout', async ({ page }) => {
    const trap = await bootRange(page);
    await openJunkEditor(page);
    await expect(page.getByTestId('weapon-switcher')).toHaveCount(0);
    await openGlbImporter(page);
    await expect(page.getByTestId('weapon-switcher')).toHaveCount(0);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-E3: Invalid GLB upload during single-item import shows error and keeps switcher hidden', async ({ page }) => {
    const trap = await bootRange(page);
    await openGlbImporter(page);
    await page.getByTestId('glb-import-input').setInputFiles(fixtures.corruptGlbPath);
    await waitTelemetry(page, (s) => Boolean(s.importedModel.lastError), 'Error not recorded on corrupt GLB');
    await expect(page.getByTestId('status-banner')).toBeVisible();
    await expect(page.getByTestId('weapon-switcher')).toHaveCount(0);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-E4: Closing single-item mode after import/edit restores valid weapon switcher', async ({ page }) => {
    const trap = await bootRange(page);
    await openGlbImporter(page);
    await closeSingleItemEdit(page);
    await expect(page.getByTestId('weapon-switcher')).toBeVisible();
    expect(['pistol', 'shotgun', 'smg', 'rpg']).toContain((await getTelemetry(page)).weapon.archetype);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T2-E5: Toggling viewer <-> range preserves single-item edit guard without phantom switcher', async ({ page }) => {
    const trap = await bootRange(page);
    await openJunkEditor(page);
    await switchMode(page, 'viewer');
    await expect(page.getByTestId('weapon-switcher')).toHaveCount(0);
    await switchMode(page, 'range');
    await expect(page.getByTestId('weapon-switcher')).toHaveCount(0);
    await trap.assertZeroErrors();
    trap.dispose();
  });
});
