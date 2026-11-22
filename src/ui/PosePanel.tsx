import type { FingerPoseTag, WeaponArchetypeId } from '../types/posing';
import {
  FINGER_POSE_PRESETS,
  FINGER_POSE_TAGS,
} from '../npc/fingerPoseSchema';
import {
  setViewerPoseTag,
  setViewerPoseWeight,
  setViewerWeapon,
  setViewerWiggleEnabled,
  setViewerWiggleIntensity,
  useViewerState,
  type ViewerWeaponOption,
} from '../npc/viewerState';

export interface PosePanelProps {
  poseTag?: FingerPoseTag;
  onPoseTagChange?: (tag: FingerPoseTag) => void;
  poseWeight?: number;
  onPoseWeightChange?: (weight: number) => void;
  wiggleEnabled?: boolean;
  onWiggleEnabledChange?: (enabled: boolean) => void;
  wiggleIntensity?: number;
  onWiggleIntensityChange?: (intensity: number) => void;
  weaponArchetype?: ViewerWeaponOption;
  onWeaponChange?: (archetype: ViewerWeaponOption) => void;
  hideWeaponPicker?: boolean;
}

const WEAPON_OPTIONS: Array<{ id: ViewerWeaponOption; label: string }> = [
  { id: 'none', label: 'None' },
  { id: 'pistol', label: 'Pistol' },
  { id: 'shotgun', label: 'Shotgun' },
  { id: 'smg', label: 'SMG' },
  { id: 'rpg', label: 'RPG' },
];

export function PosePanel(props: PosePanelProps) {
  const viewer = useViewerState();
  const poseTag = props.poseTag ?? viewer.poseTag;
  const poseWeight = props.poseWeight ?? viewer.poseWeight;
  const wiggleEnabled = props.wiggleEnabled ?? viewer.wiggleEnabled;
  const wiggleIntensity = props.wiggleIntensity ?? viewer.wiggleIntensity;
  const weaponArchetype = props.weaponArchetype ?? viewer.weaponArchetype;

  const setPose = props.onPoseTagChange ?? setViewerPoseTag;
  const setWeight = props.onPoseWeightChange ?? setViewerPoseWeight;
  const setWiggle = props.onWiggleEnabledChange ?? setViewerWiggleEnabled;
  const setIntensity = props.onWiggleIntensityChange ?? setViewerWiggleIntensity;
  const setWeapon = props.onWeaponChange ?? setViewerWeapon;

  return (
    <div
      data-testid="pose-panel"
      className="space-y-2.5 rounded border border-zinc-800 bg-zinc-950/60 p-2.5 text-xs"
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        Finger Pose & Wiggle
      </div>

      <label className="block space-y-1">
        <span className="text-[11px] text-zinc-400">Finger Pose Tag</span>
        <select
          data-testid="pose-select"
          value={poseTag}
          onChange={(e) => {
            setPose(e.target.value as FingerPoseTag);
            e.currentTarget.blur();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') e.currentTarget.blur();
          }}
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
        >
          {FINGER_POSE_TAGS.map((tag) => (
            <option key={tag} value={tag}>
              {FINGER_POSE_PRESETS[tag].label}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <div className="flex justify-between text-[11px] text-zinc-400">
          <span>Pose Weight</span>
          <span className="font-mono">{poseWeight.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={poseWeight}
          onChange={(e) => setWeight(parseFloat(e.target.value))}
          onPointerUp={(e) => e.currentTarget.blur()}
          className="w-full accent-sky-400"
        />
      </label>

      <div className="space-y-1.5 border-t border-zinc-800 pt-2">
        <label className="flex cursor-pointer items-center justify-between">
          <span className="text-zinc-300">Wiggle Physics</span>
          <input
            type="checkbox"
            checked={wiggleEnabled}
            onChange={(e) => {
              setWiggle(e.target.checked);
              e.currentTarget.blur();
            }}
          />
        </label>
        <label className="block space-y-1">
          <div className="flex justify-between text-[11px] text-zinc-400">
            <span>Wiggle Intensity</span>
            <span className="font-mono">{wiggleIntensity.toFixed(2)}</span>
          </div>
          <input
            data-testid="wiggle-intensity-slider"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={wiggleIntensity}
            onChange={(e) => setIntensity(parseFloat(e.target.value))}
            onPointerUp={(e) => e.currentTarget.blur()}
            className="w-full accent-sky-400"
          />
        </label>
      </div>

      {!props.hideWeaponPicker && (
        <div className="space-y-1.5 border-t border-zinc-800 pt-2">
          <div className="text-[11px] text-zinc-400">Armory Weapon Preview</div>
          <div className="grid grid-cols-3 gap-1">
            {WEAPON_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                data-testid={`weapon-opt-${opt.id}`}
                onClick={(e) => {
                  setWeapon(opt.id as 'none' | WeaponArchetypeId);
                  e.currentTarget.blur();
                }}
                className={`rounded border px-1.5 py-1 text-[11px] font-medium transition ${
                  weaponArchetype === opt.id
                    ? 'border-sky-500 bg-sky-500/20 text-sky-200'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
