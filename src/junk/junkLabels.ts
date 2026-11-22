import * as THREE from 'three';
import type { ProceduralLabelId } from '../types/junk';
import {
  LABEL_CANVAS_HEIGHT,
  LABEL_CANVAS_WIDTH,
  renderProceduralLabelCanvas,
} from './junkLabelCanvas';

export const BUILTIN_LABEL_IDS: ReadonlyArray<
  Exclude<ProceduralLabelId, 'custom'>
> = ['target', 'goofy-emoji', 'tris-soda', 'garys-beans'];

const ALLOWED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'];
const cachedBuiltInLabels = new Map<string, THREE.CanvasTexture>();

function configureLabelTexture<T extends THREE.Texture>(tex: T): T {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.flipY = true;
  tex.anisotropy = 1;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates or retrieves a cached deterministic CanvasTexture for built-in labels.
 * Returns null safely in non-DOM SSR environments.
 */
export function getProceduralLabelTexture(
  labelId: ProceduralLabelId,
  options?: { cache?: boolean }
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;

  const resolvedId: Exclude<ProceduralLabelId, 'custom'> =
    labelId === 'custom' ? 'target' : labelId;
  const useCache = options?.cache !== false;

  if (useCache) {
    const existing = cachedBuiltInLabels.get(resolvedId);
    if (existing) return existing;
  }

  const canvas = document.createElement('canvas');
  canvas.width = LABEL_CANVAS_WIDTH;
  canvas.height = LABEL_CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  renderProceduralLabelCanvas(ctx, resolvedId, canvas.width, canvas.height);
  const tex = configureLabelTexture(new THREE.CanvasTexture(canvas));

  if (useCache) {
    cachedBuiltInLabels.set(resolvedId, tex);
  }
  return tex;
}

/**
 * Validates an uploaded image File before creating a custom label texture.
 * Returns null if valid, or a descriptive error message if invalid.
 */
export function validateLabelImageFile(file: File): string | null {
  if (!file) return 'No label image file provided.';
  if (file.size <= 0) return `Image "${file.name}" is empty (0 bytes).`;

  const lower = file.name.toLowerCase();
  const hasImageExt = ALLOWED_IMAGE_EXTENSIONS.some((ext) =>
    lower.endsWith(ext)
  );
  const hasImageMime = file.type.startsWith('image/');

  if (!hasImageMime && !hasImageExt) {
    return `Unsupported label file "${file.name}". Expected PNG, JPG, or WebP image.`;
  }
  return null;
}

export interface LoadedCustomLabel {
  texture: THREE.Texture;
  dispose: () => void;
}

/**
 * Loads a custom albedo texture from a URL or DataURL with SRGBColorSpace and cleanup handle.
 */
export function loadCustomLabelTexture(
  url: string
): Promise<LoadedCustomLabel> {
  return new Promise((resolve, reject) => {
    if (!url || typeof url !== 'string') {
      reject(new Error('Invalid custom label URL.'));
      return;
    }

    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (tex) => {
        configureLabelTexture(tex);
        resolve({
          texture: tex,
          dispose: () => tex.dispose(),
        });
      },
      undefined,
      () => {
        reject(new Error(`Failed to decode custom label image from URL.`));
      }
    );
  });
}

/**
 * Validates that an image URL decodes cleanly in the browser before applying it as a label.
 */
export function decodeLabelImageUrl(url: string): Promise<void> {
  if (typeof Image === 'undefined') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Image decode failed.'));
    img.src = url;
  });
}

/**
 * Disposes all module-cached procedural label textures.
 */
export function disposeCachedLabelTextures(): void {
  cachedBuiltInLabels.forEach((tex) => tex.dispose());
  cachedBuiltInLabels.clear();
}
