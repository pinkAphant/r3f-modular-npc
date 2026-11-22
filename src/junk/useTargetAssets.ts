import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { DestructibleTargetSpec } from '../types/junk';
import {
  buildGlassBottleGeometry,
  buildTinCanGeometry,
  countGeometryTriangles,
  createGlassBottleMaterial,
  createTinCanMaterials,
  type ResolvedCanLod,
  selectCanLod,
} from './junkGeometry';
import {
  applySegmentsToImportedRoot,
  type ImportedGlbAsset,
  loadImportedGlbUrl,
} from './junkImporter';
import {
  getProceduralLabelTexture,
  loadCustomLabelTexture,
} from './junkLabels';

export interface TargetAssetsState {
  effectiveLod: ResolvedCanLod;
  setActiveLod: (lod: ResolvedCanLod) => void;
  can3Geo: THREE.BufferGeometry | null;
  can12Geo: THREE.BufferGeometry | null;
  canMats: [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial, THREE.MeshStandardMaterial] | null;
  bottleGeo: THREE.BufferGeometry | null;
  bottleMat: THREE.MeshStandardMaterial | null;
  activeLabelTex: THREE.Texture | null;
  customLabelLoaded: boolean;
  importedRoot: THREE.Group | null;
  importedHalfExtents: [number, number, number] | null;
  importedKey: string;
  triCount: number;
}

/**
 * Manages procedural geometries, labels, custom textures, and imported GLB assets
 * for a DestructibleTarget with deterministic GPU cleanup on unmount/change.
 */
export function useTargetAssets(
  spec: DestructibleTargetSpec,
  importedAsset?: ImportedGlbAsset | null
): TargetAssetsState {
  const [activeLod, setActiveLod] = useState<ResolvedCanLod>(() =>
    selectCanLod(10, spec.canLodMode)
  );
  const [customTex, setCustomTex] = useState<THREE.Texture | null>(null);
  const [loadedAsset, setLoadedAsset] = useState<ImportedGlbAsset | null>(null);

  const effectiveLod: ResolvedCanLod =
    spec.canLodMode === 'auto' ? activeLod : spec.canLodMode;

  useEffect(() => {
    if (spec.canLodMode !== 'auto') {
      setActiveLod(spec.canLodMode);
    }
  }, [spec.canLodMode]);

  useEffect(() => {
    if (spec.labelId !== 'custom' || !spec.customAlbedoUrl) {
      setCustomTex(null);
      return;
    }
    let cancelled = false;
    let disposeTex: (() => void) | null = null;

    loadCustomLabelTexture(spec.customAlbedoUrl)
      .then((res) => {
        if (cancelled) {
          res.dispose();
          return;
        }
        disposeTex = res.dispose;
        setCustomTex(res.texture);
      })
      .catch(() => {
        if (!cancelled) setCustomTex(null);
      });

    return () => {
      cancelled = true;
      disposeTex?.();
    };
  }, [spec.labelId, spec.customAlbedoUrl]);

  useEffect(() => {
    if (spec.kind !== 'imported-glb' || importedAsset || !spec.importedUrl) {
      setLoadedAsset(null);
      return;
    }
    let cancelled = false;
    let owned: ImportedGlbAsset | null = null;

    loadImportedGlbUrl(spec.importedUrl, spec.id)
      .then((asset) => {
        if (cancelled) {
          asset.dispose();
          return;
        }
        owned = asset;
        setLoadedAsset(asset);
      })
      .catch(() => {
        if (!cancelled) setLoadedAsset(null);
      });

    return () => {
      cancelled = true;
      owned?.dispose();
    };
  }, [spec.kind, spec.importedUrl, spec.id, importedAsset]);

  const activeImported = importedAsset ?? loadedAsset;

  const importedRoot = useMemo(() => {
    if (!activeImported) return null;
    return importedAsset ? activeImported.root.clone(true) : activeImported.root;
  }, [activeImported, importedAsset]);

  useEffect(() => {
    if (importedRoot && spec.segments) {
      applySegmentsToImportedRoot(importedRoot, spec.segments);
    }
  }, [importedRoot, spec.segments]);

  const can3Geo = useMemo(
    () => (spec.kind === 'tin-can' ? buildTinCanGeometry('3-gon') : null),
    [spec.kind]
  );
  const can12Geo = useMemo(
    () => (spec.kind === 'tin-can' ? buildTinCanGeometry('12-gon') : null),
    [spec.kind]
  );
  const bottleGeo = useMemo(
    () => (spec.kind === 'glass-bottle' ? buildGlassBottleGeometry() : null),
    [spec.kind]
  );
  const bottleMat = useMemo(
    () => (spec.kind === 'glass-bottle' ? createGlassBottleMaterial() : null),
    [spec.kind]
  );

  useEffect(() => {
    return () => {
      can3Geo?.dispose();
      can12Geo?.dispose();
      bottleGeo?.dispose();
      bottleMat?.dispose();
    };
  }, [can3Geo, can12Geo, bottleGeo, bottleMat]);

  const activeLabelTex = useMemo(() => {
    if (spec.labelId === 'custom' && customTex) return customTex;
    return getProceduralLabelTexture(spec.labelId);
  }, [spec.labelId, customTex]);

  const canMats = useMemo(() => {
    if (spec.kind !== 'tin-can') return null;
    return createTinCanMaterials(activeLabelTex);
  }, [spec.kind, activeLabelTex]);

  useEffect(() => {
    return () => {
      canMats?.forEach((m) => m.dispose());
    };
  }, [canMats]);

  const triCount = useMemo(() => {
    if (spec.kind === 'tin-can') {
      const geo = effectiveLod === '3-gon' ? can3Geo : can12Geo;
      return geo ? countGeometryTriangles(geo) : 0;
    }
    if (spec.kind === 'glass-bottle') {
      return bottleGeo ? countGeometryTriangles(bottleGeo) : 0;
    }
    if (activeImported) {
      return activeImported.segments.reduce((acc, s) => acc + s.triCount, 0);
    }
    return 0;
  }, [spec.kind, effectiveLod, can3Geo, can12Geo, bottleGeo, activeImported]);

  const customLabelLoaded = Boolean(
    spec.labelId === 'custom' && spec.customAlbedoUrl && customTex
  );
  const importedHalfExtents = activeImported?.halfExtents ?? null;
  const importedKey = activeImported?.fileName ?? 'glb';

  return useMemo<TargetAssetsState>(
    () => ({
      effectiveLod,
      setActiveLod,
      can3Geo,
      can12Geo,
      canMats,
      bottleGeo,
      bottleMat,
      activeLabelTex,
      customLabelLoaded,
      importedRoot,
      importedHalfExtents,
      importedKey,
      triCount,
    }),
    [
      effectiveLod,
      can3Geo,
      can12Geo,
      canMats,
      bottleGeo,
      bottleMat,
      activeLabelTex,
      customLabelLoaded,
      importedRoot,
      importedHalfExtents,
      importedKey,
      triCount,
    ]
  );
}
