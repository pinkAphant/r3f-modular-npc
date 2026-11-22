import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseGlb, readAccessor, validateEmbeddedImages, countNonFinite } from './glbParser.mjs';

const MIXAMO_65_BONES = [
  'mixamorig:Hips', 'mixamorig:LeftUpLeg', 'mixamorig:LeftLeg', 'mixamorig:LeftFoot',
  'mixamorig:LeftToeBase', 'mixamorig:LeftToe_End', 'mixamorig:RightUpLeg', 'mixamorig:RightLeg',
  'mixamorig:RightFoot', 'mixamorig:RightToeBase', 'mixamorig:RightToe_End', 'mixamorig:Spine',
  'mixamorig:Spine1', 'mixamorig:Spine2', 'mixamorig:LeftShoulder', 'mixamorig:LeftArm',
  'mixamorig:LeftForeArm', 'mixamorig:LeftHand', 'mixamorig:LeftHandIndex1',
  'mixamorig:LeftHandIndex2', 'mixamorig:LeftHandIndex3', 'mixamorig:LeftHandIndex4',
  'mixamorig:LeftHandMiddle1', 'mixamorig:LeftHandMiddle2', 'mixamorig:LeftHandMiddle3',
  'mixamorig:LeftHandMiddle4', 'mixamorig:LeftHandPinky1', 'mixamorig:LeftHandPinky2',
  'mixamorig:LeftHandPinky3', 'mixamorig:LeftHandPinky4', 'mixamorig:LeftHandRing1',
  'mixamorig:LeftHandRing2', 'mixamorig:LeftHandRing3', 'mixamorig:LeftHandRing4',
  'mixamorig:LeftHandThumb1', 'mixamorig:LeftHandThumb2', 'mixamorig:LeftHandThumb3',
  'mixamorig:LeftHandThumb4', 'mixamorig:Neck', 'mixamorig:Head', 'mixamorig:HeadTop_End',
  'mixamorig:RightShoulder', 'mixamorig:RightArm', 'mixamorig:RightForeArm',
  'mixamorig:RightHand', 'mixamorig:RightHandIndex1', 'mixamorig:RightHandIndex2',
  'mixamorig:RightHandIndex3', 'mixamorig:RightHandIndex4', 'mixamorig:RightHandMiddle1',
  'mixamorig:RightHandMiddle2', 'mixamorig:RightHandMiddle3', 'mixamorig:RightHandMiddle4',
  'mixamorig:RightHandPinky1', 'mixamorig:RightHandPinky2', 'mixamorig:RightHandPinky3',
  'mixamorig:RightHandPinky4', 'mixamorig:RightHandRing1', 'mixamorig:RightHandRing2',
  'mixamorig:RightHandRing3', 'mixamorig:RightHandRing4', 'mixamorig:RightHandThumb1',
  'mixamorig:RightHandThumb2', 'mixamorig:RightHandThumb3', 'mixamorig:RightHandThumb4',
];

const FINGER_PHALANX_BONES = ['LeftHand', 'RightHand'].flatMap((side) =>
  ['Index', 'Middle', 'Ring', 'Pinky', 'Thumb'].flatMap((digit) =>
    ['1', '2', '3'].map((seg) => `mixamorig:${side}${digit}${seg}`),
  ),
);

const WEAPON_FILES = [
  'kolmogorov_pistol.glb',
  'kolmogorov_shotgun.glb',
  'kolmogorov_smg.glb',
  'kolmogorov_rpg.glb',
];

const WEAPON_NODES = [
  'Receiver', 'IK_Palm_Primary', 'IK_Index_Trigger', 'IK_Thumb_Safety',
  'IK_Palm_Forend', 'Socket_Muzzle', 'Socket_Eject',
];

function verifyCommonAttributes(gltf, bin, requiredAttrs) {
  const meshes = gltf.meshes ?? [];
  if (meshes.length === 0) throw new Error('GLB has no meshes');
  let totalPrimitives = 0;
  for (let m = 0; m < meshes.length; m++) {
    const prims = meshes[m].primitives ?? [];
    totalPrimitives += prims.length;
    for (let p = 0; p < prims.length; p++) {
      const attrs = prims[p].attributes ?? {};
      for (const req of requiredAttrs) {
        if (attrs[req] === undefined) {
          throw new Error(`mesh[${m}].prim[${p}] missing ${req}`);
        }
      }
      const checkedAttrs = [
        ...new Set([...requiredAttrs, 'POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0']),
      ];
      let expectedCount = null;
      for (const key of checkedAttrs) {
        if (attrs[key] === undefined) continue;
        const acc = readAccessor(gltf, bin, attrs[key]);
        if (acc.count <= 0) {
          throw new Error(`mesh[${m}].prim[${p}].${key} has invalid count ${acc.count} (must be > 0)`);
        }
        if (expectedCount === null) {
          expectedCount = acc.count;
        } else if (acc.count !== expectedCount) {
          throw new Error(`mesh[${m}].prim[${p}].${key} count ${acc.count} !== ${expectedCount}`);
        }
        const bad = countNonFinite(acc.values);
        if (bad > 0) throw new Error(`mesh[${m}].prim[${p}].${key} has ${bad} non-finite floats`);
      }
    }
  }
  if (totalPrimitives === 0) throw new Error('GLB has 0 mesh primitives');
}

export function verifyHeroGlb(filePath, { requireFingerWeights = true } = {}) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing hero GLB: ${filePath}`);
  const { gltf, bin } = parseGlb(fs.readFileSync(filePath));
  validateEmbeddedImages(gltf, bin);
  verifyCommonAttributes(gltf, bin, ['POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0']);
  const skin = gltf.skins?.[0];
  if (!skin || !Array.isArray(skin.joints)) throw new Error('Missing skins[0].joints');
  if (skin.joints.length !== 65) {
    throw new Error(`Expected 65 Mixamo joints, found ${skin.joints.length}`);
  }
  const jointNames = skin.joints.map((nodeIdx) => gltf.nodes?.[nodeIdx]?.name ?? '');
  const missingBones = MIXAMO_65_BONES.filter((b) => !jointNames.includes(b));
  if (missingBones.length > 0) {
    throw new Error(`Missing Mixamo bones: ${missingBones.join(', ')}`);
  }
  const counts = new Map(jointNames.map((n) => [n, 0]));
  for (const mesh of gltf.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      const joints = readAccessor(gltf, bin, prim.attributes.JOINTS_0);
      const weights = readAccessor(gltf, bin, prim.attributes.WEIGHTS_0);
      for (let v = 0; v < joints.count; v++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          const w = weights.values[v * 4 + k];
          const j = Math.round(joints.values[v * 4 + k]);
          if (w < -1e-5) throw new Error(`Negative weight ${w} at vertex ${v}`);
          sum += w;
          if (w > 0.001) {
            if (!Number.isFinite(j) || j < 0 || j >= jointNames.length) {
              throw new Error(`Vertex ${v} references out-of-bounds joint index ${j} (joints=${jointNames.length})`);
            }
            counts.set(jointNames[j], (counts.get(jointNames[j]) ?? 0) + 1);
          }
        }
        if (sum < 0.9 || sum > 1.1) {
          throw new Error(`Vertex ${v} weight sum out of range [0.9, 1.1]: ${sum.toFixed(4)}`);
        }
      }
    }
  }
  const zeroFingers = FINGER_PHALANX_BONES.filter((b) => (counts.get(b) ?? 0) === 0);
  if (requireFingerWeights && zeroFingers.length > 0) {
    throw new Error(`${zeroFingers.length} phalanx bones have 0 weights: ${zeroFingers.join(', ')}`);
  }
  return { filePath, bones: jointNames.length, missingFingerWeights: zeroFingers };
}

export function verifyWeaponGlb(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing weapon GLB: ${filePath}`);
  const { gltf, bin } = parseGlb(fs.readFileSync(filePath));
  verifyCommonAttributes(gltf, bin, ['POSITION', 'NORMAL', 'TEXCOORD_0']);
  const byName = new Map((gltf.nodes ?? []).map((n) => [n.name, n]));
  const missing = WEAPON_NODES.filter((name) => !byName.has(name));
  if (missing.length > 0) throw new Error(`Missing weapon nodes: ${missing.join(', ')}`);
  const extras = byName.get('Receiver')?.extras ?? {};
  if (extras.weaponRole !== 'receiver_root') throw new Error('Receiver.extras.weaponRole !== receiver_root');
  if (typeof extras.archetype !== 'string' || !extras.archetype) {
    throw new Error('Receiver.extras.archetype missing');
  }
  if (typeof extras.loadout !== 'object' || extras.loadout === null) {
    throw new Error('Receiver.extras.loadout missing');
  }
  return { filePath, archetype: extras.archetype };
}

export function verifyAllGlbs({ rootDir, requireHeroFingers = true, requireWeapons = true }) {
  const results = [];
  const failures = [];
  for (const name of ['npc_psx_m.glb', 'npc_psx_f.glb']) {
    const p = path.join(rootDir, 'public', 'assets', name);
    try {
      results.push({ kind: 'hero', ...verifyHeroGlb(p, { requireFingerWeights: requireHeroFingers }) });
    } catch (err) {
      failures.push(`[Hero ${name}] ${err.message}`);
    }
  }
  const uploadedPath = path.join(rootDir, 'public', 'assets', 'npc_hero_uploaded.glb');
  if (fs.existsSync(uploadedPath)) {
    try {
      results.push({ kind: 'hero', ...verifyHeroGlb(uploadedPath, { requireFingerWeights: true }) });
    } catch (err) {
      failures.push(`[Hero npc_hero_uploaded.glb] ${err.message}`);
    }
  }
  const weaponDir = path.join(rootDir, 'public', 'assets', 'weapons');
  if (!fs.existsSync(weaponDir)) {
    if (requireWeapons) failures.push(`[Weapons] Missing directory: ${weaponDir}`);
  } else {
    for (const file of WEAPON_FILES) {
      try {
        results.push({ kind: 'weapon', ...verifyWeaponGlb(path.join(weaponDir, file)) });
      } catch (err) {
        failures.push(`[Weapon ${file}] ${err.message}`);
      }
    }
  }
  return { results, failures };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const preM2 = process.argv.includes('--pre-m2');
  const rootDir = process.cwd();
  const { results, failures } = verifyAllGlbs({
    rootDir,
    requireHeroFingers: !preM2,
    requireWeapons: !preM2,
  });
  for (const r of results) console.log('PASS:', JSON.stringify(r));
  for (const f of failures) console.error('FAIL:', f);
  process.exit(failures.length === 0 ? 0 : 1);
}
