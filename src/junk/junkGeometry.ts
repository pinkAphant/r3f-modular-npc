import * as THREE from 'three';
import type { CanLodMode } from '../types/junk';

export const TIN_CAN_RADIUS = 0.085;
export const TIN_CAN_HEIGHT = 0.25;
export const BOTTLE_HEIGHT = 0.32;
export const CAN_LOD_THRESHOLD_M = 14;

export type ResolvedCanLod = '3-gon' | '12-gon';

/**
 * Selects concrete tin-can geometry LOD from camera distance and mode.
 */
export function selectCanLod(
  distanceM: number,
  mode: CanLodMode
): ResolvedCanLod {
  if (mode === '3-gon' || mode === '12-gon') return mode;
  return distanceM > CAN_LOD_THRESHOLD_M ? '3-gon' : '12-gon';
}

/**
 * Counts triangles for indexed or non-indexed BufferGeometry.
 */
export function countGeometryTriangles(geometry: THREE.BufferGeometry): number {
  if (geometry.index) {
    return Math.floor(geometry.index.count / 3);
  }
  const pos = geometry.attributes.position;
  return pos ? Math.floor(pos.count / 3) : 0;
}

/**
 * Builds procedural Tin Can geometry for '3-gon' (12 tris) or '12-gon' (72 tris).
 * Uses thetaStart = Math.PI so the UV seam is at -Z and u = 0.5 faces +Z.
 * Preserves multi-material groups: 0 = label sleeve, 1 = top cap, 2 = bottom cap.
 */
export function buildTinCanGeometry(lod: ResolvedCanLod): THREE.BufferGeometry {
  if (lod === '3-gon') {
    const indexed = new THREE.CylinderGeometry(
      TIN_CAN_RADIUS,
      TIN_CAN_RADIUS,
      TIN_CAN_HEIGHT,
      3,
      1,
      false,
      Math.PI,
      Math.PI * 2
    );
    const geo = indexed.toNonIndexed();
    indexed.dispose();
    // Crisp flat normals per triangle face for Dreamcast shading & <Decal>
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    return geo;
  }

  // 12-gon segmented cylinder: 12 * 2 * 2 side + 12 top + 12 bottom = 72 tris (>= 48)
  const geo = new THREE.CylinderGeometry(
    TIN_CAN_RADIUS,
    TIN_CAN_RADIUS,
    TIN_CAN_HEIGHT,
    12,
    2,
    false,
    Math.PI,
    Math.PI * 2
  );
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Builds procedural clearish glass bottle LatheGeometry ordered bottom-to-top
 * with phiStart = Math.PI and height-normalized uv.y so labels wrap cleanly.
 */
export function buildGlassBottleGeometry(): THREE.BufferGeometry {
  const halfH = BOTTLE_HEIGHT * 0.5;
  // Ordered strictly bottom-to-top, all radii >= 0.0001
  const profile: THREE.Vector2[] = [
    new THREE.Vector2(0.0001, -halfH),
    new THREE.Vector2(0.048, -halfH),
    new THREE.Vector2(0.055, -halfH + 0.015),
    new THREE.Vector2(0.055, 0.01),
    new THREE.Vector2(0.046, 0.045),
    new THREE.Vector2(0.022, 0.085),
    new THREE.Vector2(0.02, 0.135),
    new THREE.Vector2(0.025, 0.148),
    new THREE.Vector2(0.024, halfH),
    new THREE.Vector2(0.0001, halfH),
  ];

  const geo = new THREE.LatheGeometry(profile, 12, Math.PI, Math.PI * 2);

  // Height-normalize uv.y across [minY, maxY] to prevent lathe segment squash
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const spanY = BOTTLE_HEIGHT;
  for (let i = 0; i < pos.count; i++) {
    const normV = THREE.MathUtils.clamp((pos.getY(i) + halfH) / spanY, 0, 1);
    uv.setY(i, normV);
  }
  uv.needsUpdate = true;

  if (!geo.attributes.normal) {
    geo.computeVertexNormals();
  }
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Creates Dreamcast-compatible clearish glass material.
 */
export function createGlassBottleMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: '#a7f3d0',
    transparent: true,
    opacity: 0.42,
    roughness: 0.12,
    metalness: 0.1,
    depthWrite: false,
  });
}

/**
 * Creates tin can multi-material array [label sleeve, top lid, bottom lid].
 */
export function createTinCanMaterials(
  labelTexture: THREE.Texture | null
): [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial, THREE.MeshStandardMaterial] {
  const sleeve = new THREE.MeshStandardMaterial({
    color: labelTexture ? '#ffffff' : '#e2e8f0',
    map: labelTexture ?? null,
    roughness: 0.48,
    metalness: 0.15,
  });
  const topCap = new THREE.MeshStandardMaterial({
    color: '#cbd5e1',
    roughness: 0.34,
    metalness: 0.78,
  });
  const botCap = new THREE.MeshStandardMaterial({
    color: '#94a3b8',
    roughness: 0.38,
    metalness: 0.78,
  });
  return [sleeve, topCap, botCap];
}
