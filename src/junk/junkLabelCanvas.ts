import type { ProceduralLabelId } from '../types/junk';

export const LABEL_CANVAS_WIDTH = 512;
export const LABEL_CANVAS_HEIGHT = 256;

function drawTargetLabel(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): void {
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, w, h);

  // Subtle vertical framing bands on back sides (u near 0 and 1)
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, w * 0.14, h);
  ctx.fillRect(w * 0.86, 0, w * 0.14, h);

  const cx = w * 0.5;
  const cy = h * 0.5;
  const rings: Array<[number, string]> = [
    [108, '#0f172a'],
    [86, '#f8fafc'],
    [64, '#dc2626'],
    [42, '#f8fafc'],
    [22, '#ef4444'],
    [9, '#facc15'],
  ];
  for (const [r, color] of rings) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  // Crisp crosshair ticks
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 118, cy);
  ctx.lineTo(cx - 90, cy);
  ctx.moveTo(cx + 90, cy);
  ctx.lineTo(cx + 118, cy);
  ctx.moveTo(cx, cy - 118);
  ctx.lineTo(cx, cy - 90);
  ctx.moveTo(cx, cy + 90);
  ctx.lineTo(cx, cy + 118);
  ctx.stroke();
}

function drawGoofyEmojiLabel(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): void {
  ctx.fillStyle = '#facc15';
  ctx.fillRect(0, 0, w, h);

  // Polka-dot pattern around wrap
  ctx.fillStyle = '#eab308';
  for (let gx = 24; gx < w; gx += 48) {
    for (let gy = 24; gy < h; gy += 48) {
      ctx.beginPath();
      ctx.arc(gx, gy, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const cx = w * 0.5;
  const cy = h * 0.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 96, 0, Math.PI * 2);
  ctx.fillStyle = '#fde047';
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#18181b';
  ctx.stroke();

  // Mismatched googly eyes
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx - 34, cy - 22, 24, 0, Math.PI * 2);
  ctx.arc(cx + 34, cy - 26, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#18181b';
  ctx.beginPath();
  ctx.arc(cx - 26, cy - 18, 9, 0, Math.PI * 2);
  ctx.arc(cx + 38, cy - 30, 8, 0, Math.PI * 2);
  ctx.fill();

  // Goofy wide grin & silly tongue
  ctx.beginPath();
  ctx.arc(cx, cy + 12, 52, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.fillStyle = '#7f1d1d';
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fb7185';
  ctx.beginPath();
  ctx.ellipse(cx + 12, cy + 56, 20, 24, 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cx - 22, cy + 16, 16, 14);
  ctx.fillRect(cx + 4, cy + 16, 16, 14);
}

function drawTrisSodaLabel(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): void {
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#0284c7');
  grad.addColorStop(0.5, '#06b6d4');
  grad.addColorStop(1, '#2563eb');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Retro diagonal magenta/gold stripes
  ctx.fillStyle = '#ec4899';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.72);
  ctx.lineTo(w, h * 0.25);
  ctx.lineTo(w, h * 0.42);
  ctx.lineTo(0, h * 0.89);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#fde047';
  ctx.fillRect(0, 14, w, 14);
  ctx.fillRect(0, h - 28, w, 14);

  // Fizzy bubbles
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  const bubbles = [
    [130, 70, 10],
    [165, 190, 14],
    [350, 62, 12],
    [380, 185, 9],
  ];
  for (const [bx, by, br] of bubbles) {
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  // Center badge
  const cx = w * 0.5;
  const cy = h * 0.5;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(cx - 122, cy - 48, 244, 96);
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 5;
  ctx.strokeRect(cx - 122, cy - 48, 244, 96);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText("TRIS' SODA", cx, cy - 12);
  ctx.fillStyle = '#67e8f9';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('DREAMCAST FIZZ', cx, cy + 24);
}

function drawGarysBeansLabel(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): void {
  ctx.fillStyle = '#fef3c7';
  ctx.fillRect(0, 0, w, h);

  // Classic crimson top & navy bottom bands
  ctx.fillStyle = '#b91c1c';
  ctx.fillRect(0, 0, w, h * 0.46);
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(0, h * 0.8, w, h * 0.2);

  // Gold divider stripe
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, h * 0.45, w, 10);

  const cx = w * 0.5;
  // Classic oval emblem
  ctx.beginPath();
  ctx.ellipse(cx, h * 0.62, 62, 34, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#78350f';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#f59e0b';
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fef3c7';
  ctx.font = 'bold 36px serif';
  ctx.fillText("GARY'S", cx, 46);
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('BEANS', cx, 88);

  ctx.fillStyle = '#fef3c7';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('BAKED IN SAUCE', cx, h * 0.62);
}

/**
 * Draws one of the 4 built-in procedural labels onto a 2D canvas context.
 */
export function renderProceduralLabelCanvas(
  ctx: CanvasRenderingContext2D,
  labelId: Exclude<ProceduralLabelId, 'custom'>,
  width = LABEL_CANVAS_WIDTH,
  height = LABEL_CANVAS_HEIGHT
): void {
  switch (labelId) {
    case 'target':
      drawTargetLabel(ctx, width, height);
      break;
    case 'goofy-emoji':
      drawGoofyEmojiLabel(ctx, width, height);
      break;
    case 'tris-soda':
      drawTrisSodaLabel(ctx, width, height);
      break;
    case 'garys-beans':
      drawGarysBeansLabel(ctx, width, height);
      break;
  }
}
