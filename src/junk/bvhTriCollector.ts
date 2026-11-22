import * as THREE from 'three';

export interface ShardTri {
  p: [number, number, number, number, number, number, number, number, number];
  n: [number, number, number, number, number, number, number, number, number];
  uv: [number, number, number, number, number, number];
  cx: number;
  cy: number;
  cz: number;
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

const MIN_AREA2 = 1e-10;

function allFinite(...vals: number[]): boolean {
  for (let i = 0; i < vals.length; i++) {
    if (!Number.isFinite(vals[i])) return false;
  }
  return true;
}

/**
 * Collects valid root-space triangles from destructible meshes inside rootObj,
 * skipping decals, gizmos, ShaderMaterials, and non-finite/degenerate triangles.
 */
export function collectValidTris(rootObj: THREE.Object3D): ShardTri[] {
  rootObj.updateMatrixWorld(true);
  const invRootMat = new THREE.Matrix4().copy(rootObj.matrixWorld).invert();
  const meshToRoot = new THREE.Matrix4();
  const normalMat = new THREE.Matrix3();

  const candidateMeshes: THREE.Mesh[] = [];
  rootObj.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    if (obj.userData.isDecal || obj.userData.isGizmo) return;
    if (
      obj.material instanceof THREE.ShaderMaterial ||
      (Array.isArray(obj.material) &&
        obj.material.every((m) => m instanceof THREE.ShaderMaterial))
    ) {
      return;
    }
    if (!obj.geometry?.attributes?.position) return;
    candidateMeshes.push(obj);
  });

  const hasDestructible = candidateMeshes.some(
    (m) => m.userData.destructible !== false
  );

  const tris: ShardTri[] = [];
  const v0 = new THREE.Vector3();
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const faceN = new THREE.Vector3();
  const n0 = new THREE.Vector3();
  const n1 = new THREE.Vector3();
  const n2 = new THREE.Vector3();

  for (const mesh of candidateMeshes) {
    if (hasDestructible && mesh.userData.destructible === false) continue;

    const origGeo = mesh.geometry;
    const isIndexed = origGeo.index !== null;
    const src = isIndexed ? origGeo.toNonIndexed() : origGeo;

    try {
      const posAttr = src.attributes.position;
      const normAttr = src.attributes.normal;
      const uvAttr = src.attributes.uv;
      const triCount = Math.floor(posAttr.count / 3);
      if (triCount <= 0) continue;

      meshToRoot.multiplyMatrices(invRootMat, mesh.matrixWorld);
      normalMat.getNormalMatrix(meshToRoot);

      for (let t = 0; t < triCount; t++) {
        const i0 = t * 3;
        v0.fromBufferAttribute(posAttr, i0).applyMatrix4(meshToRoot);
        v1.fromBufferAttribute(posAttr, i0 + 1).applyMatrix4(meshToRoot);
        v2.fromBufferAttribute(posAttr, i0 + 2).applyMatrix4(meshToRoot);

        if (!allFinite(v0.x, v0.y, v0.z, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z)) {
          continue;
        }

        e1.subVectors(v1, v0);
        e2.subVectors(v2, v0);
        faceN.crossVectors(e1, e2);
        const area2 = faceN.length();
        if (!Number.isFinite(area2) || area2 < MIN_AREA2) continue;
        faceN.divideScalar(area2);

        if (normAttr) {
          n0.fromBufferAttribute(normAttr, i0).applyMatrix3(normalMat);
          n1.fromBufferAttribute(normAttr, i0 + 1).applyMatrix3(normalMat);
          n2.fromBufferAttribute(normAttr, i0 + 2).applyMatrix3(normalMat);
          if (n0.lengthSq() > 1e-10) n0.normalize();
          else n0.copy(faceN);
          if (n1.lengthSq() > 1e-10) n1.normalize();
          else n1.copy(faceN);
          if (n2.lengthSq() > 1e-10) n2.normalize();
          else n2.copy(faceN);
        } else {
          n0.copy(faceN);
          n1.copy(faceN);
          n2.copy(faceN);
        }

        const u0 = uvAttr ? uvAttr.getX(i0) : 0;
        const w0 = uvAttr ? uvAttr.getY(i0) : 0;
        const u1 = uvAttr ? uvAttr.getX(i0 + 1) : 0;
        const w1 = uvAttr ? uvAttr.getY(i0 + 1) : 0;
        const u2 = uvAttr ? uvAttr.getX(i0 + 2) : 0;
        const w2 = uvAttr ? uvAttr.getY(i0 + 2) : 0;

        tris.push({
          p: [v0.x, v0.y, v0.z, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z],
          n: [n0.x, n0.y, n0.z, n1.x, n1.y, n1.z, n2.x, n2.y, n2.z],
          uv: [
            Number.isFinite(u0) ? u0 : 0,
            Number.isFinite(w0) ? w0 : 0,
            Number.isFinite(u1) ? u1 : 0,
            Number.isFinite(w1) ? w1 : 0,
            Number.isFinite(u2) ? u2 : 0,
            Number.isFinite(w2) ? w2 : 0,
          ],
          cx: (v0.x + v1.x + v2.x) / 3,
          cy: (v0.y + v1.y + v2.y) / 3,
          cz: (v0.z + v1.z + v2.z) / 3,
          minX: Math.min(v0.x, v1.x, v2.x),
          minY: Math.min(v0.y, v1.y, v2.y),
          minZ: Math.min(v0.z, v1.z, v2.z),
          maxX: Math.max(v0.x, v1.x, v2.x),
          maxY: Math.max(v0.y, v1.y, v2.y),
          maxZ: Math.max(v0.z, v1.z, v2.z),
        });
      }
    } finally {
      if (isIndexed) src.dispose();
    }
  }

  return tris;
}
