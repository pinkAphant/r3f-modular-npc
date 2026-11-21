import * as THREE from 'three';
import type { NpcBuild } from './buildPsxNpc';

export type OutfitId = 'underwear' | 'tactical' | 'jumpsuit' | 'tracksuit';

export const OUTFIT_LABELS: Record<OutfitId, string> = {
  underwear: 'Base Underwear (Blank)',
  tactical: 'PSX Tactical Vest',
  jumpsuit: 'Mech Bay Jumpsuit',
  tracksuit: '90s Tracksuit',
};

/**
 * Generates a 256x256 nearest-neighbor PSX++ albedo-only outfit atlas.
 * UV quadrants:
 *  - TL (0..128, 0..128 in canvas Y-down): Head / Face
 *  - TR (128..256, 0..128): Torso / Pelvis
 *  - BL (0..128, 128..256): Legs / Boots
 *  - BR (128..256, 128..256): Arms / Gloves
 */
export function renderAlbedoCanvas(
  outfit: OutfitId,
  build: NpcBuild,
  showUvGuides = false
): HTMLCanvasElement {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const skin = '#e6b89c';
  const skinShade = '#cc9778';

  // Base fill = skin tone everywhere
  ctx.fillStyle = skin;
  ctx.fillRect(0, 0, size, size);

  // --- 1. HEAD (TL: x 0..128, y 0..128) ---
  // Note: theta=0 (+Z front) is at u=0 and u=1 of the quadrant, so front face wraps near x=0..24 and x=104..128.
  // Draw stylized PSX eyes & mouth at both edges so front face reads cleanly.
  ctx.fillStyle = skinShade;
  ctx.fillRect(0, 108, 128, 20); // Neck shadow
  ctx.fillStyle = '#1f2937'; // Eyes
  ctx.fillRect(10, 52, 10, 7);
  ctx.fillRect(108, 52, 10, 7);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(12, 54, 4, 3);
  ctx.fillRect(110, 54, 4, 3);
  ctx.fillStyle = '#9f5f50'; // Mouth
  ctx.fillRect(0, 76, 10, 4);
  ctx.fillRect(118, 76, 10, 4);

  // --- 2. OUTFITS (TR Torso, BL Legs, BR Arms) ---
  if (outfit === 'underwear') {
    // White briefs on lower torso
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(128, 92, 128, 36);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(128, 92, 128, 5); // Waistband
    if (build === 'female') {
      // White sports bra on upper torso
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(128, 36, 128, 26);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(128, 58, 128, 4);
    }
  } else if (outfit === 'tactical') {
    // Olive tee + dark charcoal plate carrier
    ctx.fillStyle = '#4d5d42';
    ctx.fillRect(128, 0, 128, 128);
    ctx.fillStyle = '#27272a';
    ctx.fillRect(128, 24, 128, 60);
    ctx.fillStyle = '#3f3f46';
    for (let i = 0; i < 4; i++) ctx.fillRect(136 + i * 28, 48, 20, 24); // Mag pouches
    // Cargo pants + combat boots (BL)
    ctx.fillStyle = '#3f4a3c';
    ctx.fillRect(0, 128, 128, 96);
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 224, 128, 32); // Boots
    // Short sleeves + tactical gloves (BR)
    ctx.fillStyle = '#4d5d42';
    ctx.fillRect(128, 128, 128, 42);
    ctx.fillStyle = '#18181b';
    ctx.fillRect(128, 226, 128, 30);
  } else if (outfit === 'jumpsuit') {
    // Hi-vis orange engineering jumpsuit
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(128, 0, 128, 128);
    ctx.fillRect(0, 128, 128, 100);
    ctx.fillRect(128, 128, 128, 96);
    // Reflective safety stripes
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(128, 44, 128, 8);
    ctx.fillRect(128, 86, 128, 8);
    ctx.fillRect(0, 180, 128, 8);
    // Work boots + gloves
    ctx.fillStyle = '#292524';
    ctx.fillRect(0, 228, 128, 28);
    ctx.fillRect(128, 224, 128, 32);
  } else if (outfit === 'tracksuit') {
    // 90s teal & magenta tracksuit
    ctx.fillStyle = '#0d9488';
    ctx.fillRect(128, 0, 128, 128);
    ctx.fillStyle = '#db2777';
    ctx.fillRect(128, 26, 128, 20);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(128, 46, 128, 6);
    // Track pants + white sneakers
    ctx.fillStyle = '#115e59';
    ctx.fillRect(0, 128, 128, 102);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 230, 128, 26);
    // Sleeves
    ctx.fillStyle = '#0d9488';
    ctx.fillRect(128, 128, 128, 92);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(128, 212, 128, 8);
  }

  if (showUvGuides) {
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 126, 126);
    ctx.strokeRect(129, 1, 126, 126);
    ctx.strokeRect(1, 129, 126, 126);
    ctx.strokeRect(129, 129, 126, 126);
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(6, 6, 46, 14);
    ctx.fillRect(134, 6, 50, 14);
    ctx.fillRect(6, 134, 46, 14);
    ctx.fillRect(134, 134, 46, 14);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('HEAD', 10, 16);
    ctx.fillText('TORSO', 138, 16);
    ctx.fillText('LEGS', 10, 144);
    ctx.fillText('ARMS', 138, 144);
  }

  return canvas;
}

export function createPsxTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
