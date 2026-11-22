import * as THREE from 'three';
import type { ShardSpec } from '../types/junk';
import { collectValidTris, type ShardTri } from './bvhTriCollector';

const MIN_HALF_EXTENT = 0.015;

function partitionTris(
  tris: ShardTri[],
  start: number,
  count: number,
  pieces: number
): Array<[number, number]> {
  if (pieces <= 1 || count <= 1) return [[start, count]];

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (let i = start; i < start + count; i++) {
    const t = tris[i];
    if (t.minX < minX) minX = t.minX;
    if (t.minY < minY) minY = t.minY;
    if (t.minZ < minZ) minZ = t.minZ;
    if (t.maxX > maxX) maxX = t.maxX;
    if (t.maxY > maxY) maxY = t.maxY;
    if (t.maxZ > maxZ) maxZ = t.maxZ;
  }

  const ex = maxX - minX;
  const ey = maxY - minY;
  const ez = maxZ - minZ;
  const axis = ex >= ey && ex >= ez ? 0 : ey >= ez ? 1 : 2;

  const slice = tris.slice(start, start + count);
  slice.sort((a, b) =>
    axis === 0 ? a.cx - b.cx : axis === 1 ? a.cy - b.cy : a.cz - b.cz
  );
  for (let i = 0; i < count; i++) tris[start + i] = slice[i];

  const leftPieces = Math.floor(pieces / 2);
  const rightPieces = pieces - leftPieces;
  const mid = Math.max(
    1,
    Math.min(count - 1, Math.round(count * (leftPieces / pieces)))
  );

  return [
    ...partitionTris(tris, start, mid, leftPieces),
    ...partitionTris(tris, start + mid, count - mid, rightPieces),
  ];
}

/**
 * Splits any single- or multi-mesh Object3D into independent centroid-centered
 * BVH shard geometries ready for Rapier dynamic RigidBodies + CuboidColliders.
 */
export function splitObjectIntoShards(
  rootObj: THREE.Object3D,
  targetPieces: number
): ShardSpec[] {
  const tris = collectValidTris(rootObj);
  if (tris.length === 0) return [];

  const safePieces = Number.isFinite(targetPieces) ? targetPieces : 6;
  const desired = Math.max(1, Math.min(Math.round(safePieces), tris.length));
  const leaves = partitionTris(tris, 0, tris.length, desired);

  const rawVolumes: number[] = [];
  let totalVol = 0;

  const shards: ShardSpec[] = leaves.map(([start, count], idx) => {
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    for (let i = start; i < start + count; i++) {
      const t = tris[i];
      if (t.minX < minX) minX = t.minX;
      if (t.minY < minY) minY = t.minY;
      if (t.minZ < minZ) minZ = t.minZ;
      if (t.maxX > maxX) maxX = t.maxX;
      if (t.maxY > maxY) maxY = t.maxY;
      if (t.maxZ > maxZ) maxZ = t.maxZ;
    }

    const cx = (minX + maxX) * 0.5;
    const cy = (minY + maxY) * 0.5;
    const cz = (minZ + maxZ) * 0.5;

    const posArr = new Float32Array(count * 9);
    const normArr = new Float32Array(count * 9);
    const uvArr = new Float32Array(count * 6);

    for (let i = 0; i < count; i++) {
      const t = tris[start + i];
      const pOff = i * 9;
      for (let v = 0; v < 3; v++) {
        posArr[pOff + v * 3] = t.p[v * 3] - cx;
        posArr[pOff + v * 3 + 1] = t.p[v * 3 + 1] - cy;
        posArr[pOff + v * 3 + 2] = t.p[v * 3 + 2] - cz;
        normArr[pOff + v * 3] = t.n[v * 3];
        normArr[pOff + v * 3 + 1] = t.n[v * 3 + 1];
        normArr[pOff + v * 3 + 2] = t.n[v * 3 + 2];
      }
      uvArr.set(t.uv, i * 6);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normArr, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    const hx = Math.max(MIN_HALF_EXTENT, (maxX - minX) * 0.5);
    const hy = Math.max(MIN_HALF_EXTENT, (maxY - minY) * 0.5);
    const hz = Math.max(MIN_HALF_EXTENT, (maxZ - minZ) * 0.5);
    const boxVol = 8 * hx * hy * hz;
    rawVolumes.push(boxVol);
    totalVol += boxVol;

    return {
      id: `shard_${idx}`,
      geometry,
      centroid: [cx, cy, cz],
      halfExtents: [hx, hy, hz],
      volumeFraction: 1 / leaves.length,
    };
  });

  if (totalVol > 0) {
    for (let i = 0; i < shards.length; i++) {
      shards[i].volumeFraction = rawVolumes[i] / totalVol;
    }
  }

  return shards;
}
