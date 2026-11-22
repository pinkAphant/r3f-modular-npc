import type { DestructibleTargetHandle } from '../junk/DestructibleTarget';
import { BOTTLE_HEIGHT, TIN_CAN_HEIGHT } from '../junk/junkGeometry';
import type { DestructibleTargetSnapshot } from '../junk/targetHelpers';
import type { DestructibleTargetSpec } from '../types/junk';
import { PEDESTAL_HEIGHT } from './RangeArena';
import { getTelemetryPlayerPlanar } from './rangeTelemetry';

export const SHELF_TOP_Y = 1.48;
export const SHELF_SLOTS: Array<[number, number]> = [
  [0, -3.5],
  [0, -4.15],
  [-0.45, -3.5],
  [0.45, -3.5],
  [-0.85, -3.5],
  [0.85, -3.5],
];

export function createInitialTargets(): DestructibleTargetSpec[] {
  const canY = PEDESTAL_HEIGHT + TIN_CAN_HEIGHT * 0.5 + 0.005;
  const bottleY = PEDESTAL_HEIGHT + BOTTLE_HEIGHT * 0.5 + 0.005;
  return [
    {
      id: 'seed-can-5l',
      kind: 'tin-can',
      labelId: 'tris-soda',
      customAlbedoUrl: null,
      canLodMode: 'auto',
      position: [-4.5, canY, -5],
      hp: 3,
      maxHp: 3,
      fragile: false,
      shatterPieceCount: 6,
    },
    {
      id: 'seed-can-5r',
      kind: 'tin-can',
      labelId: 'garys-beans',
      customAlbedoUrl: null,
      canLodMode: 'auto',
      position: [4.5, canY, -5],
      hp: 3,
      maxHp: 3,
      fragile: false,
      shatterPieceCount: 6,
    },
    {
      id: 'seed-bottle-10l',
      kind: 'glass-bottle',
      labelId: 'target',
      customAlbedoUrl: null,
      canLodMode: 'auto',
      position: [-6, bottleY, -10],
      hp: 1,
      maxHp: 1,
      fragile: true,
      shatterPieceCount: 6,
    },
    {
      id: 'seed-can-10r',
      kind: 'tin-can',
      labelId: 'goofy-emoji',
      customAlbedoUrl: null,
      canLodMode: 'auto',
      position: [6, canY, -10],
      hp: 3,
      maxHp: 3,
      fragile: false,
      shatterPieceCount: 6,
    },
    {
      id: 'seed-can-20l',
      kind: 'tin-can',
      labelId: 'target',
      customAlbedoUrl: null,
      canLodMode: 'auto',
      position: [-4.5, canY, -20],
      hp: 3,
      maxHp: 3,
      fragile: false,
      shatterPieceCount: 6,
    },
  ];
}

export function pickShelfSlot(
  targets: DestructibleTargetSpec[],
  handles: Map<string, DestructibleTargetHandle>,
  snapshots: Map<string, DestructibleTargetSnapshot>
): [number, number] {
  const [rawX, vx] = getTelemetryPlayerPlanar();
  const px = Math.min(1.25, Math.max(-1.25, rawX + vx * 0.02));
  const slots: Array<[number, number]> = [[px, -3.5], ...SHELF_SLOTS.slice(1)];
  for (const [sx, sz] of slots) {
    const occupied = targets.some((t) => {
      const snap = handles.get(t.id)?.getSnapshot() ?? snapshots.get(t.id);
      const alive = snap ? snap.alive : true;
      if (!alive) return false;
      const pos = snap ? snap.position : t.position;
      return Math.hypot(pos[0] - sx, pos[2] - sz) < 0.22;
    });
    if (!occupied) return [sx, sz];
  }
  return [px, -3.5];
}
