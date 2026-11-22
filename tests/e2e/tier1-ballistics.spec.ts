import { test, expect, type Page } from '@playwright/test';
import { attachErrorTraps, waitFrames } from './helpers/webglAssert.ts';
import { getTelemetry, waitForReady, waitTelemetry, vec3Len, vec3Dist } from './helpers/telemetry.ts';
import { switchMode, shoot, spawnTarget } from './helpers/rangeInput.ts';

async function bootRange(page: Page) {
  const trap = await attachErrorTraps(page);
  await page.goto('/');
  await waitForReady(page);
  await switchMode(page, 'range');
  await waitFrames(page, 3);
  return trap;
}

test.describe('Tier 1 — Ballistics, Decals, Knockback & BVH Shatter', () => {
  test('T1-H1: Raycast shot on tin can increments shotsFired and hits', async ({ page }) => {
    const trap = await bootRange(page);
    await spawnTarget(page, 'tin-can');
    await waitFrames(page, 3);
    const pre = await getTelemetry(page);
    await shoot(page, 1);
    const post = await waitTelemetry(
      page, (s) => s.hud.hits > pre.hud.hits, 'Shot did not register hit on target',
    );
    expect(post.hud.shotsFired).toBe(pre.hud.shotsFired + 1);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-H2: Non-fatal hit spawns bullet-hole decal in target local space', async ({ page }) => {
    const trap = await bootRange(page);
    const id = await spawnTarget(page, 'tin-can');
    await waitFrames(page, 3);
    await shoot(page, 1);
    const after1 = await waitTelemetry(
      page, (s) => (s.targets.find((t) => t.id === id)?.decalCount ?? 0) >= 1, 'First decal missing',
    );
    expect(after1.targets.find((t) => t.id === id)!.decalCount).toBe(1);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-H3: Shot imparts non-zero knockback physics impulse to struck target', async ({ page }) => {
    const trap = await bootRange(page);
    const id = await spawnTarget(page, 'tin-can');
    await waitFrames(page, 3);
    const p0 = (await getTelemetry(page)).targets.find((t) => t.id === id)!.position;
    await shoot(page, 1);
    const post = await waitTelemetry(
      page,
      (s) => {
        const t = s.targets.find((item) => item.id === id);
        return Boolean(t && (vec3Len(t.linearVelocity) > 0.3 || vec3Dist(t.position, p0) > 0.05));
      },
      'No knockback impulse observed on struck target',
    );
    const target = post.targets.find((t) => t.id === id)!;
    expect(vec3Len(target.linearVelocity) + vec3Dist(target.position, p0)).toBeGreaterThan(0.05);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-H4: Destructible glass bottle shatters into >= 4 BVH shards on hit', async ({ page }) => {
    const trap = await bootRange(page);
    const id = await spawnTarget(page, 'glass-bottle');
    await waitFrames(page, 3);
    const preShatters = (await getTelemetry(page)).hud.shatters;
    await shoot(page, 2, 100);
    const post = await waitTelemetry(
      page,
      (s) => s.hud.shatters > preShatters && s.targets.find((t) => t.id === id)?.alive === false,
      'Glass bottle did not shatter',
    );
    expect(post.activeShardCount).toBeGreaterThanOrEqual(4);
    await trap.assertZeroErrors();
    trap.dispose();
  });

  test('T1-H5: Tin can shatters when HP depletes and unmounts decals cleanly', async ({ page }) => {
    const trap = await bootRange(page);
    const id = await spawnTarget(page, 'tin-can');
    await waitFrames(page, 3);
    for (let i = 0; i < 6; i++) {
      const alive = (await getTelemetry(page)).targets.find((t) => t.id === id)?.alive;
      if (!alive) break;
      await shoot(page, 1);
      await page.waitForTimeout(90);
    }
    const post = await waitTelemetry(
      page, (s) => s.targets.find((t) => t.id === id)?.alive === false, 'Tin can failed to shatter',
    );
    expect(post.targets.find((t) => t.id === id)!.decalCount).toBe(0);
    expect(post.activeShardCount).toBeGreaterThanOrEqual(4);
    await trap.assertZeroErrors();
    trap.dispose();
  });
});
