import { useFrame, useThree } from '@react-three/fiber';
import {
  Container,
  Fullscreen,
  setPreferredColorScheme,
  Text,
  withOpacity,
  type VanillaFullscreen,
} from '@react-three/uikit';
import { useLayoutEffect, useRef } from 'react';
import { HUD_LAYER } from '../shaders/dreamcastShader';
import {
  ammoDisplaySignal,
  cameraModeSignal,
  hitsDisplaySignal,
  lodDisplaySignal,
  playerStateSignal,
  pointerPromptDisplaySignal,
  poseDisplaySignal,
  setHudMounted,
  shaderBadgeSignal,
  shattersDisplaySignal,
} from './hudSignals';

setPreferredColorScheme('dark');

const PILL_BG = withOpacity('#09090b', 0.72);
const PILL_BORDER = withOpacity('#3f3f46', 0.85);
const HUD_LAYER_MASK = 1 << HUD_LAYER;
const NO_RAYCAST = () => null;

export function FpsHud({ active = true }: { active?: boolean }) {
  const fullscreenRef = useRef<VanillaFullscreen | null>(null);
  const taggedFramesRef = useRef(0);
  const { camera } = useThree();

  useLayoutEffect(() => {
    taggedFramesRef.current = 0;
    setHudMounted(active);
    if (fullscreenRef.current) {
      fullscreenRef.current.visible = active;
    }
    if (active) {
      if (!camera.layers.isEnabled(HUD_LAYER)) {
        camera.layers.enable(HUD_LAYER);
      }
      fullscreenRef.current?.traverse((obj) => {
        obj.layers.set(HUD_LAYER);
        obj.userData.isHudAttachment = true;
        obj.raycast = NO_RAYCAST;
        obj.castShadow = false;
        obj.receiveShadow = false;
      });
    } else if (camera.layers.isEnabled(HUD_LAYER)) {
      camera.layers.disable(HUD_LAYER);
    }
    return () => {
      setHudMounted(false);
      if (camera.layers.isEnabled(HUD_LAYER)) {
        camera.layers.disable(HUD_LAYER);
      }
    };
  }, [active, camera]);

  useFrame(({ camera: frameCam }) => {
    if (!active) {
      if (frameCam.layers.isEnabled(HUD_LAYER)) frameCam.layers.disable(HUD_LAYER);
      if (fullscreenRef.current && fullscreenRef.current.visible) {
        fullscreenRef.current.visible = false;
      }
      return;
    }
    if (!frameCam.layers.isEnabled(HUD_LAYER)) {
      frameCam.layers.enable(HUD_LAYER);
    }
    if (fullscreenRef.current && !fullscreenRef.current.visible) {
      fullscreenRef.current.visible = true;
    }
    if (taggedFramesRef.current < 5 && fullscreenRef.current) {
      taggedFramesRef.current += 1;
      fullscreenRef.current.traverse((obj) => {
        if (obj.layers.mask !== HUD_LAYER_MASK) {
          obj.layers.set(HUD_LAYER);
        }
        if (!obj.userData.isHudAttachment) {
          obj.userData.isHudAttachment = true;
          obj.raycast = NO_RAYCAST;
        }
        obj.castShadow = false;
        obj.receiveShadow = false;
      });
    }
  });

  return (
    <Fullscreen
      ref={fullscreenRef}
      attachCamera={true}
      depthTest={false}
      depthWrite={false}
      renderOrder={999}
      pointerEvents="none"
      flexDirection="column"
      justifyContent="space-between"
      paddingTop={54}
      paddingBottom={18}
      paddingLeft={18}
      paddingRight={18}
    >
      {/* Top telemetry row */}
      <Container flexDirection="row" justifyContent="space-between" alignItems="center" pointerEvents="none">
        <Container
          flexDirection="row"
          gap={10}
          paddingX={12}
          paddingY={6}
          borderRadius={6}
          borderWidth={1}
          borderColor={PILL_BORDER}
          backgroundColor={PILL_BG}
          depthTest={false}
          depthWrite={false}
          renderOrder={999}
        >
          <Text fontSize={12} fontWeight="bold" color="#38bdf8" depthTest={false} depthWrite={false} renderOrder={999}>
            {cameraModeSignal}
          </Text>
          <Text fontSize={12} color="#e4e4e7" depthTest={false} depthWrite={false} renderOrder={999}>
            {playerStateSignal}
          </Text>
          <Text fontSize={12} color="#34d399" depthTest={false} depthWrite={false} renderOrder={999}>
            {shaderBadgeSignal}
          </Text>
        </Container>

        <Container
          flexDirection="row"
          gap={10}
          paddingX={12}
          paddingY={6}
          borderRadius={6}
          borderWidth={1}
          borderColor={PILL_BORDER}
          backgroundColor={PILL_BG}
          depthTest={false}
          depthWrite={false}
          renderOrder={999}
        >
          <Text fontSize={12} color="#f4f4f5" depthTest={false} depthWrite={false} renderOrder={999}>
            {poseDisplaySignal}
          </Text>
          <Text fontSize={12} color="#fbbf24" depthTest={false} depthWrite={false} renderOrder={999}>
            {lodDisplaySignal}
          </Text>
        </Container>
      </Container>

      {/* Center crosshair + pointer-lock prompt (exact viewport center) */}
      <Container
        positionType="absolute"
        positionTop={0}
        positionBottom={0}
        positionLeft={0}
        positionRight={0}
        alignItems="center"
        justifyContent="center"
        pointerEvents="none"
        depthTest={false}
        depthWrite={false}
        renderOrder={999}
      >
        <Container positionType="relative" width={24} height={24} alignItems="center" justifyContent="center">
          <Container positionType="absolute" width={2} height={2} backgroundColor="#f8fafc" depthTest={false} depthWrite={false} renderOrder={999} />
          <Container positionType="absolute" positionTop={2} width={2} height={5} backgroundColor="#38bdf8" depthTest={false} depthWrite={false} renderOrder={999} />
          <Container positionType="absolute" positionBottom={2} width={2} height={5} backgroundColor="#38bdf8" depthTest={false} depthWrite={false} renderOrder={999} />
          <Container positionType="absolute" positionLeft={2} width={5} height={2} backgroundColor="#38bdf8" depthTest={false} depthWrite={false} renderOrder={999} />
          <Container positionType="absolute" positionRight={2} width={5} height={2} backgroundColor="#38bdf8" depthTest={false} depthWrite={false} renderOrder={999} />
        </Container>

        <Container
          display={pointerPromptDisplaySignal}
          positionType="absolute"
          positionTop="56%"
          paddingX={12}
          paddingY={6}
          borderRadius={6}
          borderWidth={1}
          borderColor={PILL_BORDER}
          backgroundColor={PILL_BG}
          depthTest={false}
          depthWrite={false}
          renderOrder={999}
        >
          <Text fontSize={11} color="#e4e4e7" depthTest={false} depthWrite={false} renderOrder={999}>
            CLICK VIEWPORT TO AIM | ESC TO UNLOCK
          </Text>
        </Container>
      </Container>

      {/* Bottom telemetry row */}
      <Container flexDirection="row" justifyContent="space-between" alignItems="center" pointerEvents="none">
        <Container
          flexDirection="row"
          gap={8}
          paddingX={12}
          paddingY={6}
          borderRadius={6}
          borderWidth={1}
          borderColor={PILL_BORDER}
          backgroundColor={PILL_BG}
          depthTest={false}
          depthWrite={false}
          renderOrder={999}
        >
          <Text fontSize={11} color="#a1a1aa" depthTest={false} depthWrite={false} renderOrder={999}>
            AMMO
          </Text>
          <Text fontSize={13} fontWeight="bold" color="#f8fafc" depthTest={false} depthWrite={false} renderOrder={999}>
            {ammoDisplaySignal}
          </Text>
        </Container>

        <Container
          flexDirection="row"
          gap={12}
          paddingX={12}
          paddingY={6}
          borderRadius={6}
          borderWidth={1}
          borderColor={PILL_BORDER}
          backgroundColor={PILL_BG}
          depthTest={false}
          depthWrite={false}
          renderOrder={999}
        >
          <Text fontSize={12} color="#34d399" depthTest={false} depthWrite={false} renderOrder={999}>
            {hitsDisplaySignal}
          </Text>
          <Text fontSize={12} color="#fb7185" depthTest={false} depthWrite={false} renderOrder={999}>
            {shattersDisplaySignal}
          </Text>
        </Container>
      </Container>
    </Fullscreen>
  );
}
