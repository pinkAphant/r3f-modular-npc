import { test, expect } from '@playwright/test';
import { attachErrorTraps, waitFrames, assertCanvasNonBlank, measureFrameDiff } from './helpers/webglAssert.ts';
import { getTelemetry, waitForReady, waitTelemetry, vec3Dist, vec3Len } from './helpers/telemetry.ts';
import { switchMode, moveWASD, jump, sprint, mouseAim, togglePerspective } from './helpers/rangeInput.ts';

test.describe('Tier 1 — Boot, Mode Switch & ecctrl2 Range Movement', () => {
  test('T1-A1: Clean boot in default mode with zero errors and non-blank WebGL canvas', async ({ page }) => {
    const trap = await attachErrorTraps(page);
    await page.goto('/');
    const snap = await waitForReady(page);
    expect(['viewer', 'range']).toContain(snap.mode);
    const box = await page.locator('canvas').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(300);
    expect(box!.height).toBeGreaterThanOrEqual(200);
    await waitFrames(page, 4);
    assertCanvasNonBlank(await page.locator('canvas').screenshot());
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-A2: Switch viewer -> range mode activates arena and HUD', async ({ page }) => {
    const trap = await attachErrorTraps(page);
    await page.goto('/');
    await waitForReady(page);
    await switchMode(page, 'range');
    const snap = await getTelemetry(page);
    expect(snap.mode).toBe('range');
    expect(snap.hud.mounted).toBe(true);
    await expect(page.getByTestId('toggle-perspective')).toBeVisible();
    await expect(page.getByTestId('junk-panel')).toBeVisible();
    await expect(page.getByTestId('char-male')).toHaveCount(0);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-A3: Switch range -> viewer mode restores viewer UI and unmounts FPS HUD', async ({ page }) => {
    const trap = await attachErrorTraps(page);
    await page.goto('/');
    await waitForReady(page);
    await switchMode(page, 'range');
    await switchMode(page, 'viewer');
    const snap = await getTelemetry(page);
    expect(snap.mode).toBe('viewer');
    expect(snap.hud.mounted).toBe(false);
    await expect(page.getByTestId('char-male')).toBeVisible();
    await expect(page.getByTestId('junk-panel')).toHaveCount(0);
    await expect(page.getByTestId('toggle-perspective')).toHaveCount(0);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-A4: Viewer character switch male <-> female updates variant and renders diff', async ({ page }) => {
    const trap = await attachErrorTraps(page);
    await page.goto('/');
    await waitForReady(page);
    await switchMode(page, 'viewer');
    await page.getByTestId('char-male').click();
    await waitTelemetry(page, (s) => s.heroVariant === 'male', 'Male hero did not load');
    await waitFrames(page, 3);
    const malePng = await page.locator('canvas').screenshot();
    await page.getByTestId('char-female').click();
    const femaleSnap = await waitTelemetry(page, (s) => s.heroVariant === 'female', 'Female hero did not load');
    expect(femaleSnap.boneCount).toBeGreaterThanOrEqual(65);
    await waitFrames(page, 3);
    expect(measureFrameDiff(malePng, await page.locator('canvas').screenshot())).toBeGreaterThan(0.005);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-A5: Viewer animation clip switching advances canvas frames', async ({ page }) => {
    const trap = await attachErrorTraps(page);
    await page.goto('/');
    await waitForReady(page);
    await switchMode(page, 'viewer');
    const btns = page.locator('[data-testid="anim-list"] button');
    expect(await btns.count()).toBeGreaterThanOrEqual(2);
    await btns.nth(0).click();
    const firstAnim = (await getTelemetry(page)).activeAnimation;
    await btns.nth(1).click();
    const after = await waitTelemetry(page, (s) => s.activeAnimation !== firstAnim, 'Animation clip did not change');
    expect(after.activeAnimation).toBeTruthy();
    const frameA = await page.locator('canvas').screenshot();
    await page.waitForTimeout(300);
    expect(measureFrameDiff(frameA, await page.locator('canvas').screenshot())).toBeGreaterThan(0.001);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-A6: Clean WebGL context and resize stability across modes', async ({ page }) => {
    const trap = await attachErrorTraps(page);
    await page.goto('/');
    await waitForReady(page);
    await page.setViewportSize({ width: 800, height: 600 });
    await waitFrames(page, 3);
    const box1 = await page.locator('canvas').boundingBox();
    expect(box1!.width).toBeGreaterThanOrEqual(300);
    await switchMode(page, 'range');
    await page.setViewportSize({ width: 1280, height: 720 });
    await waitFrames(page, 3);
    assertCanvasNonBlank(await page.locator('canvas').screenshot());
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-B1: WASD planar locomotion moves ecctrl2 player and updates viewport', async ({ page }) => {
    const trap = await attachErrorTraps(page);
    await page.goto('/');
    await waitForReady(page);
    await switchMode(page, 'range');
    const startPos = (await getTelemetry(page)).player.position;
    const beforePng = await page.locator('canvas').screenshot();
    await moveWASD(page, 'KeyW', 500);
    await moveWASD(page, 'KeyD', 400);
    await waitFrames(page, 3);
    const endPos = (await getTelemetry(page)).player.position;
    expect(vec3Dist(startPos, endPos)).toBeGreaterThan(0.3);
    expect(measureFrameDiff(beforePng, await page.locator('canvas').screenshot())).toBeGreaterThan(0.01);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-B2: Jump Space imparts vertical impulse and settles back to ground', async ({ page }) => {
    const trap = await attachErrorTraps(page);
    await page.goto('/');
    await waitForReady(page);
    await switchMode(page, 'range');
    const baseY = (await getTelemetry(page)).player.position[1];
    await jump(page, 150);
    let peakY = baseY;
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(70);
      peakY = Math.max(peakY, (await getTelemetry(page)).player.position[1]);
    }
    expect(peakY).toBeGreaterThan(baseY + 0.15);
    const settled = await waitTelemetry(
      page,
      (s) => s.player.grounded && Math.abs(s.player.position[1] - baseY) < 0.15,
      'Player failed to land back near ground height',
    );
    expect(settled.player.grounded).toBe(true);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-B3: Sprint Shift+KeyW achieves higher displacement than walk KeyW', async ({ page }) => {
    const trap = await attachErrorTraps(page);
    await page.goto('/');
    await waitForReady(page);
    await switchMode(page, 'range');
    const p0 = (await getTelemetry(page)).player.position;
    await moveWASD(page, 'KeyW', 450);
    const p1 = (await getTelemetry(page)).player.position;
    const walkDist = vec3Dist(p0, p1);
    await page.waitForTimeout(200);
    const p2 = (await getTelemetry(page)).player.position;
    await sprint(page, 'KeyW', 450);
    const p3 = (await getTelemetry(page)).player.position;
    expect(vec3Dist(p2, p3)).toBeGreaterThan(walkDist * 1.15);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-B4: Camera aiming changes yaw/pitch and scene pixels', async ({ page }) => {
    const trap = await attachErrorTraps(page);
    await page.goto('/');
    await waitForReady(page);
    await switchMode(page, 'range');
    const before = await getTelemetry(page);
    const beforePng = await page.locator('canvas').screenshot();
    await mouseAim(page, 160, -40);
    await waitFrames(page, 3);
    const after = await getTelemetry(page);
    expect(Math.abs(after.camera.yaw - before.camera.yaw) + Math.abs(after.camera.pitch - before.camera.pitch))
      .toBeGreaterThan(0.05);
    expect(measureFrameDiff(beforePng, await page.locator('canvas').screenshot())).toBeGreaterThan(0.01);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-B5: 1st-person <-> 3rd-person toggle shows hero in frame in 3rd-person', async ({ page }) => {
    const trap = await attachErrorTraps(page);
    await page.goto('/');
    await waitForReady(page);
    await switchMode(page, 'range');
    const next = await togglePerspective(page);
    expect(next).toBe('third');
    const thirdSnap = await waitTelemetry(page, (s) => s.camera.heroInFrame, 'Hero not in frame in 3rd person');
    expect(thirdSnap.hud.cameraMode).toBe('third');
    expect(await togglePerspective(page)).toBe('first');
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-B6: Arena bounds & barrier collision prevent fall-through', async ({ page }) => {
    const trap = await attachErrorTraps(page);
    await page.goto('/');
    await waitForReady(page);
    await switchMode(page, 'range');
    await sprint(page, 'KeyW', 1600);
    const snap = await getTelemetry(page);
    expect(snap.player.position[1]).toBeGreaterThan(-2);
    expect(vec3Len(snap.player.position)).toBeLessThan(100);
    await trap.assertZeroErrors();
    trap.dispose();
  });
});
