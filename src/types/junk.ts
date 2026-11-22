import type * as THREE from 'three';

export type JunkKind = 'tin-can' | 'glass-bottle' | 'imported-glb';

export type CanLodMode = 'auto' | '3-gon' | '12-gon';

export type ProceduralLabelId =
  | 'target'
  | 'goofy-emoji'
  | 'tris-soda'
  | 'garys-beans'
  | 'custom';

export interface DecalRecord {
  id: string;
  /** Position in target mesh local space. */
  position: [number, number, number];
  /** Euler XYZ rotation aligned to surface normal in target mesh local space. */
  rotation: [number, number, number];
  scale: number;
}

export interface ShardSpec {
  id: string;
  geometry: THREE.BufferGeometry;
  centroid: [number, number, number];
  halfExtents: [number, number, number];
  volumeFraction: number;
}

export interface ImportedJunkSegment {
  segmentId: string;
  originalName: string;
  customName: string;
  destructible: boolean;
  triCount: number;
  bboxSizeM: [number, number, number];
}

export interface DestructibleTargetSpec {
  id: string;
  kind: JunkKind;
  labelId: ProceduralLabelId;
  customAlbedoUrl: string | null;
  canLodMode: CanLodMode;
  position: [number, number, number];
  hp: number;
  maxHp: number;
  fragile: boolean;
  shatterPieceCount: number;
  importedUrl?: string | null;
  segments?: ImportedJunkSegment[];
}
