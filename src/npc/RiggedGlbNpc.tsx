import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { FingerPoseTag, LoadedWeaponRig, WeaponArchetypeId } from '../types/posing';
import { createFingerPoser, type FingerPoser } from './fingerPoser';
import {
  applyNpcAppearance,
  applyNpcClipTransition,
  attachSocketMarkers,
  getCachedNpcGltfSync,
  inspectNpcScene,
  loadCachedNpcGltf,
  normalizeNpcHeight,
} from './npcRigSetup';
import { loadAndMountWeapon } from './weaponLoader';
import { createWiggleRig, type WiggleRigController, type WiggleStats } from './wiggleRig';

export interface RiggedNpcInfo {
  tris: number;
  animations: string[];
  boneCount: number;
}

export interface RiggedNpcTelemetry {
  poseTag: FingerPoseTag;
  wiggle: WiggleStats;
  fingerEulerRad: Record<string, [number, number, number]>;
  ikAnchorsFound: string[];
}

export interface RiggedGlbNpcProps {
  url: string;
  activeAnim: string | null;
  wireframe: boolean;
  showSockets: boolean;
  customAlbedoUrl: string | null;
  onLoaded: (info: RiggedNpcInfo) => void;
  targetHeightM?: number;
  poseTag?: FingerPoseTag;
  poseWeight?: number;
  wiggleEnabled?: boolean;
  wiggleIntensity?: number;
  weaponArchetype?: 'none' | WeaponArchetypeId;
  mountWeaponMesh?: boolean;
  crossfadeSec?: number;
  paused?: boolean;
  onWeaponLoaded?: (rig: LoadedWeaponRig | null) => void;
  onTelemetryUpdate?: (telemetry: RiggedNpcTelemetry) => void;
}

export function RiggedGlbNpc({
  url,
  activeAnim,
  wireframe,
  showSockets,
  customAlbedoUrl,
  onLoaded,
  targetHeightM = 1.0,
  poseTag = 'relaxed',
  poseWeight = 1,
  wiggleEnabled = true,
  wiggleIntensity = 0.65,
  weaponArchetype = 'none',
  mountWeaponMesh = true,
  crossfadeSec = 0.2,
  paused = false,
  onWeaponLoaded,
  onTelemetryUpdate,
}: RiggedGlbNpcProps) {
  const containerRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const clipsRef = useRef<Record<string, THREE.AnimationClip>>({});
  const actionsRef = useRef<Record<string, THREE.AnimationAction>>({});
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  const sceneRef = useRef<THREE.Group | null>(null);
  const skeletonRef = useRef<THREE.Skeleton | null>(null);
  const fingerPoserRef = useRef<FingerPoser | null>(null);
  const wiggleRigRef = useRef<WiggleRigController | null>(null);
  const mountedGroupRef = useRef<THREE.Group | null>(null);
  const weaponRigRef = useRef<LoadedWeaponRig | null>(null);
  const origMapsRef = useRef<Map<THREE.Material, THREE.Texture | null>>(new Map());
  const socketMarkersRef = useRef<THREE.Object3D[]>([]);
  const [loadVersion, setLoadVersion] = useState(0);

  const showSocketsRef = useRef(showSockets);
  showSocketsRef.current = showSockets;
  const poseTagRef = useRef(poseTag);
  const poseWeightRef = useRef(poseWeight);
  const onTelemetryRef = useRef(onTelemetryUpdate);
  poseTagRef.current = poseTag;
  poseWeightRef.current = poseWeight;
  onTelemetryRef.current = onTelemetryUpdate;

  const customTex = useMemo(() => {
    if (!customAlbedoUrl) return null;
    const tex = new THREE.TextureLoader().load(customAlbedoUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false;
    return tex;
  }, [customAlbedoUrl]);

  useEffect(() => () => customTex?.dispose(), [customTex]);

  useEffect(() => {
    let cancelled = false;
    const mountNpc = (root: THREE.Group, animations: THREE.AnimationClip[]) => {
      if (cancelled) return;
      normalizeNpcHeight(root, targetHeightM);
      const { tris, boneCount, skeleton } = inspectNpcScene(root, origMapsRef.current);
      socketMarkersRef.current = showSocketsRef.current
        ? attachSocketMarkers(root, skeleton, true)
        : [];
      const fingerPoser = createFingerPoser(root, skeleton);
      const wiggleRig = createWiggleRig(root, skeleton, {
        enabled: wiggleEnabled,
        intensity: wiggleIntensity,
      });
      const mixer = new THREE.AnimationMixer(root);
      const clips: Record<string, THREE.AnimationClip> = {};
      for (const clip of animations) clips[clip.name] = clip;

      skeletonRef.current = skeleton;
      fingerPoserRef.current = fingerPoser;
      wiggleRigRef.current = wiggleRig;
      mixerRef.current = mixer;
      clipsRef.current = clips;
      actionsRef.current = {};
      currentActionRef.current = null;
      sceneRef.current = root;
      if (containerRef.current) {
        containerRef.current.clear();
        containerRef.current.add(root);
      }
      setLoadVersion((v) => v + 1);
      onLoaded({ tris, animations: animations.map((c) => c.name), boneCount });
    };

    const syncHit = getCachedNpcGltfSync(url);
    if (syncHit) mountNpc(syncHit.root, syncHit.animations);
    else void loadCachedNpcGltf(url).then((d) => mountNpc(d.root, d.animations));

    return () => {
      cancelled = true;
      mountedGroupRef.current?.removeFromParent();
      mountedGroupRef.current = null;
      weaponRigRef.current = null;
      socketMarkersRef.current = [];
      wiggleRigRef.current?.dispose();
      wiggleRigRef.current = null;
      fingerPoserRef.current = null;
      mixerRef.current?.stopAllAction();
      mixerRef.current = null;
      clipsRef.current = {};
      actionsRef.current = {};
      currentActionRef.current = null;
      sceneRef.current = null;
      skeletonRef.current = null;
      containerRef.current?.clear();
    };
  }, [url, targetHeightM, onLoaded]);

  useEffect(() => {
    wiggleRigRef.current?.setConfig(wiggleEnabled, wiggleIntensity);
  }, [wiggleEnabled, wiggleIntensity, loadVersion]);

  useLayoutEffect(() => {
    const mixer = mixerRef.current;
    if (!mixer) return;
    currentActionRef.current = applyNpcClipTransition(
      mixer,
      clipsRef.current,
      actionsRef.current,
      currentActionRef.current,
      activeAnim,
      crossfadeSec,
      fingerPoserRef.current,
      poseTagRef.current,
      poseWeightRef.current,
      sceneRef.current,
      wiggleRigRef.current
    );
  }, [activeAnim, url, loadVersion, crossfadeSec]);

  useEffect(() => {
    const root = sceneRef.current;
    if (!root) return;
    if (showSockets && socketMarkersRef.current.length === 0) {
      socketMarkersRef.current = attachSocketMarkers(root, skeletonRef.current, true);
    }
    applyNpcAppearance(root, origMapsRef.current, socketMarkersRef.current, wireframe, customTex, showSockets);
  }, [wireframe, customTex, showSockets, loadVersion]);

  useEffect(() => {
    let cancelled = false;
    mountedGroupRef.current?.removeFromParent();
    mountedGroupRef.current = null;
    weaponRigRef.current = null;
    const root = sceneRef.current;
    if (!root || !mountWeaponMesh || weaponArchetype === 'none') {
      onWeaponLoaded?.(null);
      return;
    }
    loadAndMountWeapon(root, weaponArchetype, targetHeightM, skeletonRef.current)
      .then(({ rig, mountedGroup }) => {
        if (cancelled || sceneRef.current !== root) return;
        mountedGroupRef.current = mountedGroup;
        weaponRigRef.current = rig;
        onWeaponLoaded?.(rig);
      })
      .catch(() => {
        if (!cancelled) onWeaponLoaded?.(null);
      });
    return () => { cancelled = true; };
  }, [weaponArchetype, mountWeaponMesh, targetHeightM, loadVersion, onWeaponLoaded]);

  useFrame((_, delta) => {
    if (paused) return;
    const dt = Math.min(Math.max(Number.isFinite(delta) ? delta : 0, 0), 0.35);
    mixerRef.current?.update(dt);
    const root = sceneRef.current;
    if (!root) return;
    fingerPoserRef.current?.apply(poseTagRef.current, poseWeightRef.current, dt);
    root.updateMatrixWorld(true);
    wiggleRigRef.current?.update(dt);

    const cb = onTelemetryRef.current;
    if (cb && wiggleRigRef.current && fingerPoserRef.current) {
      cb({
        poseTag: poseTagRef.current,
        wiggle: wiggleRigRef.current.getStats(),
        fingerEulerRad: fingerPoserRef.current.getEulerSnapshot(),
        ikAnchorsFound: weaponRigRef.current
          ? Object.keys(weaponRigRef.current.anchors)
          : [],
      });
    }
  });

  return <group ref={containerRef} />;
}
