import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { setHudIsolated } from '../hud/hudSignals';
import { setTelemetryDreamcast } from '../range/rangeTelemetry';
import type { DreamcastConfig } from '../types/range';
import { createDreamcastMaterial, HUD_LAYER } from './dreamcastShader';

export interface DreamcastRendererProps {
  config: DreamcastConfig;
  quantizeLevels?: number;
  active?: boolean;
}

function computeTargetDimensions(
  viewportWidth: number,
  viewportHeight: number,
  dpr: number,
  config: DreamcastConfig
): [number, number] {
  const safeW = Math.max(1, viewportWidth);
  const safeH = Math.max(1, viewportHeight);
  if (config.pixelSnap) {
    const targetH = THREE.MathUtils.clamp(Math.round(config.virtualHeight), 240, 720);
    const targetW = Math.max(1, Math.round(targetH * (safeW / safeH)));
    return [targetW, targetH];
  }
  return [Math.max(1, Math.round(safeW * dpr)), Math.max(1, Math.round(safeH * dpr))];
}

function DreamcastActivePass({
  config,
  quantizeLevels = 31.0,
}: DreamcastRendererProps) {
  const { gl, scene, camera, size, viewport } = useThree();
  const [targetWidth, targetHeight] = computeTargetDimensions(
    size.width,
    size.height,
    viewport.dpr,
    config
  );

  const pipeline = useMemo(() => {
    const rt = new THREE.WebGLRenderTarget(targetWidth, targetHeight, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      generateMipmaps: false,
      type: THREE.HalfFloatType,
      depthBuffer: true,
      stencilBuffer: false,
    });
    const quadScene = new THREE.Scene();
    const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadGeo = new THREE.PlaneGeometry(2, 2);
    const quadMat = createDreamcastMaterial(rt.texture);
    const quadMesh = new THREE.Mesh(quadGeo, quadMat);
    quadMesh.frustumCulled = false;
    quadScene.add(quadMesh);
    return { rt, quadScene, quadCamera, quadGeo, quadMat };
  }, []);

  useEffect(() => {
    const { rt, quadMat } = pipeline;
    const filter = config.pixelSnap ? THREE.NearestFilter : THREE.LinearFilter;
    if (rt.texture.minFilter !== filter || rt.texture.magFilter !== filter) {
      rt.texture.minFilter = filter;
      rt.texture.magFilter = filter;
      rt.texture.needsUpdate = true;
    }
    if (rt.width !== targetWidth || rt.height !== targetHeight) {
      rt.setSize(targetWidth, targetHeight);
    }
    quadMat.uniforms.uResolution.value.set(targetWidth, targetHeight);
    quadMat.uniforms.uPixelSnap.value = config.pixelSnap ? 1.0 : 0.0;
    quadMat.uniforms.uRgb555.value = config.rgb555 ? 1.0 : 0.0;
    quadMat.uniforms.uDitherStrength.value = config.ditherStrength;
    quadMat.uniforms.uQuantizeLevels.value = quantizeLevels;
  }, [
    pipeline,
    targetWidth,
    targetHeight,
    config.pixelSnap,
    config.rgb555,
    config.ditherStrength,
    quantizeLevels,
  ]);

  useLayoutEffect(() => {
    setHudIsolated(true);
    setTelemetryDreamcast({
      enabled: config.enabled,
      pixelSnapWidth: targetWidth,
      pixelSnapHeight: targetHeight,
      rgb555Enabled: config.rgb555,
    });
    return () => {
      setHudIsolated(false);
    };
  }, [config.enabled, config.rgb555, targetWidth, targetHeight]);

  useEffect(() => {
    return () => {
      pipeline.rt.dispose();
      pipeline.quadGeo.dispose();
      pipeline.quadMat.dispose();
    };
  }, [pipeline]);

  useFrame(() => {
    camera.updateMatrixWorld();
    const prevAutoClear = gl.autoClear;
    const prevMask = camera.layers.mask;
    const prevBg = scene.background;
    const prevShadowAuto = gl.shadowMap.autoUpdate;
    const prevShadowEnabled = gl.shadowMap.enabled;

    try {
      // Pass 1: World geometry (layer 0) -> offscreen HalfFloat target
      camera.layers.set(0);
      gl.setRenderTarget(pipeline.rt);
      gl.autoClear = true;
      gl.clear();
      gl.render(scene, camera);

      // Pass 2: Dreamcast pixel-snap + RGB555 composite -> screen
      gl.setRenderTarget(null);
      gl.autoClear = true;
      gl.render(pipeline.quadScene, pipeline.quadCamera);

      // Pass 3: Isolated crisp UIKit HUD (HUD_LAYER) -> screen
      scene.background = null;
      gl.shadowMap.enabled = false;
      gl.shadowMap.autoUpdate = false;
      camera.layers.set(HUD_LAYER);
      gl.autoClear = false;
      gl.clearDepth();
      gl.render(scene, camera);
    } finally {
      scene.background = prevBg;
      camera.layers.mask = prevMask;
      gl.autoClear = prevAutoClear;
      gl.shadowMap.enabled = prevShadowEnabled;
      gl.shadowMap.autoUpdate = prevShadowAuto;
    }
  }, 1);

  return null;
}

export function DreamcastRenderer({
  config,
  quantizeLevels = 31.0,
  active = true,
}: DreamcastRendererProps) {
  useLayoutEffect(() => {
    if (!active || !config.enabled) {
      setTelemetryDreamcast({
        enabled: false,
        pixelSnapWidth: 0,
        pixelSnapHeight: 0,
        rgb555Enabled: false,
      });
    }
  }, [active, config.enabled]);
  if (!active || !config.enabled) return null;
  return <DreamcastActivePass config={config} quantizeLevels={quantizeLevels} />;
}
