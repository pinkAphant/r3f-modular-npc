import type { Page } from '@playwright/test';
import { getTelemetry, waitTelemetry } from './telemetry.ts';

export async function switchMode(page: Page, mode: 'viewer' | 'range'): Promise<void> {
  const id = mode === 'range' ? 'mode-range' : 'mode-viewer';
  await page.getByTestId(id).click();
  await waitTelemetry(page, (s) => s.mode === mode, `Mode did not switch to ${mode}`);
}

export async function holdKey(page: Page, key: string, durationMs: number): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(durationMs);
  await page.keyboard.up(key);
}

export async function moveWASD(
  page: Page,
  key: 'KeyW' | 'KeyA' | 'KeyS' | 'KeyD',
  durationMs = 450,
): Promise<void> {
  await holdKey(page, key, durationMs);
}

export async function jump(page: Page, holdMs = 150): Promise<void> {
  await holdKey(page, 'Space', holdMs);
}

export async function sprint(
  page: Page,
  key: 'KeyW' | 'KeyA' | 'KeyS' | 'KeyD' = 'KeyW',
  durationMs = 400,
): Promise<void> {
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down(key);
  await page.waitForTimeout(durationMs);
  await page.keyboard.up(key);
  await page.keyboard.up('ShiftLeft');
}

export async function acquirePointerLock(page: Page): Promise<void> {
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('Canvas boundingBox unavailable');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

export async function mouseAim(page: Page, dx: number, dy: number): Promise<void> {
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('Canvas boundingBox unavailable');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const maxStepX = Math.max(40, box.width * 0.4);
  const maxStepY = Math.max(40, box.height * 0.4);
  const chunks = Math.max(1, Math.ceil(Math.max(Math.abs(dx) / maxStepX, Math.abs(dy) / maxStepY)));
  const stepDx = dx / chunks;
  const stepDy = dy / chunks;
  for (let c = 0; c < chunks; c++) {
    await page.mouse.move(cx, cy);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(cx + stepDx, cy + stepDy, { steps: 6 });
    await page.mouse.up({ button: 'right' });
  }
}

export async function shoot(page: Page, clicks = 1, gapMs = 70): Promise<void> {
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('Canvas boundingBox unavailable');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  for (let i = 0; i < clicks; i++) {
    await page.mouse.click(cx, cy);
    if (i + 1 < clicks) await page.waitForTimeout(gapMs);
  }
}

export async function togglePerspective(page: Page): Promise<'first' | 'third'> {
  const before = (await getTelemetry(page)).camera.perspective;
  await page.getByTestId('toggle-perspective').click();
  const next = before === 'first' ? 'third' : 'first';
  await waitTelemetry(
    page,
    (s) => s.camera.perspective === next,
    `Perspective did not toggle to ${next}`,
  );
  return next;
}

export async function selectWeapon(
  page: Page,
  archetype: 'pistol' | 'shotgun' | 'smg' | 'rpg',
): Promise<void> {
  await page.getByTestId(`weapon-opt-${archetype}`).click();
  await waitTelemetry(
    page,
    (s) => s.weapon.archetype === archetype,
    `Weapon did not switch to ${archetype}`,
  );
}

export async function selectPose(page: Page, tag: string): Promise<void> {
  await page.getByTestId('pose-select').selectOption(tag);
  await waitTelemetry(
    page,
    (s) => s.posing.activeTag === tag,
    `Pose tag did not update to ${tag}`,
  );
}

export async function openJunkEditor(page: Page): Promise<void> {
  await page.getByTestId('open-junk-editor').click();
  await waitTelemetry(
    page,
    (s) => s.singleItemEditMode === 'junk-generator',
    'Did not enter junk-generator singleItemEditMode',
  );
}

export async function openGlbImporter(page: Page): Promise<void> {
  await page.getByTestId('open-glb-importer').click();
  await waitTelemetry(
    page,
    (s) => s.singleItemEditMode === 'glb-import',
    'Did not enter glb-import singleItemEditMode',
  );
}

export async function closeSingleItemEdit(page: Page): Promise<void> {
  await page.getByTestId('close-single-item-edit').click();
  await waitTelemetry(
    page,
    (s) => s.singleItemEditMode === 'none',
    'Did not exit singleItemEditMode',
  );
}

export async function spawnTarget(
  page: Page,
  kind: 'tin-can' | 'glass-bottle',
): Promise<string> {
  const prevSnap = await getTelemetry(page);
  const prevIds = new Set(prevSnap.targets.map((t) => t.id));
  const testId = kind === 'tin-can' ? 'spawn-tin-can' : 'spawn-glass-bottle';
  await page.getByTestId(testId).click();
  const snap = await waitTelemetry(
    page,
    (s) => s.targets.some((t) => !prevIds.has(t.id) && t.alive && t.kind === kind),
    `Target ${kind} failed to spawn`,
  );
  return snap.targets.find((t) => !prevIds.has(t.id) && t.alive && t.kind === kind)!.id;
}
