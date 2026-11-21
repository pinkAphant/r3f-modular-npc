# Tier 2 Spec: Modular Fitted Clothing (Dreamcast++ / PS2 HD)

> **Status**: Parked for Phase 2 — keeping ideas captured while we sprint on the [500-Tri Challenge](./SPEC_LOW_POLY_500.md).

Goal: **Dreamcast / PS2 HD** stylized NPCs (**1,500–3,500 tris**) with **separate Blender-fitted clothing meshes** bound to a **single shared skeleton** across 4 body archetypes.

---

## 1. Body Archetypes (4 Builds)

All 4 builds share the **exact same bone hierarchy and naming** (with per-build bone rest-pose offsets/proportions):

1. `female_regular`
2. `female_large`
3. `male_regular`
4. `male_large`

---

## 2. Modular Clothing & Skinning Strategy

- **Slots**: `Head/Hair`, `Top/Jacket`, `Bottom/Pants`, `Shoes`, `Accessories` (hats, glasses, bags).
- **Blender Weight Transfer**:
  - Fit each clothing mesh to the target body build in Blender.
  - Use `Data Transfer` modifier (`Vertex Data → Vertex Groups`, Nearest Face Interpolated) from the base body to the clothing mesh so elbows/knees/shoulders deform identically with zero poking.
- **Under-Clothing Culling**:
  - Split base body into hideable body-part groups (or vertex-alpha/UV-mask regions) so torso/legs under shirts/pants are hidden at runtime—preventing clipping and saving triangles.
- **Runtime Assembly in R3F**:
  - Load one `Skeleton` from the base body, attach clothing `SkinnedMesh`es and call `clothingMesh.bind(baseSkeleton)` so all parts animate from a single `AnimationMixer`.

---

## 3. Faces & Expressions (Dreamcast / PS2 Style)

- **Option A (Classic DC/PS2)**: Separate face UV island + `4×4` sprite-sheet UV offset for blink, talk, angry, happy (zero morph-target overhead).
- **Option B (PS2 HD)**: 4–6 lightweight morph targets (`Blink`, `JawOpen`, `Smile`, `BrowFurrow`) on the head mesh only.

---

## 4. Open-Source / Hugging Face Ecosystem Notes

Tools worth testing when we move to Phase 2:
- **Auto-Rigging**: `UniRig` / `Make-It-Animatable` (HF Spaces) for fast humanoid weight-painting on Tripo/Hunyuan outputs.
- **Base Mesh Generation**: `TripoSG`, `Hunyuan3D-2`, `TRELLIS` for clean stylized bases.
- **Texture / Albedo Baking**: `MV-Adapter`, `SyncMVD`, `Hunyuan3D-2 Paint` for delighting + multi-view albedo baking.
