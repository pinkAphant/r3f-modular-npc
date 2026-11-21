import * as THREE from 'three';

export type NpcBuild = 'male' | 'female';

export interface SocketSpec {
  name: string;
  position: [number, number, number];
  color: string;
}

export interface PsxNpcResult {
  geometry: THREE.BufferGeometry;
  triCount: number;
  sockets: SocketSpec[];
}

interface RingDef {
  y: number;
  rx: number;
  rz: number;
  zOff?: number;
}

/**
 * Builds a low-poly lofted tube along Y with UV mapped into a sub-rectangle [u0,u1] x [v0,v1].
 * Keeps triangle count tight and predictable for the 500-tri PSX++ budget.
 */
function buildLoft(
  rings: RingDef[],
  sides: number,
  uvRect: [number, number, number, number],
  capBottom = true,
  capTop = true
): THREE.BufferGeometry {
  const [u0, v0, u1, v1] = uvRect;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const rowStride = sides + 1;
  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    const v = v0 + (v1 - v0) * (r / Math.max(1, rings.length - 1));
    for (let s = 0; s <= sides; s++) {
      // Angle 0 = +Z (front) so front faces center of UV island cleanly
      const theta = (s / sides) * Math.PI * 2;
      const x = Math.sin(theta) * ring.rx;
      const z = Math.cos(theta) * ring.rz + (ring.zOff ?? 0);
      positions.push(x, ring.y, z);
      const u = u0 + (u1 - u0) * (s / sides);
      uvs.push(u, v);
    }
  }

  for (let r = 0; r < rings.length - 1; r++) {
    for (let s = 0; s < sides; s++) {
      const a = r * rowStride + s;
      const b = a + 1;
      const c = (r + 1) * rowStride + s;
      const d = c + 1;
      indices.push(a, b, d, a, d, c);
    }
  }

  if (capBottom && rings.length > 0) {
    const cIdx = positions.length / 3;
    const r0 = rings[0];
    positions.push(0, r0.y, r0.zOff ?? 0);
    uvs.push((u0 + u1) * 0.5, v0);
    for (let s = 0; s < sides; s++) {
      indices.push(cIdx, s + 1, s);
    }
  }

  if (capTop && rings.length > 0) {
    const cIdx = positions.length / 3;
    const rLast = rings[rings.length - 1];
    const base = (rings.length - 1) * rowStride;
    positions.push(0, rLast.y, rLast.zOff ?? 0);
    uvs.push((u0 + u1) * 0.5, v1);
    for (let s = 0; s < sides; s++) {
      indices.push(cIdx, base + s, base + s + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

function mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVerts = 0;
  let totalIndices = 0;
  for (const g of geos) {
    totalVerts += g.attributes.position.count;
    totalIndices += g.index ? g.index.count : g.attributes.position.count;
  }

  const pos = new Float32Array(totalVerts * 3);
  const uv = new Float32Array(totalVerts * 2);
  const idx = new Uint32Array(totalIndices);

  let vOffset = 0;
  let iOffset = 0;
  for (const g of geos) {
    const pAttr = g.attributes.position;
    const uAttr = g.attributes.uv;
    pos.set(pAttr.array as Float32Array, vOffset * 3);
    uv.set(uAttr.array as Float32Array, vOffset * 2);
    if (g.index) {
      const arr = g.index.array;
      for (let i = 0; i < arr.length; i++) idx[iOffset + i] = arr[i] + vOffset;
      iOffset += arr.length;
    } else {
      for (let i = 0; i < pAttr.count; i++) idx[iOffset + i] = vOffset + i;
      iOffset += pAttr.count;
    }
    vOffset += pAttr.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  merged.setIndex(new THREE.BufferAttribute(idx, 1));
  merged.computeVertexNormals();
  return merged;
}

/**
 * Generates a ~500-tri PSX++ / N64++ humanoid base mesh in SI meters (+Z forward, Y up).
 * UV Atlas layout:
 * - Top-Left     [0.00..0.50, 0.50..1.00]: Head & Neck
 * - Top-Right    [0.50..1.00, 0.50..1.00]: Torso & Pelvis
 * - Bottom-Left  [0.00..0.50, 0.00..0.50]: Legs & Feet
 * - Bottom-Right [0.50..1.00, 0.00..0.50]: Arms & Hands
 */
export function buildPsxNpc(build: NpcBuild): PsxNpcResult {
  const isF = build === 'female';
  const scaleH = isF ? 0.96 : 1.0;
  const shoulderW = isF ? 0.175 : 0.21;
  const chestRx = isF ? 0.155 : 0.19;
  const chestRz = isF ? 0.115 : 0.12;
  const waistRx = isF ? 0.12 : 0.155;
  const hipRx = isF ? 0.165 : 0.16;
  const hipX = isF ? 0.088 : 0.095;

  const parts: THREE.BufferGeometry[] = [];

  // 1. Head + Neck (8-sided, 6 rings -> ~96 tris)
  const head = buildLoft(
    [
      { y: 1.43, rx: 0.055, rz: 0.055 },
      { y: 1.50, rx: 0.052, rz: 0.052 },
      { y: 1.54, rx: 0.085, rz: 0.095, zOff: 0.01 },
      { y: 1.63, rx: 0.102, rz: 0.112, zOff: 0.008 },
      { y: 1.72, rx: 0.095, rz: 0.105, zOff: 0.0 },
      { y: 1.78, rx: 0.048, rz: 0.052, zOff: -0.005 },
    ],
    8,
    [0.02, 0.52, 0.48, 0.98]
  );
  parts.push(head);

  // 2. Torso + Pelvis (8-sided, 6 rings -> ~96 tris)
  const torso = buildLoft(
    [
      { y: 0.84, rx: hipRx * 0.82, rz: 0.105 },
      { y: 0.96, rx: hipRx, rz: 0.115 },
      { y: 1.12, rx: waistRx, rz: 0.10 },
      { y: 1.28, rx: chestRx, rz: chestRz, zOff: isF ? 0.015 : 0.005 },
      { y: 1.41, rx: shoulderW, rz: 0.10 },
      { y: 1.45, rx: 0.065, rz: 0.065 },
    ],
    8,
    [0.52, 0.52, 0.98, 0.98]
  );
  parts.push(torso);

  // 3. Arms + Mitten Hands (6-sided, 5 rings per arm -> ~60 tris x 2 = 120 tris)
  for (const side of [-1, 1] as const) {
    const arm = buildLoft(
      [
        { y: 0.0, rx: 0.052, rz: 0.052 },
        { y: -0.26, rx: 0.044, rz: 0.044 },
        { y: -0.50, rx: 0.036, rz: 0.036 },
        { y: -0.59, rx: 0.042, rz: 0.028 }, // Mitten palm
        { y: -0.66, rx: 0.028, rz: 0.020 }, // Mitten tip
      ],
      6,
      [0.52, 0.02, 0.98, 0.48]
    );
    arm.rotateZ(side * 0.62); // ~35 deg A-pose
    arm.translate(side * (shoulderW + 0.015), 1.37, 0);
    parts.push(arm);
  }

  // 4. Legs + Wedge Feet (6-sided, 6 rings per leg -> ~72 tris x 2 = 144 tris)
  for (const side of [-1, 1] as const) {
    const leg = buildLoft(
      [
        { y: 0.0, rx: 0.052, rz: 0.105, zOff: 0.045 }, // Foot sole
        { y: 0.07, rx: 0.046, rz: 0.068, zOff: 0.015 }, // Ankle
        { y: 0.44, rx: 0.054, rz: 0.056 }, // Knee
        { y: 0.68, rx: isF ? 0.074 : 0.072, rz: 0.076 }, // Mid-thigh
        { y: 0.88, rx: isF ? 0.082 : 0.08, rz: 0.082 }, // Hip joint
      ],
      6,
      [0.02, 0.02, 0.48, 0.48]
    );
    leg.translate(side * hipX, 0, 0);
    parts.push(leg);
  }

  const geometry = mergeGeometries(parts);
  if (scaleH !== 1.0) {
    geometry.scale(1, scaleH, 1);
  }

  const triCount = geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;

  const armAngle = 0.62;
  const handDist = 0.61;
  const handX = shoulderW + 0.015 + Math.sin(armAngle) * handDist;
  const handY = (1.37 - Math.cos(armAngle) * handDist) * scaleH;

  const sockets: SocketSpec[] = [
    { name: 'Socket_Head', position: [0, 1.74 * scaleH, 0], color: '#38bdf8' },
    { name: 'Socket_Hand_R', position: [-handX, handY, 0.02], color: '#f97316' },
    { name: 'Socket_Hand_L', position: [handX, handY, 0.02], color: '#a855f7' },
    { name: 'Socket_Back', position: [0, 1.24 * scaleH, -0.14], color: '#22c55e' },
  ];

  return { geometry, triCount, sockets };
}
