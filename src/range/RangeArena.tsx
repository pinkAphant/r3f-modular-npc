import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import {
  DISTANCE_MARKERS,
  FIRING_LINE_Z,
  getCachedColorMat,
  getDistanceSignMat,
  getRangeArenaMaterials,
  PEDESTAL_HEIGHT,
  RANGE_PEDESTAL_SLOTS,
  type PedestalSlot,
} from './rangeArenaAssets';

export { FIRING_LINE_Z, PEDESTAL_HEIGHT, RANGE_PEDESTAL_SLOTS, type PedestalSlot };

const LANE_DIVIDER_X = [-7.5, -3.5, 3.5, 7.5] as const;
const SIDE_BENCH_X = [-5.5, 5.5] as const;

const CRATE_POSITIONS: Array<[number, number, number]> = [
  [-2.2, 0.35, -3.8],
  [2.4, 0.35, -3.8],
  [-2.2, 1.05, -3.8],
];

const BARREL_POSITIONS: Array<[number, number, number]> = [
  [3.2, 0.45, -7.5],
  [-3.2, 0.45, -12.5],
  [2.6, 0.45, -16],
];

const STARTER_BLOCK_SLOTS = RANGE_PEDESTAL_SLOTS.slice(0, 4);

export function RangeArena({ active = true }: { active?: boolean }) {
  const mats = getRangeArenaMaterials();

  return (
    <group>
      {active ? (
        <>
          <color attach="background" args={['#101216']} />
          <fog attach="fog" args={['#101216', 28, 70]} />
          <ambientLight intensity={0.45} />
          <hemisphereLight args={['#cbd5e1', '#27272a', 0.55]} />
          <directionalLight position={[8, 18, 6]} intensity={1.6} />
        </>
      ) : null}

      {/* Main concrete floor (top surface at y = 0) */}
      <RigidBody type="fixed" colliders={false} friction={1.0} restitution={0}>
        <CuboidCollider args={[14, 0.5, 24]} position={[0, -0.5, -15]} />
        <mesh position={[0, -0.5, -15]} material={mats.floor}>
          <boxGeometry args={[28, 1, 48]} />
        </mesh>
      </RigidBody>

      {/* Firing line & range distance stripes */}
      <mesh
        position={[0, 0.004, FIRING_LINE_Z]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={mats.firingStripe}
      >
        <planeGeometry args={[24, 0.16]} />
      </mesh>
      {DISTANCE_MARKERS.map((m) => (
        <mesh
          key={`stripe-${m.label}`}
          position={[0, 0.003, m.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          material={getCachedColorMat(m.color, 0.8)}
        >
          <planeGeometry args={[24, 0.08]} />
        </mesh>
      ))}

      {/* Perimeter walls & armored backstop */}
      <RigidBody type="fixed" friction={0.8}>
        <mesh position={[-13.5, 2.25, -15]} material={mats.wall}>
          <boxGeometry args={[1, 4.5, 48]} />
        </mesh>
        <mesh position={[13.5, 2.25, -15]} material={mats.wall}>
          <boxGeometry args={[1, 4.5, 48]} />
        </mesh>
        <mesh position={[0, 1.75, 8.5]} material={mats.wall}>
          <boxGeometry args={[28, 3.5, 1]} />
        </mesh>
        <mesh position={[0, 3.0, -37]} material={mats.backstop}>
          <boxGeometry args={[28, 6.0, 1.5]} />
        </mesh>
        <mesh position={[0, 4.8, -36.2]} rotation={[0.35, 0, 0]} material={mats.baffle}>
          <boxGeometry args={[26, 2.2, 0.3]} />
        </mesh>
      </RigidBody>

      {/* Shooting stall dividers & side benches (central aisle open) */}
      <RigidBody type="fixed" friction={0.8}>
        {LANE_DIVIDER_X.map((x) => (
          <mesh key={`div-${x}`} position={[x, 0.525, 1.7]} material={mats.divider}>
            <boxGeometry args={[0.14, 1.05, 2.6]} />
          </mesh>
        ))}
        {SIDE_BENCH_X.map((x) => (
          <mesh key={`bench-${x}`} position={[x, 0.425, 0.2]} material={mats.bench}>
            <boxGeometry args={[1.6, 0.85, 0.7]} />
          </mesh>
        ))}
      </RigidBody>

      {/* Eye-level center target shelf (top at y = 1.48m, x = -1.4..1.4, z = -3.3..-7.9) */}
      <RigidBody type="fixed" friction={0.9}>
        <mesh position={[0, 0.74, -5.6]} material={mats.shelf}>
          <boxGeometry args={[2.8, 1.48, 4.6]} />
        </mesh>
      </RigidBody>

      {/* Target pedestals */}
      {RANGE_PEDESTAL_SLOTS.map((slot) => (
        <RigidBody key={slot.id} type="fixed" friction={0.9}>
          <mesh
            position={[slot.position[0], PEDESTAL_HEIGHT / 2, slot.position[2]]}
            material={mats.pedestal}
          >
            <boxGeometry args={[0.8, PEDESTAL_HEIGHT, 0.8]} />
          </mesh>
        </RigidBody>
      ))}

      {/* Color-coded distance marker posts + 3D labels */}
      {DISTANCE_MARKERS.map((m) => (
        <group key={`marker-${m.label}`} position={[-11.5, 0, m.z]}>
          <mesh position={[0, 0.9, 0]} material={mats.post}>
            <boxGeometry args={[0.18, 1.8, 0.18]} />
          </mesh>
          <mesh position={[0, 1.5, 0]} material={getCachedColorMat(m.color, 0.5)}>
            <boxGeometry args={[0.22, 0.28, 0.22]} />
          </mesh>
          <mesh position={[0.62, 1.5, 0.12]} material={getDistanceSignMat(m.label, m.color)}>
            <planeGeometry args={[0.9, 0.45]} />
          </mesh>
        </group>
      ))}

      {/* Starter dynamic crates */}
      {CRATE_POSITIONS.map((pos, idx) => (
        <RigidBody key={`crate-${idx}`} type="dynamic" position={pos} friction={0.8} restitution={0.15}>
          <mesh material={mats.crate}>
            <boxGeometry args={[0.7, 0.7, 0.7]} />
          </mesh>
        </RigidBody>
      ))}

      {/* Starter dynamic range barrels */}
      {BARREL_POSITIONS.map((pos, idx) => (
        <RigidBody
          key={`barrel-${idx}`}
          type="dynamic"
          colliders={false}
          position={pos}
          friction={0.6}
          restitution={0.2}
        >
          <CylinderCollider args={[0.45, 0.28]} />
          <mesh material={mats.barrel}>
            <cylinderGeometry args={[0.28, 0.28, 0.9, 12]} />
          </mesh>
        </RigidBody>
      ))}

      {/* Starter knockable blocks atop 5m & 10m pedestals */}
      {STARTER_BLOCK_SLOTS.map((slot) => (
        <RigidBody
          key={`starter-${slot.id}`}
          type="dynamic"
          position={[slot.position[0], PEDESTAL_HEIGHT + 0.2, slot.position[2]]}
          friction={0.7}
          restitution={0.2}
        >
          <mesh material={mats.starterBlock}>
            <boxGeometry args={[0.25, 0.4, 0.25]} />
          </mesh>
        </RigidBody>
      ))}
    </group>
  );
}
