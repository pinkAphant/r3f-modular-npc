import { loadCachedNpcGltf } from '../npc/npcRigSetup';
import { loadWeaponRig } from '../npc/weaponLoader';

let started = false;

export function preloadRangeBootAssets(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  void loadCachedNpcGltf('/assets/npc_hero_uploaded.glb').catch(() => {});
  void loadWeaponRig('pistol').catch(() => {});
  void import('@dimforge/rapier3d-compat')
    .then((rapier) => rapier.init())
    .catch(() => {});
  void import('@pmndrs/msdfonts/inter').catch(() => {});
}
