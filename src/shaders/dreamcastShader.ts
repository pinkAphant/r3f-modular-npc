import * as THREE from 'three';
import type { DreamcastConfig } from '../types/range';

export const HUD_LAYER = 1;

export const DEFAULT_DREAMCAST_CONFIG: DreamcastConfig = {
  enabled: true,
  virtualHeight: 480,
  pixelSnap: true,
  rgb555: true,
  ditherStrength: 0.85,
};

export const DREAMCAST_VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const DREAMCAST_FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform float uPixelSnap;
uniform float uRgb555;
uniform float uDitherStrength;
uniform float uQuantizeLevels;
varying vec2 vUv;

float bayer4x4(vec2 fragCoord) {
  int x = int(mod(fragCoord.x, 4.0));
  int y = int(mod(fragCoord.y, 4.0));
  int idx = y * 4 + x;
  if (idx == 0)  return  0.0;
  if (idx == 1)  return  8.0;
  if (idx == 2)  return  2.0;
  if (idx == 3)  return 10.0;
  if (idx == 4)  return 12.0;
  if (idx == 5)  return  4.0;
  if (idx == 6)  return 14.0;
  if (idx == 7)  return  6.0;
  if (idx == 8)  return  3.0;
  if (idx == 9)  return 11.0;
  if (idx == 10) return  1.0;
  if (idx == 11) return  9.0;
  if (idx == 12) return 15.0;
  if (idx == 13) return  7.0;
  if (idx == 14) return 13.0;
  return 5.0;
}

void main() {
  vec2 sampleUv = uPixelSnap > 0.5
    ? (floor(vUv * uResolution) + 0.5) / uResolution
    : vUv;

  vec4 texel = texture2D(tDiffuse, sampleUv);
  gl_FragColor = texel;

  #include <tonemapping_fragment>
  #include <colorspace_fragment>

  if (uRgb555 > 0.5) {
    vec2 ditherCoord = uPixelSnap > 0.5
      ? floor(vUv * uResolution)
      : floor(gl_FragCoord.xy);
    float dither = ((bayer4x4(ditherCoord) + 0.5) / 16.0 - 0.5) * uDitherStrength;
    vec3 srgb = clamp(gl_FragColor.rgb, 0.0, 1.0);
    vec3 quantized = floor(srgb * uQuantizeLevels + 0.5 + dither) / uQuantizeLevels;
    gl_FragColor.rgb = clamp(quantized, 0.0, 1.0);
  }
}
`;

export function createDreamcastMaterial(texture: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: texture },
      uResolution: { value: new THREE.Vector2(640, 480) },
      uPixelSnap: { value: 1.0 },
      uRgb555: { value: 1.0 },
      uDitherStrength: { value: 0.85 },
      uQuantizeLevels: { value: 31.0 },
    },
    vertexShader: DREAMCAST_VERTEX_SHADER,
    fragmentShader: DREAMCAST_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    toneMapped: true,
  });
}
