import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type {
  FingerPoseTag,
  IkAnchorId,
  LoadedWeaponRig,
  WeaponArchetypeId,
} from '../types/posing';
import { poseTagForWeapon } from './fingerPoseSchema';

import { mountWeaponToRightHand } from './weaponMount';

export {
  computeRightHandMountFrame,
  getMuzzleWorldPose,
  mountWeaponToRightHand,
} from './weaponMount';

export const WEAPON_GLB_URLS: Record<WeaponArchetypeId, string> = {
  pistol: '/assets/weapons/kolmogorov_pistol.glb',
  shotgun: '/assets/weapons/kolmogorov_shotgun.glb',
  smg: '/assets/weapons/kolmogorov_smg.glb',
  rpg: '/assets/weapons/kolmogorov_rpg.glb',
};

const IK_ANCHOR_IDS: IkAnchorId[] = [
  'IK_Palm_Primary',
  'IK_Index_Trigger',
  'IK_Thumb_Safety',
  'IK_Palm_Forend',
  'Socket_Muzzle',
  'Socket_Eject',
];

const templateCache = new Map<string, Promise<THREE.Group>>();
const loader = new GLTFLoader();

export function findNpcBone(
  root: THREE.Object3D,
  suffix: string,
  skeleton?: THREE.Skeleton | null
): THREE.Object3D | null {
  const candidates = [`mixamorig${suffix}`, `mixamorig:${suffix}`, suffix];
  if (skeleton?.bones.length) {
    for (const c of candidates) {
      const hit = skeleton.bones.find((b) => b.name === c);
      if (hit) return hit;
    }
    const stripped = skeleton.bones.find(
      (b) => b.name.replace(/^mixamorig:?/i, '') === suffix
    );
    if (stripped) return stripped;
  }
  for (const c of candidates) {
    const hit = root.getObjectByName(c);
    if (hit) return hit;
  }
  let matched: THREE.Object3D | null = null;
  root.traverse((obj) => {
    if (!matched && obj.name.replace(/^mixamorig:?/i, '') === suffix) {
      matched = obj;
    }
  });
  return matched;
}

export function extractWeaponAnchors(
  root: THREE.Object3D
): Partial<Record<IkAnchorId, THREE.Object3D>> {
  const anchors: Partial<Record<IkAnchorId, THREE.Object3D>> = {};
  for (const id of IK_ANCHOR_IDS) {
    const obj = root.getObjectByName(id);
    if (obj) anchors[id] = obj;
  }
  return anchors;
}

export function resolveWeaponPoseTags(
  root: THREE.Object3D,
  fallback: WeaponArchetypeId
): {
  archetype: WeaponArchetypeId;
  primaryPoseTag: FingerPoseTag;
  forendPoseTag?: FingerPoseTag;
  gripRakeRad: number;
} {
  const receiver = root.getObjectByName('Receiver');
  const ud = (receiver?.userData ?? {}) as {
    archetype?: string;
    loadout?: {
      underbarrel?: string;
      smgChassis?: string;
      gripRakeDeg?: number;
    };
  };

  const rawArch = ud.archetype;
  const archetype: WeaponArchetypeId =
    rawArch === 'pistol' ||
    rawArch === 'shotgun' ||
    rawArch === 'smg' ||
    rawArch === 'rpg'
      ? rawArch
      : fallback;

  const rakeDeg =
    typeof ud.loadout?.gripRakeDeg === 'number' ? ud.loadout.gripRakeDeg : 11;
  const gripRakeRad = THREE.MathUtils.degToRad(rakeDeg);

  if (archetype === 'pistol') {
    return { archetype, primaryPoseTag: 'pistol_grip', gripRakeRad };
  }
  if (archetype === 'shotgun') {
    return {
      archetype,
      primaryPoseTag: 'pistol_grip',
      forendPoseTag: 'forend_pump',
      gripRakeRad,
    };
  }
  if (archetype === 'smg') {
    const hasVertical =
      ud.loadout?.underbarrel === 'vertical-grip' ||
      ud.loadout?.smgChassis === 'thompson-1928' ||
      Boolean(root.getObjectByName('Thompson_WalnutVerticalForegrip'));
    return {
      archetype,
      primaryPoseTag: 'pistol_grip',
      forendPoseTag: hasVertical ? 'forend_vertical' : 'forend_angled',
      gripRakeRad,
    };
  }
  return {
    archetype: 'rpg',
    primaryPoseTag: poseTagForWeapon('rpg'),
    forendPoseTag: 'forend_angled',
    gripRakeRad,
  };
}

export async function loadWeaponRig(
  archetype: WeaponArchetypeId,
  urlOverride?: string,
  castShadow = false
): Promise<LoadedWeaponRig> {
  const url = urlOverride ?? WEAPON_GLB_URLS[archetype];
  let promise = templateCache.get(url);
  if (!promise) {
    promise = new Promise<THREE.Group>((resolve, reject) => {
      loader.load(
        url,
        (gltf) => resolve(gltf.scene),
        undefined,
        (err) => {
          templateCache.delete(url);
          reject(err);
        }
      );
    });
    templateCache.set(url, promise);
  }

  const template = await promise;
  const root = template.clone(true);
  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = castShadow;
      obj.receiveShadow = castShadow;
    }
  });

  const anchors = extractWeaponAnchors(root);
  const resolved = resolveWeaponPoseTags(root, archetype);
  return {
    archetype: resolved.archetype,
    root,
    anchors,
    primaryPoseTag: resolved.primaryPoseTag,
    forendPoseTag: resolved.forendPoseTag,
  };
}

export async function loadAndMountWeapon(
  npcRoot: THREE.Object3D,
  archetype: WeaponArchetypeId,
  targetHeightM: number,
  skeleton?: THREE.Skeleton | null,
  castShadow = false
): Promise<{ rig: LoadedWeaponRig; mountedGroup: THREE.Group | null }> {
  const rig = await loadWeaponRig(archetype, undefined, castShadow);
  const mountedGroup = mountWeaponToRightHand(npcRoot, rig, targetHeightM, skeleton);
  return { rig, mountedGroup };
}
