import { Decal } from '@react-three/drei';
import { createPortal } from '@react-three/fiber';
import { Fragment, type RefObject, useMemo } from 'react';
import * as THREE from 'three';
import type { DecalRecord } from '../types/junk';

let cachedBulletHoleTex: THREE.CanvasTexture | null = null;

/**
 * Generates and caches a crisp procedural bullet-hole CanvasTexture (SRGBColorSpace).
 * Returns null safely in non-DOM SSR environments.
 */
export function getBulletHoleTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  if (cachedBulletHoleTex) return cachedBulletHoleTex;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const c = size * 0.5;
  ctx.clearRect(0, 0, size, size);

  // Outer scorch halo
  const scorch = ctx.createRadialGradient(c, c, 8, c, c, 54);
  scorch.addColorStop(0, 'rgba(15, 15, 18, 0.92)');
  scorch.addColorStop(0.45, 'rgba(39, 39, 42, 0.55)');
  scorch.addColorStop(1, 'rgba(24, 24, 27, 0)');
  ctx.fillStyle = scorch;
  ctx.beginPath();
  ctx.arc(c, c, 54, 0, Math.PI * 2);
  ctx.fill();

  // Radial crack lines
  ctx.strokeStyle = 'rgba(24, 24, 27, 0.85)';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.25;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * 16, c + Math.sin(a) * 16);
    ctx.lineTo(c + Math.cos(a) * 44, c + Math.sin(a) * 44);
    ctx.stroke();
  }

  // Jagged metallic rim
  ctx.beginPath();
  ctx.arc(c, c, 21, 0, Math.PI * 2);
  ctx.fillStyle = '#94a3b8';
  ctx.fill();

  // Deep dark bullet core
  ctx.beginPath();
  ctx.arc(c, c, 15, 0, Math.PI * 2);
  ctx.fillStyle = '#09090b';
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = true;
  tex.needsUpdate = true;
  cachedBulletHoleTex = tex;
  return tex;
}

export function disposeBulletHoleTexture(): void {
  cachedBulletHoleTex?.dispose();
  cachedBulletHoleTex = null;
}

export interface TargetDecalsProps {
  decals: ReadonlyArray<DecalRecord>;
  lodKey?: string;
  meshRefMap?: ReadonlyMap<string, RefObject<THREE.Mesh>>;
}

/**
 * Renders local-space bullet-hole decals on a target mesh (or via explicit meshRefMap for multi-mesh GLBs).
 */
export function TargetDecals({
  decals,
  lodKey = 'default',
  meshRefMap,
}: TargetDecalsProps) {
  const bulletTex = useMemo(() => getBulletHoleTexture(), []);

  if (decals.length === 0) return null;

  return (
    <>
      {decals.map((d) => {
        const decalEl = (
          <Decal
            position={d.position}
            rotation={d.rotation}
            scale={[d.scale, d.scale, d.scale * 1.4]}
            depthTest={true}
            polygonOffsetFactor={-4}
            material-depthWrite={false}
            raycast={() => null}
            userData={{ isDecal: true }}
            map={bulletTex ?? undefined}
          />
        );
        if (meshRefMap) {
          const boundMesh = meshRefMap.get(d.id)?.current;
          if (!boundMesh) return null;
          return (
            <Fragment key={`${d.id}-${lodKey}`}>
              {createPortal(decalEl, boundMesh)}
            </Fragment>
          );
        }
        return <Fragment key={`${d.id}-${lodKey}`}>{decalEl}</Fragment>;
      })}
    </>
  );
}
