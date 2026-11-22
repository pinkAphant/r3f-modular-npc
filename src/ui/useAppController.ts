import { useCallback, useEffect, useRef, useState } from 'react';
import { reloadHudAmmo } from '../hud/hudSignals';
import { getCachedNpcAnimNames, resolveFallbackAnim } from '../npc/npcRigSetup';
import type { CharacterId } from '../npc/NpcViewport';
import type { RiggedNpcInfo } from '../npc/RiggedGlbNpc';
import { preloadRangeBootAssets } from '../range/preloadAssets';
import {
  installRangeTelemetry,
  setTelemetryApp,
  setTelemetryDreamcast,
  setTelemetryHero,
  setTelemetryReady,
  setTelemetrySingleItemEditMode,
  type TelemetryHeroVariant,
} from '../range/rangeTelemetry';
import { setRangeWeapon, useRangeState } from '../range/useRangeTargets';
import { DEFAULT_DREAMCAST_CONFIG } from '../shaders/dreamcastShader';
import type { WeaponArchetypeId } from '../types/posing';
import type { AppMode, CameraPerspective, DreamcastConfig } from '../types/range';

const HOTKEY_WEAPONS: Record<string, WeaponArchetypeId> = {
  Digit1: 'pistol',
  Digit2: 'shotgun',
  Digit3: 'smg',
  Digit4: 'rpg',
};

export function readInitialMode(): AppMode {
  if (typeof window === 'undefined') return 'range';
  return new URLSearchParams(window.location.search).get('mode') === 'viewer'
    ? 'viewer'
    : 'range';
}

function toHeroVariant(charId: CharacterId): TelemetryHeroVariant {
  return charId === 'male' ? 'male' : charId === 'female' ? 'female' : 'custom';
}

preloadRangeBootAssets();

export function useAppController() {
  const initialModeRef = useRef<AppMode>(readInitialMode());
  const [mode, setMode] = useState<AppMode>(initialModeRef.current);
  const [rangeMounted, setRangeMounted] = useState<boolean>(
    initialModeRef.current === 'range'
  );
  const rangeMountedRef = useRef<boolean>(initialModeRef.current === 'range');
  const [perspective, setPerspective] = useState<CameraPerspective>('first');
  const [dreamcast, setDreamcast] = useState<DreamcastConfig>(DEFAULT_DREAMCAST_CONFIG);
  const range = useRangeState();

  const [character, setCharacter] = useState<CharacterId>('hero');
  const characterRef = useRef<CharacterId>('hero');
  const loadedVariantRef = useRef<TelemetryHeroVariant>('custom');
  const [customGlbUrl, setCustomGlbUrl] = useState<string | null>(null);
  const [customGlbName, setCustomGlbName] = useState<string | null>(null);
  const [animations, setAnimations] = useState<string[]>([]);
  const [activeAnim, setActiveAnim] = useState<string | null>(null);
  const [triCount, setTriCount] = useState(500);
  const [boneCount, setBoneCount] = useState(65);
  const [wireframe, setWireframe] = useState(false);
  const [showSockets, setShowSockets] = useState(true);
  const [customAlbedoUrl, setCustomAlbedoUrl] = useState<string | null>(null);
  const customGlbUrlRef = useRef<string | null>(null);
  const customAlbedoUrlRef = useRef<string | null>(null);

  useEffect(() => {
    installRangeTelemetry();
  }, []);

  useEffect(() => {
    if (mode === 'viewer') {
      setTelemetryApp('viewer', range.singleItemEditMode);
      setTelemetryDreamcast({
        enabled: false,
        pixelSnapWidth: 0,
        pixelSnapHeight: 0,
        rgb555Enabled: false,
      });
    } else {
      setTelemetrySingleItemEditMode(range.singleItemEditMode);
    }
  }, [mode, range.singleItemEditMode]);

  useEffect(() => {
    if (mode === 'viewer') {
      setTelemetryHero(loadedVariantRef.current, boneCount, activeAnim);
    }
  }, [mode, boneCount, activeAnim]);

  useEffect(() => {
    if (mode !== 'range') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.code === 'KeyR') {
        reloadHudAmmo();
        return;
      }
      if (range.singleItemEditMode === 'none') {
        const weapon = HOTKEY_WEAPONS[e.code];
        if (weapon) setRangeWeapon(weapon);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, range.singleItemEditMode]);

  useEffect(() => {
    const prev = customGlbUrlRef.current;
    if (prev && prev !== customGlbUrl && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
    customGlbUrlRef.current = customGlbUrl;
  }, [customGlbUrl]);

  useEffect(() => {
    const prev = customAlbedoUrlRef.current;
    if (prev && prev !== customAlbedoUrl && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
    customAlbedoUrlRef.current = customAlbedoUrl;
  }, [customAlbedoUrl]);

  useEffect(() => () => {
    if (customGlbUrlRef.current?.startsWith('blob:')) URL.revokeObjectURL(customGlbUrlRef.current);
    if (customAlbedoUrlRef.current?.startsWith('blob:')) URL.revokeObjectURL(customAlbedoUrlRef.current);
  }, []);

  const handleModeChange = useCallback((next: AppMode) => {
    if (mode === 'range' && next !== 'range') document.exitPointerLock?.();
    if (next === 'range' && !rangeMountedRef.current) {
      setTelemetryReady(false);
      rangeMountedRef.current = true;
      setRangeMounted(true);
    }
    if (next === 'viewer' && animations.length === 0) {
      const url =
        character === 'male'
          ? '/assets/npc_psx_m.glb'
          : character === 'female'
            ? '/assets/npc_psx_f.glb'
            : customGlbUrl ?? '/assets/npc_hero_uploaded.glb';
      const cached = getCachedNpcAnimNames(url);
      if (cached.length > 0) {
        setAnimations(cached);
        setActiveAnim((prev) => prev ?? resolveFallbackAnim(cached));
      }
    }
    setMode(next);
  }, [mode, animations.length, character, customGlbUrl]);

  const handleUpdateDreamcast = useCallback((patch: Partial<DreamcastConfig>) => {
    setDreamcast((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleTogglePerspective = useCallback(() => {
    setPerspective((prev) => (prev === 'first' ? 'third' : 'first'));
  }, []);

  const handleLoaded = useCallback((info: RiggedNpcInfo) => {
    setTriCount(info.tris);
    setAnimations(info.animations);
    setBoneCount(info.boneCount);
    const nextAnim = resolveFallbackAnim(info.animations);
    setActiveAnim((prev) =>
      prev && info.animations.includes(prev) ? prev : nextAnim
    );
    const variant = toHeroVariant(characterRef.current);
    loadedVariantRef.current = variant;
    setTelemetryHero(variant, info.boneCount, nextAnim);
    setTelemetryReady(true);
  }, []);

  const handleSelectCharacter = useCallback((id: CharacterId) => {
    characterRef.current = id;
    setCustomAlbedoUrl(null);
    setCharacter(id);
  }, []);

  const handleResetCustomGlb = useCallback(() => {
    characterRef.current = 'male';
    setCharacter('male');
    setCustomGlbUrl(null);
    setCustomGlbName(null);
  }, []);

  const handleResetAlbedo = useCallback(() => {
    setCustomAlbedoUrl(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    if (mode !== 'viewer') return;
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.glb') || lower.endsWith('.gltf')) {
      characterRef.current = 'custom';
      setCustomGlbUrl(URL.createObjectURL(file));
      setCustomGlbName(file.name);
      setCharacter('custom');
    } else if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.webp')) {
      setCustomAlbedoUrl(URL.createObjectURL(file));
    }
  }, [mode]);

  return {
    initialMode: initialModeRef.current,
    mode,
    rangeMounted,
    perspective,
    setPerspective,
    dreamcast,
    range,
    character,
    customGlbUrl,
    customGlbName,
    animations,
    activeAnim,
    setActiveAnim,
    triCount,
    boneCount,
    wireframe,
    setWireframe,
    showSockets,
    setShowSockets,
    customAlbedoUrl,
    handleModeChange,
    handleUpdateDreamcast,
    handleTogglePerspective,
    handleLoaded,
    handleSelectCharacter,
    handleResetCustomGlb,
    handleResetAlbedo,
    handleDrop,
  };
}
