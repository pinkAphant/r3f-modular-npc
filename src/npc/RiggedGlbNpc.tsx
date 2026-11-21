import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface RiggedNpcInfo {
  tris: number;
  animations: string[];
  boneCount: number;
}

interface RiggedGlbNpcProps {
  url: string;
  activeAnim: string | null;
  wireframe: boolean;
  pixelCrisp: boolean;
  showSockets: boolean;
  customAlbedoUrl: string | null;
  onLoaded: (info: RiggedNpcInfo) => void;
}

const SOCKET_BONES: Array<{ bone: string; name: string; color: string }> = [
  { bone: 'mixamorig:RightHand', name: 'Socket_Hand_R', color: '#f97316' },
  { bone: 'mixamorig:LeftHand', name: 'Socket_Hand_L', color: '#a855f7' },
  { bone: 'mixamorig:Head', name: 'Socket_Head', color: '#38bdf8' },
  { bone: 'mixamorig:Spine2', name: 'Socket_Back', color: '#22c55e' },
];

export function RiggedGlbNpc({
  url,
  activeAnim,
  wireframe,
  pixelCrisp,
  showSockets,
  customAlbedoUrl,
  onLoaded,
}: RiggedGlbNpcProps) {
  const containerRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Record<string, THREE.AnimationAction>>({});
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  const sceneRef = useRef<THREE.Group | null>(null);
  const origMapsRef = useRef<Map<THREE.Material, THREE.Texture | null>>(new Map());
  const socketMarkersRef = useRef<THREE.Object3D[]>([]);

  const customTex = useMemo(() => {
    if (!customAlbedoUrl) return null;
    const tex = new THREE.TextureLoader().load(customAlbedoUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false;
    tex.magFilter = pixelCrisp ? THREE.NearestFilter : THREE.LinearFilter;
    tex.minFilter = pixelCrisp ? THREE.NearestFilter : THREE.LinearMipmapLinearFilter;
    return tex;
  }, [customAlbedoUrl, pixelCrisp]);

  useEffect(() => {
    return () => {
      customTex?.dispose();
    };
  }, [customTex]);

  useEffect(() => {
    let cancelled = false;
    const loader = new GLTFLoader();
    loader.load(url, (gltf) => {
      if (cancelled) return;
      const root = gltf.scene;

      // Ground feet to Y=0
      const box = new THREE.Box3().setFromObject(root);
      if (Number.isFinite(box.min.y)) {
        root.position.y -= box.min.y;
      }

      let tris = 0;
      let boneCount = 0;
      origMapsRef.current.clear();
      socketMarkersRef.current = [];

      root.traverse((obj) => {
        if ((obj as THREE.Bone).isBone) boneCount++;
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          const g = mesh.geometry;
          tris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => {
            const std = m as THREE.MeshStandardMaterial;
            origMapsRef.current.set(m, std.map ?? null);
          });
        }
      });

      // Attach visual socket markers to Mixamo bones
      for (const spec of SOCKET_BONES) {
        const bone = root.getObjectByName(spec.bone);
        if (bone) {
          const marker = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.035, 0),
            new THREE.MeshBasicMaterial({ color: spec.color, wireframe: true })
          );
          marker.name = spec.name;
          marker.visible = showSockets;
          bone.add(marker);
          socketMarkersRef.current.push(marker);
        }
      }

      const mixer = new THREE.AnimationMixer(root);
      const actions: Record<string, THREE.AnimationAction> = {};
      for (const clip of gltf.animations) {
        actions[clip.name] = mixer.clipAction(clip);
      }

      mixerRef.current = mixer;
      actionsRef.current = actions;
      currentActionRef.current = null;
      sceneRef.current = root;

      if (containerRef.current) {
        containerRef.current.clear();
        containerRef.current.add(root);
      }

      const animNames = gltf.animations.map((c) => c.name);
      onLoaded({ tris: Math.round(tris), animations: animNames, boneCount });
    });

    return () => {
      cancelled = true;
      mixerRef.current?.stopAllAction();
      mixerRef.current = null;
      actionsRef.current = {};
      currentActionRef.current = null;
      containerRef.current?.clear();
    };
  }, [url, onLoaded]);

  // Switch active animation with smooth crossfade
  useEffect(() => {
    const actions = actionsRef.current;
    const names = Object.keys(actions);
    if (names.length === 0) return;
    const targetName = activeAnim && actions[activeAnim] ? activeAnim : names[0];
    const next = actions[targetName];
    const prev = currentActionRef.current;
    if (next && next !== prev) {
      next.reset().fadeIn(0.2).play();
      prev?.fadeOut(0.2);
      currentActionRef.current = next;
    }
  }, [activeAnim, url]);

  // Apply wireframe, pixel-crisp filtering, custom albedo, and socket visibility
  useEffect(() => {
    const root = sceneRef.current;
    if (!root) return;
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh && !obj.name.startsWith('Socket_')) {
        const rawMat = (obj as THREE.Mesh).material;
        const mats: THREE.Material[] = Array.isArray(rawMat) ? rawMat : [rawMat];
        mats.forEach((m) => {
          const std = m as THREE.MeshStandardMaterial;
          std.wireframe = wireframe;
          const baseMap = origMapsRef.current.get(m) ?? null;
          std.map = customTex ?? baseMap;
          if (std.map) {
            std.map.magFilter = pixelCrisp ? THREE.NearestFilter : THREE.LinearFilter;
            std.map.minFilter = pixelCrisp ? THREE.NearestFilter : THREE.LinearMipmapLinearFilter;
            std.map.needsUpdate = true;
          }
          std.needsUpdate = true;
        });
      }
    });
    for (const m of socketMarkersRef.current) {
      m.visible = showSockets;
    }
  }, [wireframe, pixelCrisp, customTex, showSockets]);

  useFrame((_, delta) => {
    mixerRef.current?.update(Math.min(delta, 0.05));
  });

  return <group ref={containerRef} />;
}
