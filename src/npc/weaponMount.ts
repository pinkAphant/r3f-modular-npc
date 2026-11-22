import * as THREE from 'three';
import type { LoadedWeaponRig } from '../types/posing';
import { findNpcBone, resolveWeaponPoseTags } from './weaponLoader';

export function computeRightHandMountFrame(
  npcRoot: THREE.Object3D,
  gripRakeRad = THREE.MathUtils.degToRad(11),
  targetHeightM = 1.0,
  skeleton?: THREE.Skeleton | null
): {
  handBone: THREE.Object3D;
  localPosition: THREE.Vector3;
  localQuaternion: THREE.Quaternion;
  localScale: number;
} | null {
  npcRoot.updateMatrixWorld(true);
  const handBone = findNpcBone(npcRoot, 'RightHand', skeleton);
  const index1 = findNpcBone(npcRoot, 'RightHandIndex1', skeleton);
  const middle1 = findNpcBone(npcRoot, 'RightHandMiddle1', skeleton);
  const pinky1 = findNpcBone(npcRoot, 'RightHandPinky1', skeleton);
  if (!handBone || !index1 || !middle1 || !pinky1) return null;

  const idxL = new THREE.Vector3();
  const midL = new THREE.Vector3();
  const pnkL = new THREE.Vector3();
  index1.getWorldPosition(idxL);
  middle1.getWorldPosition(midL);
  pinky1.getWorldPosition(pnkL);
  handBone.worldToLocal(idxL);
  handBone.worldToLocal(midL);
  handBone.worldToLocal(pnkL);

  const fwd = midL.clone().normalize();
  const radial = idxL.clone().sub(pnkL);
  const up = radial.sub(fwd.clone().multiplyScalar(radial.dot(fwd))).normalize();
  const right = new THREE.Vector3().crossVectors(up, fwd).normalize();

  const basis = new THREE.Matrix4().makeBasis(right, up, fwd);
  const localQuaternion = new THREE.Quaternion().setFromRotationMatrix(basis);
  localQuaternion.multiply(
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), gripRakeRad)
  );

  const rhWorldScale = new THREE.Vector3();
  handBone.getWorldScale(rhWorldScale);
  const desiredWorldScale = targetHeightM / 1.75;
  const localScale = desiredWorldScale / Math.max(rhWorldScale.x, 1e-4);
  const localPosition = midL.clone().multiplyScalar(0.45);

  return { handBone, localPosition, localQuaternion, localScale };
}

export function mountWeaponToRightHand(
  npcRoot: THREE.Object3D,
  weapon: LoadedWeaponRig,
  targetHeightM = 1.0,
  skeleton?: THREE.Skeleton | null
): THREE.Group | null {
  const { gripRakeRad } = resolveWeaponPoseTags(weapon.root, weapon.archetype);
  const frame = computeRightHandMountFrame(
    npcRoot,
    gripRakeRad,
    targetHeightM,
    skeleton
  );
  if (!frame) return null;

  const existing = frame.handBone.getObjectByName('Mounted_Weapon_Group');
  if (existing) frame.handBone.remove(existing);

  const mountGroup = new THREE.Group();
  mountGroup.name = 'Mounted_Weapon_Group';
  mountGroup.position.copy(frame.localPosition);
  mountGroup.quaternion.copy(frame.localQuaternion);
  mountGroup.scale.setScalar(frame.localScale);

  weapon.root.position.set(0, 0, 0);
  weapon.root.quaternion.identity();
  weapon.root.scale.set(1, 1, 1);
  weapon.root.updateMatrixWorld(true);

  const palmAnchor = weapon.anchors.IK_Palm_Primary;
  if (palmAnchor) {
    const palmWorld = new THREE.Vector3();
    palmAnchor.getWorldPosition(palmWorld);
    weapon.root.worldToLocal(palmWorld);
    weapon.root.position.copy(palmWorld).negate();
  }

  mountGroup.add(weapon.root);
  mountGroup.traverse((obj) => {
    obj.userData.isWeaponAttachment = true;
  });
  frame.handBone.add(mountGroup);
  return mountGroup;
}

export function getMuzzleWorldPose(
  weapon: LoadedWeaponRig,
  outPos: THREE.Vector3,
  outDir: THREE.Vector3
): boolean {
  weapon.root.updateMatrixWorld(true);
  const muzzle = weapon.anchors.Socket_Muzzle;
  if (muzzle) {
    muzzle.getWorldPosition(outPos);
    const worldQ = new THREE.Quaternion();
    muzzle.getWorldQuaternion(worldQ);
    outDir.set(0, 0, 1).applyQuaternion(worldQ).normalize();
    return true;
  }
  outPos.set(0, 0, 0.3);
  weapon.root.localToWorld(outPos);
  const rootQ = new THREE.Quaternion();
  weapon.root.getWorldQuaternion(rootQ);
  outDir.set(0, 0, 1).applyQuaternion(rootQ).normalize();
  return false;
}
