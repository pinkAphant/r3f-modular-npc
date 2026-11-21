# Tier 1 Spec: The 500-Tri Challenge (PSX++ / N64++)

Goal: Build **2 chunky, charming ~500-triangle base meshes** (1 Male, 1 Female) whose silhouettes are intentionally slightly ambiguous so **albedo-only clothing** reads immediately—no extra geometry required for shirts, jackets, pants, or uniforms.

---

## 1. Triangle Budget (~500 Tris Total)

Target **450–550 triangles** (hard ceiling: `600` tris). Keep quads clean along bend joints (elbows, knees, waist) so animation doesn't collapse.

| Region | Target Tris | Notes |
| :--- | :---: | :--- |
| **Head + Neck** | 110–130 | Expressive blocky silhouette; nose/jaw implied by 2–3 planes + painted albedo |
| **Torso + Pelvis** | 120–140 | Slightly ambiguous chest/waist so painted clothes (t-shirts, hoodies, coats, vests) sit naturally |
| **Arms (L + R)** | 100–120 | 6-sided cylinders; single edge loop at elbow |
| **Hands (L + R)** | 32–40 | Mitten/block hands (thumb + fused fingers) — peak N64/PSX energy |
| **Legs (L + R)** | 100–120 | 6-sided cylinders; single edge loop at knee |
| **Feet (L + R)** | 32–40 | Wedge/block boots/feet |
| **Total** | **~494–590** | Aim right at **500 tris** |

---

## 2. Base Meshes (The "Underwear" Blank Canvas)

- **2 Archetypes**:
  - `npc_psx_m.glb` — Male base (neutral/stocky, white tighty-whities base albedo).
  - `npc_psx_f.glb` — Female base (neutral/athletic, white bra + undies base albedo).
- **Scale & Orientation**:
  - **SI Meters**: Standing height `1.70m` (female) / `1.78m` (male), feet planted at `Y = 0`.
  - **Forward**: `+Z` (glTF 2.0 / Three.js standard).
  - **Pose**: **A-Pose** (arms ~35–45° down) for cleaner shoulder deformation and easier Tripo generation.

---

## 3. UV Layout & Albedo-Only Clothing

This is the secret sauce for making albedo-only outfits fast to generate and swap:

- **Resolution**: `256×256` (pure PSX) or `512×512` (PSX++ / N64++ crisp).
- **Filtering**: `THREE.NearestFilter` (crisp pixels) or `THREE.LinearFilter` with `generateMipmaps = false`.
- **Material**: Unlit (`MeshBasicMaterial`) or vertex-lit / simple lambert (`MeshLambertMaterial` / `MeshStandardMaterial` with `roughness: 1.0`, `metalness: 0.0`, **no normal/roughness maps**).
- **Shared UV Atlas Convention**:
  - Top-Left: **Head / Face** (largest texel density! ~30% of UV space so faces look great).
  - Top-Right: **Torso Front & Back** (aligned straight upright so 2D shirt/jacket prints map cleanly).
  - Bottom-Left: **Legs & Feet** (aligned upright for pants/shorts/boots).
  - Bottom-Right: **Arms & Hands** (aligned upright for sleeves/gloves).
- **Swap Mechanism in R3F**:
  ```tsx
  // Zero geometry rebuilds — just swap the texture
  mesh.material.map = outfitTexture;
  mesh.material.needsUpdate = true;
  ```

---

## 4. Skeleton & KHR Sockets

### Minimal Humanoid Rig (15–19 Bones)
- `Hips` (root)
  - `Spine` → `Chest` → `Neck` → `Head`
  - `UpperArm_L` → `Forearm_L` → `Hand_L`
  - `UpperArm_R` → `Forearm_R` → `Hand_R`
  - `Thigh_L` → `Shin_L` → `Foot_L`
  - `Thigh_R` → `Shin_R` → `Foot_R`
- **Skinning**: Max **2 bone influences per vertex** (or 1 for pure PS1 rigid-segment look).

### Attachment Sockets (Empty Nodes)
Parented to bones so `threejs-khr-armory` weapons & props snap right on:
- `Socket_Hand_R` / `Socket_Hand_L` (aligned to `IK_Palm_Primary`)
- `Socket_Head` (hats, helmets, hair cards)
- `Socket_Back` (backpacks, rifles)

### Optional KHR Physics (`KHR_physics_rigid_bodies` + `KHR_implicit_shapes`)
- Capsule colliders on `Torso`, `Head`, `UpperArm`, `Forearm`, `Thigh`, `Shin` for cheap hitboxes or ragdoll death states.

---

## 5. Tripo + Fast/Cheap Hugging Face Albedo Pipeline

### Step A: Tripo 3D Base Generation
Prompt tips for clean, low-poly-friendly A-pose bases:
- *"Low poly retro PS1 N64 style human character, standing in A-pose, neutral expression, wearing plain white underwear, simple chunky geometry, flat shading, clean silhouette, no accessories, no hair"*
- Export GLB → Blender:
  1. Symmetrize (`Mesh → Symmetrize`).
  2. Decimate / quick manual retopo to **~500 tris**.
  3. Unwrap into the **4-quadrant upright UV atlas** above.
  4. Rig with the 15-bone armature + export `.glb`.

### Step B: Fast & Cheap Image → Albedo (Hugging Face)
Two great ways to generate outfits without expensive 3D reruns:
1. **UV-Template-Guided 2D Generation**: Export the flat UV wireframe/base-body layout as a `512×512` PNG → run a fast img2img / ControlNet / Flux-dev / SDXL-Turbo Space on Hugging Face with prompts like *"retro PS1 texture atlas, tactical jacket and cargo pants, flat lighting, no shadows"* → drop straight onto `material.map`.
2. **Multi-View Projection (MV-Adapter / Paint3D)**: Render front/back orthographic views of the 500-tri mesh, paint clothes in 2D with a fast HF model, and project-bake back onto the UV atlas.
