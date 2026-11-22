import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ImportedJunkSegment } from '../types/junk';
import { disposeImportedRoot, ensureMeshAttributes } from './junkImportSanitize';

export { disposeImportedRoot } from './junkImportSanitize';

const STRUCTURAL_NAME_RE = /(base|stand|pedestal|mount|anchor|frame)/i;

export interface ImportedGlbAsset {
  root: THREE.Group;
  fileName: string;
  segments: ImportedJunkSegment[];
  bboxSizeM: [number, number, number];
  normalizedExtent: number;
  halfExtents: [number, number, number];
  dispose: () => void;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function countMeshTriangles(geo: THREE.BufferGeometry): number {
  if (geo.index) return Math.floor(geo.index.count / 3);
  const pos = geo.attributes.position;
  return pos ? Math.floor(pos.count / 3) : 0;
}

/**
 * Applies segment destructibility and customName metadata onto an imported root's meshes.
 */
export function applySegmentsToImportedRoot(
  root: THREE.Object3D,
  segments: ImportedJunkSegment[]
): void {
  const byId = new Map(segments.map((s) => [s.segmentId, s]));
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const segId = obj.userData.segmentId as string | undefined;
    if (!segId) return;
    const seg = byId.get(segId);
    if (!seg) return;
    obj.userData.destructible = seg.destructible;
    obj.userData.customName = seg.customName;
  });
}

/**
 * Parses an ArrayBuffer containing a .glb/.gltf asset, normalizes scale/origin,
 * guarantees normals/UVs, and enumerates ImportedJunkSegment descriptors.
 */
export async function parseImportedGlbBuffer(
  buffer: ArrayBuffer,
  fileName = 'imported.glb'
): Promise<ImportedGlbAsset> {
  if (!buffer || buffer.byteLength === 0) {
    throw new Error(`Cannot import "${fileName}": file is empty (0 bytes).`);
  }

  const loader = new GLTFLoader();
  let gltf;
  try {
    gltf = await loader.parseAsync(buffer.slice(0), '');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse GLB "${fileName}": ${msg}`);
  }

  const scene = gltf.scene;
  const meshes: THREE.Mesh[] = [];
  try {
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.geometry?.attributes?.position) {
        ensureMeshAttributes(obj, fileName);
        meshes.push(obj);
      }
    });
  } catch (err) {
    disposeImportedRoot(scene);
    throw err;
  }

  if (meshes.length === 0) {
    disposeImportedRoot(scene);
    throw new Error(`GLB "${fileName}" contains no valid renderable meshes.`);
  }

  scene.updateMatrixWorld(true);
  const rawBox = new THREE.Box3().setFromObject(scene);
  const rawSize = new THREE.Vector3();
  rawBox.getSize(rawSize);
  const rawMax = Math.max(rawSize.x, rawSize.y, rawSize.z);

  if (!Number.isFinite(rawMax) || rawMax <= 1e-6) {
    disposeImportedRoot(scene);
    throw new Error(`GLB "${fileName}" has invalid or zero-size bounds.`);
  }

  // Normalize prop into [0.1m, 2.5m], targeting ~0.55m for oversized/tiny props
  let normScale = rawMax > 1.2 || rawMax < 0.25 ? 0.55 / rawMax : 1.0;
  const scaledMax = rawMax * normScale;
  if (scaledMax < 0.1) normScale = 0.1 / rawMax;
  if (scaledMax > 2.5) normScale = 2.5 / rawMax;

  scene.scale.multiplyScalar(normScale);
  scene.updateMatrixWorld(true);

  const centeredBox = new THREE.Box3().setFromObject(scene);
  const center = new THREE.Vector3();
  const normSize = new THREE.Vector3();
  centeredBox.getCenter(center);
  centeredBox.getSize(normSize);
  scene.position.sub(center);

  const root = new THREE.Group();
  root.name = fileName;
  root.add(scene);
  root.updateMatrixWorld(true);

  const hasNonStructural = meshes.some((m) => {
    const name = m.name || m.parent?.name || '';
    return !STRUCTURAL_NAME_RE.test(name);
  });

  const meshBox = new THREE.Box3();
  const meshSize = new THREE.Vector3();
  const segments: ImportedJunkSegment[] = meshes.map((mesh, idx) => {
    const segmentId = `seg_${idx}`;
    const originalName =
      mesh.name?.trim() || mesh.parent?.name?.trim() || `Segment ${idx + 1}`;
    const destructible = hasNonStructural
      ? !STRUCTURAL_NAME_RE.test(originalName)
      : true;

    meshBox.setFromObject(mesh);
    meshBox.getSize(meshSize);

    mesh.userData.segmentId = segmentId;
    mesh.userData.destructible = destructible;
    mesh.userData.customName = originalName;

    return {
      segmentId,
      originalName,
      customName: originalName,
      destructible,
      triCount: countMeshTriangles(mesh.geometry),
      bboxSizeM: [
        round4(Math.max(0.002, meshSize.x)),
        round4(Math.max(0.002, meshSize.y)),
        round4(Math.max(0.002, meshSize.z)),
      ],
    };
  });

  const bboxSizeM: [number, number, number] = [
    round4(Math.max(0.02, normSize.x)),
    round4(Math.max(0.02, normSize.y)),
    round4(Math.max(0.02, normSize.z)),
  ];
  const normalizedExtent = round4(Math.max(...bboxSizeM));
  const halfExtents: [number, number, number] = [
    Math.max(0.015, bboxSizeM[0] * 0.5),
    Math.max(0.015, bboxSizeM[1] * 0.5),
    Math.max(0.015, bboxSizeM[2] * 0.5),
  ];

  return {
    root,
    fileName,
    segments,
    bboxSizeM,
    normalizedExtent,
    halfExtents,
    dispose: () => disposeImportedRoot(root),
  };
}

/**
 * Fetches a .glb/.gltf URL (blob:, data:, or HTTP path) and parses it as an ImportedGlbAsset.
 */
export async function loadImportedGlbUrl(
  url: string,
  fileName = 'imported.glb'
): Promise<ImportedGlbAsset> {
  if (!url) throw new Error('No GLB URL provided.');
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch GLB "${fileName}" (${res.status}).`);
  }
  const buffer = await res.arrayBuffer();
  return parseImportedGlbBuffer(buffer, fileName);
}
