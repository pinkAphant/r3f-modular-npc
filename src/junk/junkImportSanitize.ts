import * as THREE from 'three';

const TEXTURE_KEYS = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'emissiveMap',
  'aoMap',
  'alphaMap',
] as const;

export function ensureMeshAttributes(mesh: THREE.Mesh, fileName: string): void {
  const geo = mesh.geometry;
  const pos = geo?.attributes?.position;
  if (!pos) return;

  for (let i = 0; i < pos.count; i++) {
    if (
      !Number.isFinite(pos.getX(i)) ||
      !Number.isFinite(pos.getY(i)) ||
      !Number.isFinite(pos.getZ(i))
    ) {
      throw new Error(`GLB "${fileName}" contains non-finite vertex coordinates.`);
    }
  }

  if (geo.index) {
    const index = geo.index;
    for (let i = 0; i < index.count; i++) {
      const idx = index.getX(i);
      if (!Number.isInteger(idx) || idx < 0 || idx >= pos.count) {
        throw new Error(`GLB "${fileName}" contains out-of-bounds triangle indices.`);
      }
    }
  }

  if (geo.attributes.normal) {
    const norm = geo.attributes.normal;
    let normDirty = false;
    for (let i = 0; i < norm.count; i++) {
      if (
        !Number.isFinite(norm.getX(i)) ||
        !Number.isFinite(norm.getY(i)) ||
        !Number.isFinite(norm.getZ(i))
      ) {
        norm.setXYZ(i, 0, 1, 0);
        normDirty = true;
      }
    }
    if (normDirty) norm.needsUpdate = true;
  }

  geo.computeBoundingBox();
  if (!geo.attributes.normal) geo.computeVertexNormals();

  if (geo.attributes.uv) {
    const uv = geo.attributes.uv;
    let uvDirty = false;
    for (let i = 0; i < uv.count; i++) {
      if (!Number.isFinite(uv.getX(i)) || !Number.isFinite(uv.getY(i))) {
        uv.setXY(i, 0, 0);
        uvDirty = true;
      }
    }
    if (uvDirty) uv.needsUpdate = true;
  } else {
    geo.setAttribute(
      'uv',
      new THREE.Float32BufferAttribute(new Float32Array(pos.count * 2), 2)
    );
  }

  mesh.castShadow = true;
  mesh.receiveShadow = true;
}

/**
 * Disposes all geometries, materials, and textures owned by an imported Object3D.
 */
export function disposeImportedRoot(root: THREE.Object3D): void {
  const disposedMats = new Set<THREE.Material>();
  const disposedTex = new Set<THREE.Texture>();

  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    obj.geometry?.dispose();
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!mat || disposedMats.has(mat)) continue;
      disposedMats.add(mat);
      const record = mat as unknown as Record<string, unknown>;
      for (const key of TEXTURE_KEYS) {
        const val = record[key];
        if (val instanceof THREE.Texture && !disposedTex.has(val)) {
          disposedTex.add(val);
          val.dispose();
        }
      }
      mat.dispose();
    }
  });
}
