import { inflateSync } from 'node:zlib';
import { expect, type Page } from '@playwright/test';

const WEBGL_WARN_RE = /Shader Error|GL_INVALID|INVALID_OPERATION|THREE\.WebGLProgram|WebGL.*warning/i;

export interface ErrorTrap {
  errors: string[];
  assertZeroErrors: () => Promise<void>;
  dispose: () => void;
}

export async function attachErrorTraps(page: Page): Promise<ErrorTrap> {
  const errors: string[] = [];
  await page.addInitScript(() => {
    (window as unknown as { __PW_WEBGL_LOST__?: boolean }).__PW_WEBGL_LOST__ = false;
    window.addEventListener('webglcontextlost', () => {
      (window as unknown as { __PW_WEBGL_LOST__?: boolean }).__PW_WEBGL_LOST__ = true;
    }, true);
  });
  const onPageError = (err: Error): void => { errors.push(`pageerror: ${err.message}`); };
  const onConsole = (msg: { type: () => string; text: () => string }): void => {
    const text = msg.text();
    if (msg.type() === 'error' || WEBGL_WARN_RE.test(text)) errors.push(`console.${msg.type()}: ${text}`);
  };
  page.on('pageerror', onPageError);
  page.on('console', onConsole);
  return {
    errors,
    assertZeroErrors: async () => {
      const lost = await page.evaluate(
        () => Boolean((window as unknown as { __PW_WEBGL_LOST__?: boolean }).__PW_WEBGL_LOST__),
      );
      if (lost) errors.push('webglcontextlost event fired');
      expect(errors, `Unexpected browser/WebGL errors:\n${errors.join('\n')}`).toEqual([]);
    },
    dispose: () => {
      page.off('pageerror', onPageError);
      page.off('console', onConsole);
    },
  };
}

export async function waitFrames(page: Page, count = 3): Promise<void> {
  await page.evaluate(
    (n) => new Promise<void>((res) => {
      let left = n;
      const tick = (): void => (--left <= 0 ? res() : void requestAnimationFrame(tick));
      requestAnimationFrame(tick);
    }),
    count,
  );
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function toBuf(input: Buffer | Uint8Array): Buffer {
  return Buffer.isBuffer(input) ? input : Buffer.from(input.buffer, input.byteOffset, input.byteLength);
}

export function decodePngRgba(input: Buffer | Uint8Array): { width: number; height: number; rgba: Uint8Array } {
  const buf = toBuf(input);
  const magic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.byteLength < 33 || !magic.every((b, i) => buf[i] === b)) throw new Error('Invalid PNG header');
  let width = 0, height = 0, bitDepth = 0, colorType = 6, off = 8;
  const idat: Buffer[] = [];
  while (off + 12 <= buf.byteLength) {
    const len = buf.readUInt32BE(off);
    const type = buf.subarray(off + 4, off + 8).toString('ascii');
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (bitDepth !== 8) throw new Error(`Unsupported PNG bitDepth=${bitDepth}`);
  if (!width || !height || bpp === 0) throw new Error(`Unsupported PNG colorType=${colorType}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp, prev = new Uint8Array(stride), cur = new Uint8Array(stride);
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1), f = raw[rowStart];
    if (f > 4) throw new Error(`Invalid PNG filterType=${f}`);
    for (let x = 0; x < stride; x++) {
      const v = raw[rowStart + 1 + x], a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      cur[x] = f === 0 ? v : f === 1 ? (v + a) & 255 : f === 2 ? (v + b) & 255 : f === 3 ? (v + ((a + b) >> 1)) & 255 : (v + paeth(a, b, c)) & 255;
    }
    for (let x = 0; x < width; x++) {
      const d = (y * width + x) * 4, s = x * bpp;
      rgba[d] = cur[s]; rgba[d + 1] = cur[s + 1]; rgba[d + 2] = cur[s + 2]; rgba[d + 3] = bpp === 4 ? cur[s + 3] : 255;
    }
    prev.set(cur);
  }
  return { width, height, rgba };
}

export function assertCanvasNonBlank(pngBuf: Buffer | Uint8Array): { nonBgRatio: number; lumaStddev: number } {
  const { width, height, rgba } = decodePngRgba(pngBuf);
  let nonBg = 0, sum = 0, sumSq = 0, count = 0;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4;
      const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
      if (Math.abs(r - 9) + Math.abs(g - 9) + Math.abs(b - 11) > 15) nonBg++;
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      sum += luma; sumSq += luma * luma; count++;
    }
  }
  const mean = sum / count;
  const lumaStddev = Math.sqrt(Math.max(0, sumSq / count - mean * mean));
  const nonBgRatio = nonBg / count;
  expect(nonBgRatio, 'Canvas appears blank (<=5% non-background pixels)').toBeGreaterThan(0.05);
  expect(lumaStddev, 'Canvas luminance variance too flat').toBeGreaterThan(3);
  return { nonBgRatio, lumaStddev };
}

export function measureFrameDiff(pngA: Buffer | Uint8Array, pngB: Buffer | Uint8Array): number {
  const a = decodePngRgba(pngA), b = decodePngRgba(pngB);
  expect(a.width).toBe(b.width); expect(a.height).toBe(b.height);
  let diff = 0;
  const total = a.width * a.height;
  for (let i = 0; i < total; i++) {
    const p = i * 4;
    if (Math.abs(a.rgba[p] - b.rgba[p]) + Math.abs(a.rgba[p + 1] - b.rgba[p + 1]) + Math.abs(a.rgba[p + 2] - b.rgba[p + 2]) > 12) diff++;
  }
  return diff / total;
}

function inHudOverlayMask(x: number, y: number, w: number, h: number): boolean {
  const reticleR = Math.min(24, Math.floor(Math.min(w, h) * 0.05));
  if (Math.abs(x - w / 2) < reticleR && Math.abs(y - h / 2) < reticleR) return true;
  return y >= h * 0.52 && y <= h * 0.65 && x >= w * 0.3 && x <= w * 0.7;
}

export function assertRgb555Signature(pngBuf: Buffer | Uint8Array): { alignedRatio: number; nonBlackRatio: number } {
  const { width, height, rgba } = decodePngRgba(pngBuf);
  const step = 255 / 31;
  let aligned = 0, totalChannels = 0, evaluatedPixels = 0, sampledPixels = 0;
  for (let y = Math.floor(height * 0.2); y < Math.floor(height * 0.8); y += 2) {
    for (let x = Math.floor(width * 0.15); x < Math.floor(width * 0.85); x += 2) {
      if (inHudOverlayMask(x, y, width, height)) continue;
      sampledPixels++;
      const idx = (y * width + x) * 4;
      const r = rgba[idx], g = rgba[idx + 1], b = rgba[idx + 2];
      if (Math.max(r, g, b) <= 16) continue;
      evaluatedPixels++;
      for (const v of [r, g, b]) {
        if (Math.abs(v - Math.round((v * 31) / 255) * step) <= 1.0) aligned++;
        totalChannels++;
      }
    }
  }
  const nonBlackRatio = sampledPixels > 0 ? evaluatedPixels / sampledPixels : 0;
  const alignedRatio = totalChannels > 0 ? aligned / totalChannels : 0;
  expect(nonBlackRatio, 'Insufficient non-black pixels for RGB555 signature').toBeGreaterThanOrEqual(0.05);
  expect(alignedRatio, 'RGB555 quantization signature missing').toBeGreaterThan(0.75);
  return { alignedRatio, nonBlackRatio };
}

export function assertPixelSnapGrid(
  pngBuf: Buffer | Uint8Array,
  snapWidth: number,
): { sameAdjacentRatio: number; strideDetailRatio: number } {
  assertCanvasNonBlank(pngBuf);
  const { width, height, rgba } = decodePngRgba(pngBuf);
  const stride = Math.max(3, Math.ceil(width / Math.max(1, snapWidth)) + 1);
  let sameAdj = 0, adjCount = 0, detail = 0, detailCount = 0;
  for (let y = Math.floor(height * 0.2); y < Math.floor(height * 0.8) - 1; y += 2) {
    for (let x = Math.floor(width * 0.15); x < Math.floor(width * 0.85) - stride; x += 2) {
      if (inHudOverlayMask(x, y, width, height)) continue;
      const p = (y * width + x) * 4, px = p + 4, py = p + width * 4, ps = p + stride * 4;
      const dx = Math.abs(rgba[p] - rgba[px]) + Math.abs(rgba[p + 1] - rgba[px + 1]) + Math.abs(rgba[p + 2] - rgba[px + 2]);
      const dy = Math.abs(rgba[p] - rgba[py]) + Math.abs(rgba[p + 1] - rgba[py + 1]) + Math.abs(rgba[p + 2] - rgba[py + 2]);
      if (dx === 0 || dy === 0) sameAdj++;
      adjCount++;
      const ds = Math.abs(rgba[p] - rgba[ps]) + Math.abs(rgba[p + 1] - rgba[ps + 1]) + Math.abs(rgba[p + 2] - rgba[ps + 2]);
      if (ds > 12) detail++;
      detailCount++;
    }
  }
  const sameAdjacentRatio = adjCount > 0 ? sameAdj / adjCount : 0;
  const strideDetailRatio = detailCount > 0 ? detail / detailCount : 0;
  if (snapWidth < width * 0.85) {
    expect(sameAdjacentRatio, 'Pixel-snap grid coherence missing').toBeGreaterThan(0.25);
  }
  expect(strideDetailRatio, 'Rendered frame lacks spatial detail (over-coarse)').toBeGreaterThan(0.05);
  return { sameAdjacentRatio, strideDetailRatio };
}

export function measureRegionContrast(
  pngBuf: Buffer | Uint8Array, x0F: number, y0F: number, x1F: number, y1F: number,
): { minLuma: number; maxLuma: number; contrast: number } {
  const { width, height, rgba } = decodePngRgba(pngBuf);
  let minLuma = 255, maxLuma = 0;
  for (let y = Math.max(0, Math.floor(height * y0F)); y < Math.min(height, Math.floor(height * y1F)); y++) {
    for (let x = Math.max(0, Math.floor(width * x0F)); x < Math.min(width, Math.floor(width * x1F)); x++) {
      const i = (y * width + x) * 4;
      const luma = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
      if (luma < minLuma) minLuma = luma;
      if (luma > maxLuma) maxLuma = luma;
    }
  }
  return { minLuma, maxLuma, contrast: maxLuma - minLuma };
}

export function assertReticleContrast(pngBuf: Buffer | Uint8Array): number {
  const { width, height, rgba } = decodePngRgba(pngBuf);
  const cx = Math.floor(width / 2), cy = Math.floor(height / 2);
  const x0 = Math.max(0, Math.floor(width * 0.42)), x1 = Math.min(width, Math.floor(width * 0.58));
  const y0 = Math.max(0, Math.floor(height * 0.42)), y1 = Math.min(height, Math.floor(height * 0.58));
  const lumaAt = (x: number, y: number): number => {
    const i = (y * width + x) * 4;
    return 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
  };
  let hContrast = 0;
  for (let y = Math.max(0, cy - 1); y <= Math.min(height - 1, cy + 1); y++) {
    let mn = 255, mx = 0;
    for (let x = x0; x < x1; x++) {
      if (Math.abs(x - cx) < 2) continue;
      const l = lumaAt(x, y); if (l < mn) mn = l; if (l > mx) mx = l;
    }
    hContrast = Math.max(hContrast, mx - mn);
  }
  let vContrast = 0;
  for (let x = Math.max(0, cx - 1); x <= Math.min(width - 1, cx + 1); x++) {
    let mn = 255, mx = 0;
    for (let y = y0; y < y1; y++) {
      if (Math.abs(y - cy) < 2) continue;
      const l = lumaAt(x, y); if (l < mn) mn = l; if (l > mx) mx = l;
    }
    vContrast = Math.max(vContrast, mx - mn);
  }
  const contrast = Math.min(hContrast, vContrast);
  expect(contrast, 'Center HUD reticle lacks crisp 2D crosshair contrast').toBeGreaterThan(50);
  return contrast;
}
