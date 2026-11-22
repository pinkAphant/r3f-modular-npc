import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { FingerPoseTag } from '../types/posing';
import type { FingerPoser } from './fingerPoser';
import { findNpcBone } from './weaponLoader';
import type { WiggleRigController } from './wiggleRig';

const gltfSyncCache = new Map<string, GLTF>();
const gltfPendingCache = new Map<string, Promise<GLTF>>();
const npcGltfLoader = new GLTFLoader();

function cloneNpcGltf(gltf: GLTF): {
  root: THREE.Group;
  animations: THREE.AnimationClip[];
} {
  const root = cloneSkinned(gltf.scene) as THREE.Group;
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && mesh.material) {
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((m) => m.clone())
        : mesh.material.clone();
    }
  });
  return { root, animations: gltf.animations };
}

export function getCachedNpcAnimNames(url: string): string[] {
  const cached = gltfSyncCache.get(url);
  return cached ? cached.animations.map((c) => c.name) : [];
}

export function getCachedNpcGltfSync(
  url: string
): { root: THREE.Group; animations: THREE.AnimationClip[] } | null {
  const cached = gltfSyncCache.get(url);
  return cached ? cloneNpcGltf(cached) : null;
}

export async function loadCachedNpcGltf(
  url: string
): Promise<{ root: THREE.Group; animations: THREE.AnimationClip[] }> {
  const cached = gltfSyncCache.get(url);
  if (cached) return cloneNpcGltf(cached);
  const isAsset = !url.startsWith('blob:');
  let promise = isAsset ? gltfPendingCache.get(url) : undefined;
  if (!promise) {
    promise = new Promise<GLTF>((resolve, reject) => {
      npcGltfLoader.load(
        url,
        (gltf) => {
          if (isAsset) gltfSyncCache.set(url, gltf);
          resolve(gltf);
        },
        undefined,
        reject
      );
    });
    if (isAsset) gltfPendingCache.set(url, promise);
  }
  const gltf = await promise;
  return cloneNpcGltf(gltf);
}

const SOCKET_SPECS: Array<{ suffix: string; name: string; color: string }> = [
  { suffix: 'RightHand', name: 'Socket_Hand_R', color: '#f97316' },
  { suffix: 'LeftHand', name: 'Socket_Hand_L', color: '#a855f7' },
  { suffix: 'Head', name: 'Socket_Head', color: '#38bdf8' },
  { suffix: 'Spine2', name: 'Socket_Back', color: '#22c55e' },
];

export function normalizeNpcHeight(
  root: THREE.Object3D,
  targetHeightM: number
): void {
  const box = new THREE.Box3().setFromObject(root);
  const height = box.max.y - box.min.y;
  if (Number.isFinite(height) && height > 1e-4) {
    root.scale.setScalar(targetHeightM / height);
    root.updateMatrixWorld(true);
    const scaledBox = new THREE.Box3().setFromObject(root);
    if (Number.isFinite(scaledBox.min.y)) {
      root.position.y -= scaledBox.min.y;
    }
  } else if (Number.isFinite(box.min.y)) {
    root.position.y -= box.min.y;
  }
}

export function inspectNpcScene(
  root: THREE.Object3D,
  origMaps: Map<THREE.Material, THREE.Texture | null>
): { tris: number; boneCount: number; skeleton: THREE.Skeleton | null } {
  let tris = 0;
  let boneCount = 0;
  let skeleton: THREE.Skeleton | null = null;
  origMaps.clear();

  root.traverse((obj) => {
    if ((obj as THREE.Bone).isBone) boneCount++;
    const skinned = obj as THREE.SkinnedMesh;
    if (skinned.isSkinnedMesh && !skeleton) {
      skeleton = skinned.skeleton;
    }
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const g = mesh.geometry;
      tris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
      const rawMat = mesh.material;
      const mats: THREE.Material[] = Array.isArray(rawMat) ? rawMat : [rawMat];
      mats.forEach((m) => {
        origMaps.set(m, (m as THREE.MeshStandardMaterial).map ?? null);
      });
    }
  });

  return { tris: Math.round(tris), boneCount, skeleton };
}

export function attachSocketMarkers(
  root: THREE.Object3D,
  skeleton: THREE.Skeleton | null,
  showSockets: boolean
): THREE.Object3D[] {
  const markers: THREE.Object3D[] = [];
  for (const spec of SOCKET_SPECS) {
    const bone = findNpcBone(root, spec.suffix, skeleton);
    if (!bone) continue;
    const marker = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.035, 0),
      new THREE.MeshBasicMaterial({ color: spec.color, wireframe: true })
    );
    marker.name = spec.name;
    marker.visible = showSockets;
    bone.add(marker);
    markers.push(marker);
  }
  return markers;
}

export function applyNpcAppearance(
  root: THREE.Object3D,
  origMaps: Map<THREE.Material, THREE.Texture | null>,
  markers: THREE.Object3D[],
  wireframe: boolean,
  customTex: THREE.Texture | null,
  showSockets: boolean
): void {
  root.traverse((obj) => {
    if (
      (obj as THREE.Mesh).isMesh &&
      !obj.name.startsWith('Socket_') &&
      !obj.userData?.isWeaponAttachment
    ) {
      const rawMat = (obj as THREE.Mesh).material;
      const mats: THREE.Material[] = Array.isArray(rawMat) ? rawMat : [rawMat];
      mats.forEach((m) => {
        const std = m as THREE.MeshStandardMaterial;
        std.wireframe = wireframe;
        std.map = customTex ?? origMaps.get(m) ?? null;
        std.needsUpdate = true;
      });
    }
  });
  for (const m of markers) {
    m.visible = showSockets;
  }
}

export function resolveFallbackAnim(
  clipsOrNames: string[] | Record<string, unknown>
): string | null {
  const names = Array.isArray(clipsOrNames)
    ? clipsOrNames
    : Object.keys(clipsOrNames).filter((k) => Boolean(clipsOrNames[k]));
  if (names.length === 0) return null;
  const preferred = [
    'idle',
    'idle.001',
    'aiming a shotgun.001',
    'aiming a one handed gangstar pistol.001',
  ];
  for (const p of preferred) {
    if (names.includes(p)) return p;
  }
  return names[0];
}

export function applyNpcClipTransition(
  mixer: THREE.AnimationMixer,
  clips: Record<string, THREE.AnimationClip>,
  actions: Record<string, THREE.AnimationAction>,
  prevAction: THREE.AnimationAction | null,
  activeAnim: string | null,
  crossfadeSec: number,
  fingerPoser: FingerPoser | null,
  poseTag: FingerPoseTag,
  poseWeight: number,
  root: THREE.Object3D | null,
  wiggleRig: WiggleRigController | null
): THREE.AnimationAction | null {
  const targetName =
    activeAnim && clips[activeAnim] ? activeAnim : resolveFallbackAnim(clips);
  if (!targetName) return prevAction;
  const next =
    actions[targetName] ?? (actions[targetName] = mixer.clipAction(clips[targetName]));
  if (!next || next === prevAction) return prevAction;
  if (!prevAction) {
    next.reset().play();
    mixer.update(0);
    fingerPoser?.apply(poseTag, poseWeight, 1);
    root?.updateMatrixWorld(true);
    wiggleRig?.reset();
  } else {
    const fade = Math.max(0.01, crossfadeSec);
    fingerPoser?.resetBasePose();
    next.reset().fadeIn(fade).play();
    prevAction.fadeOut(fade);
  }
  return next;
}
