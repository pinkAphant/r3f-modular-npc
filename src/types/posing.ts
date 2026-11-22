import type * as THREE from 'three';

export type FingerPoseTag =
  | 'relaxed'
  | 'pistol_grip'
  | 'trigger_ready'
  | 'forend_pump'
  | 'forend_vertical'
  | 'forend_angled'
  | 'launcher_grip'
  | 'open_palm';

export type WeaponArchetypeId = 'pistol' | 'shotgun' | 'smg' | 'rpg';

export type IkAnchorId =
  | 'IK_Palm_Primary'
  | 'IK_Index_Trigger'
  | 'IK_Thumb_Safety'
  | 'IK_Palm_Forend'
  | 'Socket_Muzzle'
  | 'Socket_Eject';

export type HandSide = 'Left' | 'Right';

export type FingerName = 'Thumb' | 'Index' | 'Middle' | 'Ring' | 'Pinky';

export interface DigitJointPose {
  /** Phalanx flexion angles [proximal(1), intermediate(2), distal(3)] in radians. */
  curl: [number, number, number];
  /** Splay/abduction angle at base joint (1) in radians. */
  spread: number;
  /** Optional axial roll at base joint (1) in radians (primarily for Thumb opposition). */
  twist?: number;
}

export type HandPoseSpec = Partial<Record<FingerName, DigitJointPose>> & {
  wristEuler?: [number, number, number];
};

export interface FingerPosePreset {
  tag: FingerPoseTag;
  label: string;
  rightHand?: HandPoseSpec;
  leftHand?: HandPoseSpec;
}

export interface LoadedWeaponRig {
  archetype: WeaponArchetypeId;
  root: THREE.Group;
  anchors: Partial<Record<IkAnchorId, THREE.Object3D>>;
  primaryPoseTag: FingerPoseTag;
  forendPoseTag?: FingerPoseTag;
}
