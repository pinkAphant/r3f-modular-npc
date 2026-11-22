import type {
  DigitJointPose,
  FingerName,
  FingerPosePreset,
  FingerPoseTag,
  HandPoseSpec,
  WeaponArchetypeId,
} from '../types/posing';

function digit(
  c1: number,
  c2: number,
  c3: number,
  spread = 0,
  twist = 0
): DigitJointPose {
  return { curl: [c1, c2, c3], spread, twist };
}

const FIRING_RIGHT_HAND: HandPoseSpec = {
  Thumb: digit(0.32, 0.28, 0.16, 0.24, 0.65),
  Index: digit(0.58, 0.92, 0.65, 0.02),
  Middle: digit(1.18, 1.32, 0.9, -0.02),
  Ring: digit(1.22, 1.35, 0.92, -0.03),
  Pinky: digit(1.26, 1.38, 0.95, -0.05),
};

const TRIGGER_READY_RIGHT_HAND: HandPoseSpec = {
  Thumb: digit(0.28, 0.22, 0.14, 0.28, 0.55),
  Index: digit(0.03, 0.05, 0.03, 0.12),
  Middle: digit(1.18, 1.32, 0.9, -0.02),
  Ring: digit(1.22, 1.35, 0.92, -0.03),
  Pinky: digit(1.26, 1.38, 0.95, -0.05),
};

const SUPPORT_REST_LEFT: HandPoseSpec = {
  Thumb: digit(0.18, 0.16, 0.1, 0.14, 0.22),
  Index: digit(0.22, 0.24, 0.18, 0.04),
  Middle: digit(0.28, 0.3, 0.22, 0.0),
  Ring: digit(0.34, 0.36, 0.26, 0.03),
  Pinky: digit(0.4, 0.42, 0.3, 0.06),
};

export const FINGER_POSE_PRESETS: Record<FingerPoseTag, FingerPosePreset> = {
  relaxed: {
    tag: 'relaxed',
    label: 'Relaxed',
    rightHand: {
      Thumb: digit(0.16, 0.14, 0.1, 0.14, 0.2),
      Index: digit(0.2, 0.24, 0.16, 0.04),
      Middle: digit(0.26, 0.3, 0.2, 0.0),
      Ring: digit(0.34, 0.36, 0.26, 0.03),
      Pinky: digit(0.42, 0.44, 0.32, 0.06),
    },
    leftHand: SUPPORT_REST_LEFT,
  },
  pistol_grip: {
    tag: 'pistol_grip',
    label: 'Pistol Grip',
    rightHand: FIRING_RIGHT_HAND,
    leftHand: {
      Thumb: digit(0.28, 0.24, 0.16, 0.2, 0.45),
      Index: digit(0.75, 0.85, 0.58, 0.03),
      Middle: digit(0.85, 0.95, 0.65, 0.0),
      Ring: digit(0.92, 1.0, 0.7, 0.02),
      Pinky: digit(0.98, 1.05, 0.72, 0.05),
    },
  },
  trigger_ready: {
    tag: 'trigger_ready',
    label: 'Trigger Ready',
    rightHand: TRIGGER_READY_RIGHT_HAND,
    leftHand: SUPPORT_REST_LEFT,
  },
  forend_pump: {
    tag: 'forend_pump',
    label: 'Forend Pump',
    rightHand: FIRING_RIGHT_HAND,
    leftHand: {
      Thumb: digit(0.32, 0.26, 0.16, 0.34, 0.42),
      Index: digit(0.66, 0.76, 0.52, 0.12),
      Middle: digit(0.72, 0.82, 0.56, 0.04),
      Ring: digit(0.76, 0.84, 0.58, 0.06),
      Pinky: digit(0.8, 0.86, 0.6, 0.1),
    },
  },
  forend_vertical: {
    tag: 'forend_vertical',
    label: 'Forend Vertical',
    rightHand: FIRING_RIGHT_HAND,
    leftHand: {
      Thumb: digit(0.55, 0.6, 0.45, 0.18, 0.8),
      Index: digit(1.12, 1.26, 0.86, 0.02),
      Middle: digit(1.16, 1.3, 0.9, 0.0),
      Ring: digit(1.2, 1.32, 0.92, 0.02),
      Pinky: digit(1.22, 1.35, 0.95, 0.04),
    },
  },
  forend_angled: {
    tag: 'forend_angled',
    label: 'Forend Angled',
    rightHand: FIRING_RIGHT_HAND,
    leftHand: {
      Thumb: digit(0.18, 0.15, 0.1, 0.42, 0.35),
      Index: digit(0.36, 0.45, 0.3, 0.14),
      Middle: digit(0.75, 0.9, 0.6, 0.03),
      Ring: digit(0.85, 0.98, 0.68, 0.04),
      Pinky: digit(0.95, 1.05, 0.74, 0.07),
    },
  },
  launcher_grip: {
    tag: 'launcher_grip',
    label: 'Launcher Grip',
    rightHand: {
      Thumb: digit(0.45, 0.4, 0.28, 0.32, 0.7),
      Index: digit(0.54, 0.78, 0.56, 0.06),
      Middle: digit(0.88, 1.0, 0.68, 0.02),
      Ring: digit(0.92, 1.02, 0.7, 0.03),
      Pinky: digit(0.96, 1.05, 0.72, 0.06),
    },
    leftHand: {
      Thumb: digit(0.28, 0.25, 0.18, 0.38, 0.55),
      Index: digit(0.56, 0.68, 0.48, 0.14),
      Middle: digit(0.62, 0.74, 0.52, 0.06),
      Ring: digit(0.66, 0.76, 0.54, 0.08),
      Pinky: digit(0.68, 0.78, 0.55, 0.12),
    },
  },
  open_palm: {
    tag: 'open_palm',
    label: 'Open Palm',
    rightHand: {
      Thumb: digit(-0.08, -0.06, -0.04, 0.48, -0.15),
      Index: digit(-0.08, -0.06, -0.04, 0.18),
      Middle: digit(-0.08, -0.06, -0.04, 0.02),
      Ring: digit(-0.08, -0.06, -0.04, 0.14),
      Pinky: digit(-0.08, -0.06, -0.04, 0.28),
    },
    leftHand: {
      Thumb: digit(-0.08, -0.06, -0.04, 0.48, -0.15),
      Index: digit(-0.08, -0.06, -0.04, 0.18),
      Middle: digit(-0.08, -0.06, -0.04, 0.02),
      Ring: digit(-0.08, -0.06, -0.04, 0.14),
      Pinky: digit(-0.08, -0.06, -0.04, 0.28),
    },
  },
};

export const FINGER_POSE_TAGS: FingerPoseTag[] = [
  'relaxed',
  'pistol_grip',
  'trigger_ready',
  'forend_pump',
  'forend_vertical',
  'forend_angled',
  'launcher_grip',
  'open_palm',
];

export const FINGER_NAMES: FingerName[] = [
  'Thumb',
  'Index',
  'Middle',
  'Ring',
  'Pinky',
];

export function poseTagForWeapon(
  archetype: WeaponArchetypeId,
  underbarrel?: string
): FingerPoseTag {
  switch (archetype) {
    case 'pistol':
      return 'pistol_grip';
    case 'shotgun':
      return 'forend_pump';
    case 'smg':
      return underbarrel === 'angled' ? 'forend_angled' : 'forend_vertical';
    case 'rpg':
      return 'launcher_grip';
  }
}
