import * as THREE from 'three';

export interface PedestalSlot {
  id: string;
  distanceM: number;
  position: [number, number, number];
}

export const FIRING_LINE_Z = 0;
export const PEDESTAL_HEIGHT = 0.9;

export const RANGE_PEDESTAL_SLOTS: PedestalSlot[] = [
  { id: 'p-5m-l', distanceM: 5, position: [-4.5, PEDESTAL_HEIGHT, -5] },
  { id: 'p-5m-r', distanceM: 5, position: [4.5, PEDESTAL_HEIGHT, -5] },
  { id: 'p-10m-l', distanceM: 10, position: [-6, PEDESTAL_HEIGHT, -10] },
  { id: 'p-10m-c', distanceM: 10, position: [0, PEDESTAL_HEIGHT, -10] },
  { id: 'p-10m-r', distanceM: 10, position: [6, PEDESTAL_HEIGHT, -10] },
  { id: 'p-20m-l', distanceM: 20, position: [-4.5, PEDESTAL_HEIGHT, -20] },
  { id: 'p-20m-r', distanceM: 20, position: [4.5, PEDESTAL_HEIGHT, -20] },
  { id: 'p-30m-l', distanceM: 30, position: [-6, PEDESTAL_HEIGHT, -30] },
  { id: 'p-30m-c', distanceM: 30, position: [0, PEDESTAL_HEIGHT, -30] },
  { id: 'p-30m-r', distanceM: 30, position: [6, PEDESTAL_HEIGHT, -30] },
];

export const DISTANCE_MARKERS = [
  { z: -5, label: '5m', color: '#10b981' },
  { z: -10, label: '10m', color: '#38bdf8' },
  { z: -20, label: '20m', color: '#f59e0b' },
  { z: -30, label: '30m', color: '#ef4444' },
] as const;

const signTexCache = new Map<string, THREE.CanvasTexture>();

export function getDistanceSignTex(
  label: string,
  color: string
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const key = `${label}:${color}`;
  const hit = signTexCache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, 128, 64);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 124, 60);
    ctx.fillStyle = color;
    ctx.font = 'bold 34px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 64, 33);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 1;
  signTexCache.set(key, tex);
  return tex;
}

let cachedGridTex: THREE.CanvasTexture | null = null;

export function getRangeGridTex(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  if (cachedGridTex) return cachedGridTex;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(28, 48);
  tex.anisotropy = 1;
  cachedGridTex = tex;
  return tex;
}

export interface RangeArenaMaterials {
  floor: THREE.MeshStandardMaterial;
  firingStripe: THREE.MeshStandardMaterial;
  wall: THREE.MeshStandardMaterial;
  backstop: THREE.MeshStandardMaterial;
  baffle: THREE.MeshStandardMaterial;
  divider: THREE.MeshStandardMaterial;
  bench: THREE.MeshStandardMaterial;
  shelf: THREE.MeshStandardMaterial;
  pedestal: THREE.MeshStandardMaterial;
  post: THREE.MeshStandardMaterial;
  crate: THREE.MeshStandardMaterial;
  barrel: THREE.MeshStandardMaterial;
  starterBlock: THREE.MeshStandardMaterial;
}

let cachedMats: RangeArenaMaterials | null = null;
const colorMatCache = new Map<string, THREE.MeshStandardMaterial>();
const signMatCache = new Map<string, THREE.MeshStandardMaterial>();

export function getRangeArenaMaterials(): RangeArenaMaterials {
  if (cachedMats) return cachedMats;
  const gridTex = getRangeGridTex();
  cachedMats = {
    floor: new THREE.MeshStandardMaterial({
      color: gridTex ? '#ffffff' : '#18181b',
      map: gridTex ?? undefined,
      roughness: 0.92,
    }),
    firingStripe: new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.7 }),
    wall: new THREE.MeshStandardMaterial({ color: '#27272a', roughness: 0.85 }),
    backstop: new THREE.MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.65,
      metalness: 0.35,
    }),
    baffle: new THREE.MeshStandardMaterial({
      color: '#334155',
      roughness: 0.5,
      metalness: 0.5,
    }),
    divider: new THREE.MeshStandardMaterial({ color: '#3f3f46', roughness: 0.75 }),
    bench: new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.8 }),
    shelf: new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.85 }),
    pedestal: new THREE.MeshStandardMaterial({ color: '#3f3f46', roughness: 0.85 }),
    post: new THREE.MeshStandardMaterial({ color: '#27272a', roughness: 0.8 }),
    crate: new THREE.MeshStandardMaterial({ color: '#92400e', roughness: 0.85 }),
    barrel: new THREE.MeshStandardMaterial({
      color: '#0284c7',
      roughness: 0.55,
      metalness: 0.25,
    }),
    starterBlock: new THREE.MeshStandardMaterial({ color: '#f97316', roughness: 0.6 }),
  };
  return cachedMats;
}

export function getCachedColorMat(
  color: string,
  roughness: number
): THREE.MeshStandardMaterial {
  const key = `${color}:${roughness}`;
  let mat = colorMatCache.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({ color, roughness });
    colorMatCache.set(key, mat);
  }
  return mat;
}

export function getDistanceSignMat(
  label: string,
  color: string
): THREE.MeshStandardMaterial {
  const key = `${label}:${color}`;
  let mat = signMatCache.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      map: getDistanceSignTex(label, color) ?? undefined,
      roughness: 0.85,
      metalness: 0.05,
    });
    signMatCache.set(key, mat);
  }
  return mat;
}
