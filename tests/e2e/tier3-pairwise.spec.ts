import { test, expect, type Page } from '@playwright/test';
import {
  attachErrorTraps,
  waitFrames,
  assertRgb555Signature,
  assertReticleContrast,
} from './helpers/webglAssert.ts';
import { getTelemetry, waitForReady, waitTelemetry, vec3Dist, vec3Len } from './helpers/telemetry.ts';
import { createTempFixtures, type TempFixtures } from './helpers/fixtures.ts';
import {
  acquirePointerLock,
  switchMode,
  sprint,
  jump,
  mouseAim,
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

async function bootRange(page: Page) {
  const trap = await attachErrorTraps(page);
  await page.goto('/');
  await waitForReady(page);
  await switchMode(page, 'range');
  await waitFrames(page, 3);
  return trap;
}

test.describe('Tier 3 — Pairwise Cross-Feature Combinations', () => {
  test('T3-1: Dreamcast RGB555 scene pass + isolated crisp UIKit HUD legibility', async ({ page }) => {
    const trap = await bootRange(page);
    const snap = await getTelemetry(page);
    expect(snap.dreamcastPass.enabled && snap.dreamcastPass.rgb555Enabled).toBe(true);
    expect(snap.hud.isolatedFromPostProcess).toBe(true);
    const png = await page.locator('canvas').screenshot();
    assertRgb555Signature(png);
    assertReticleContrast(png);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T3-2: 3rd-person toggle + shotgun equip + finger pose rotation active', async ({ page }) => {
    const trap = await bootRange(page);
    await selectWeapon(page, 'shotgun');
    await togglePerspective(page);
    const snap = await waitTelemetry(page, (s) => s.camera.heroInFrame, 'Hero missing in 3rd-person');
    const fingerNorms = Object.values(snap.posing.fingerEulerRad).map((v) => Math.hypot(v[0], v[1], v[2]));
    expect(Math.max(...fingerNorms)).toBeGreaterThan(0.1);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T3-3: Single-item junk editor AND GLB importer both suppress multi-weapon switcher', async ({ page }) => {
    const trap = await bootRange(page);
    await openJunkEditor(page);
    await expect(page.getByTestId('weapon-switcher')).toHaveCount(0);
    await page.keyboard.press('Digit3');
    await expect(page.getByTestId('weapon-switcher')).toHaveCount(0);
    await openGlbImporter(page);
    await expect(page.getByTestId('weapon-switcher')).toHaveCount(0);
    await closeSingleItemEdit(page);
    await expect(page.getByTestId('weapon-switcher')).toBeVisible();
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T3-4: Knockback + local-space bullet decal + subsequent BVH shatter on same can', async ({ page }) => {
    const trap = await bootRange(page);
    const id = await spawnTarget(page, 'tin-can');
    const p0 = (await getTelemetry(page)).targets.find((t) => t.id === id)!.position;
    await shoot(page, 1);
    const mid = await waitTelemetry(
      page, (s) => (s.targets.find((t) => t.id === id)?.decalCount ?? 0) >= 1, 'Decal 1 missing',
    );
    const tMid = mid.targets.find((t) => t.id === id)!;
    expect(vec3Len(tMid.linearVelocity) + vec3Dist(tMid.position, p0)).toBeGreaterThan(0.05);
    for (let i = 0; i < 6; i++) {
      if (!(await getTelemetry(page)).targets.find((t) => t.id === id)?.alive) break;
      await shoot(page, 1);
      await page.waitForTimeout(80);
    }
    const end = await waitTelemetry(page, (s) => s.targets.find((t) => t.id === id)?.alive === false, 'Did not shatter');
    expect(end.targets.find((t) => t.id === id)!.decalCount).toBe(0);
    expect(end.activeShardCount).toBeGreaterThanOrEqual(4);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T3-5: Custom PNG label on 12-gon tin can + shatter without GL/texture errors', async ({ page }) => {
    const trap = await bootRange(page);
    const id = await spawnTarget(page, 'tin-can');
    await page.getByTestId('can-lod-select').selectOption('12-gon');
    await page.getByTestId('label-upload-input').setInputFiles(fixtures.validPngPath);
    await waitTelemetry(page, (s) => Boolean(s.targets.find((t) => t.id === id)?.customLabelLoaded), 'Custom PNG missing');
    await selectWeapon(page, 'shotgun');
    await shoot(page, 2, 100);
    await waitTelemetry(page, (s) => s.targets.find((t) => t.id === id)?.alive === false, 'Custom 12-gon can did not shatter');
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T3-6: wiggle + ecctrl2 sprint/jump + firing keeps wiggle finite and finger pose locked', async ({ page }) => {
    const trap = await bootRange(page);
    await selectWeapon(page, 'smg');
    const prePose = (await getTelemetry(page)).posing.activeTag;
    await sprint(page, 'KeyW', 350);
    await jump(page, 140);
    await shoot(page, 3, 55);
    const post = await waitTelemetry(page, (s) => s.player.grounded, 'Player failed to land');
    expect(post.wiggle.hasNaN).toBe(false);
    expect(post.posing.activeTag).toBe(prePose);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T3-7: 3-gon -> 12-gon can + Garys Beans label + knockback shot', async ({ page }) => {
    const trap = await bootRange(page);
    const id = await spawnTarget(page, 'tin-can');
    await page.getByTestId('label-select').selectOption('garys-beans');
    await page.getByTestId('can-lod-select').selectOption('3-gon');
    await page.getByTestId('can-lod-select').selectOption('12-gon');
    await waitTelemetry(page, (s) => s.targets.find((t) => t.id === id)?.lodMode === '12-gon', 'LOD not 12-gon');
    await shoot(page, 1);
    const snap = await waitTelemetry(
      page, (s) => (s.targets.find((t) => t.id === id)?.decalCount ?? 0) >= 1, 'Garys Beans hit did not mount decal',
    );
    expect(snap.targets.find((t) => t.id === id)!.labelId).toBe('garys-beans');
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T3-8: Armory-imported multi-mesh GLB deployed as destructible target shatters on hit', async ({ page }) => {
    const trap = await bootRange(page);
    await openGlbImporter(page);
    await page.getByTestId('glb-import-input').setInputFiles(fixtures.validMultiMeshGlbPath);
    await waitTelemetry(page, (s) => s.importedModel.loaded, 'Multi-mesh GLB failed to load');
    await closeSingleItemEdit(page);
    const imported = await waitTelemetry(
      page, (s) => s.targets.some((t) => t.alive && t.kind === 'imported-glb'), 'Imported GLB not spawned in range',
    );
    const targetId = imported.targets.find((t) => t.alive && t.kind === 'imported-glb')!.id;
    await selectWeapon(page, 'rpg');
    await shoot(page, 2, 120);
    const post = await waitTelemetry(
      page, (s) => s.targets.find((t) => t.id === targetId)?.alive === false, 'Imported GLB target did not shatter',
    );
    expect(post.activeShardCount).toBeGreaterThanOrEqual(2);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T3-9: Viewer finger pose test -> range live combat with pistol', async ({ page }) => {
    const trap = await attachErrorTraps(page);
    await page.goto('/');
    await waitForReady(page);
    await switchMode(page, 'viewer');
    await selectPose(page, 'pistol_grip');
    await switchMode(page, 'range');
    await selectWeapon(page, 'pistol');
    await spawnTarget(page, 'glass-bottle');
    await shoot(page, 1);
    await waitTelemetry(page, (s) => s.hud.hits >= 1, 'Shot after viewer->range transition missed');
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T3-10: Pointer-lock aiming onto glass bottle shatters, updates HUD, Escape unlocks', async ({ page }) => {
    const trap = await bootRange(page);
    const id = await spawnTarget(page, 'glass-bottle');
    const preShatters = (await getTelemetry(page)).hud.shatters;
    await acquirePointerLock(page);
    await mouseAim(page, 20, 0);
    await mouseAim(page, -20, 0);
    await shoot(page, 2, 90);
    const post = await waitTelemetry(
      page,
      (s) => s.hud.shatters > preShatters && s.targets.find((t) => t.id === id)?.alive === false,
      'Glass bottle shatter failed',
    );
    expect(post.hud.hits).toBeGreaterThanOrEqual(1);
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.pointerLockElement === null)).toBe(true);
    await trap.assertZeroErrors();
    trap.dispose();
  });
});
