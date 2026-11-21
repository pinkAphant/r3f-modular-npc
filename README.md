# r3f-modular-npc

Modular low-poly & low-medium-poly NPC system for **React Three Fiber / Three.js** with **glTF 2.0 + `KHR_physics_rigid_bodies` / `KHR_implicit_shapes`** sockets, ragdoll colliders, and ultra-fast albedo/clothing swapping.

Designed to pair directly with [`threejs-khr-armory`](https://github.com/pinkAphant/threejs-khr-armory) (shared `+Z Forward` glTF convention, SI meters, and named hand/gear sockets like `Socket_Hand_R`).

## Two-Tier Architecture

| Spec | Aesthetic | Tri Budget | Clothing Strategy | Status |
| :--- | :--- | :--- | :--- | :--- |
| **[Tier 1: PSX++ / N64++](./docs/SPEC_LOW_POLY_500.md)** | Chunky, readable, jank-and-chonk retro | **~500 tris** | **Albedo-Only** (single UV atlas swap on slightly ambiguous Male/Female base meshes) | **Active — Challenge Mode** |
| **[Tier 2: Dreamcast++ / PS2 HD](./docs/SPEC_LOW_MED_DC_PS2.md)** | Crisp stylized mid-low poly | **1,500–3,500 tris** | **Blender-Fitted Modular Meshes** bound to a shared skeleton (4 builds: M/F × Regular/Large) | **Phase 2 (Parked)** |

## Core Principles

1. **One Draw Call per NPC (Tier 1)**: A single skinned mesh + single `256×256` or `512×512` albedo texture (nearest-neighbor or crisp linear) means swapping outfits is literally swapping `material.map`.
2. **Shared Humanoid Rig & Sockets**: Both tiers use the same canonical bone names and equipment sockets (`Socket_Hand_R`, `Socket_Hand_L`, `Socket_Head`, `Socket_Back`) so weapons, hats, and physics rigs transfer cleanly.
3. **KHR Physics Ready**: Optional `KHR_physics_rigid_bodies` + `KHR_implicit_shapes` capsules on limbs/torso for hitboxes and ragdolls without heavy mesh colliders.
4. **Fast & Cheap AI-Assisted Pipeline**:
   - **Geometry**: Tripo 3D prompt → Blender decimate/retopo to ~500 tris → clean symmetric UV unwrap.
   - **Textures (Albedo-Only)**: Fast, cheap Hugging Face image-to-albedo pipeline (UV-template-guided img2img / ControlNet / multi-view projection) to crank out dozens of outfits in seconds.

## Docs

- [Tier 1 Spec — 500-Tri Challenge (PSX++ / N64++)](./docs/SPEC_LOW_POLY_500.md)
- [Tier 2 Spec — Modular Fitted Clothing (Dreamcast++ / PS2 HD)](./docs/SPEC_LOW_MED_DC_PS2.md)
