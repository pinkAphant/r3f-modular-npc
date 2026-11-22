"""Articulate mitten hands on npc_psx_m.glb and npc_psx_f.glb into 5 distinct fingers.

Run with Blender 5.x headless:
  /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/articulate_hands.py
"""

import json
import math
import os
import struct
import sys
import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

SIDES = ("Left", "Right")
DIGITS = ("Thumb", "Index", "Middle", "Ring", "Pinky")
DIGIT_RADII = {
    "Thumb": 0.0048,
    "Index": 0.0040,
    "Middle": 0.0040,
    "Ring": 0.0038,
    "Pinky": 0.0033,
}
DEFAULT_TARGETS = (
    "public/assets/npc_psx_m.glb",
    "public/assets/npc_psx_f.glb",
)


def is_already_articulated(glb_path: str) -> bool:
    """Inspect GLB binary weights to avoid double-articulating an already processed file."""
    with open(glb_path, "rb") as f:
        data = f.read()
    if len(data) < 20 or data[:4] != b"glTF":
        return False
    jlen = struct.unpack_from("<I", data, 12)[0]
    g = json.loads(data[20 : 20 + jlen])
    bin_off = 20 + jlen + 8
    bin_data = data[bin_off:]
    skin = g["skins"][0]
    joint_names = [g["nodes"][j]["name"] for j in skin["joints"]]
    prim = g["meshes"][0]["primitives"][0]

    def read_acc(idx: int):
        acc = g["accessors"][idx]
        bv = g["bufferViews"][acc["bufferView"]]
        off = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
        stride = bv.get("byteStride")
        n = acc["count"]
        comp = acc["componentType"]
        fmt_map = {5121: "B", 5123: "H", 5125: "I", 5126: "f"}
        num_c = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[acc["type"]]
        sz = struct.calcsize(fmt_map[comp]) * num_c
        st = stride or sz
        return [
            struct.unpack_from("<" + fmt_map[comp] * num_c, bin_data, off + i * st)
            for i in range(n)
        ]

    joints = read_acc(prim["attributes"]["JOINTS_0"])
    weights = read_acc(prim["attributes"]["WEIGHTS_0"])
    counts = {name: 0 for name in joint_names}
    max_w = {name: 0.0 for name in joint_names}
    for j4, w4 in zip(joints, weights):
        for j, w in zip(j4, w4):
            if w > 0.05 and j < len(joint_names):
                name = joint_names[j]
                counts[name] += 1
                if w > max_w[name]:
                    max_w[name] = w

    for side in SIDES:
        prefix = f"mixamorig:{side}Hand"
        if prefix not in counts:
            prefix = f"mixamorig{side}Hand"
        for digit in DIGITS:
            for k in (1, 2, 3):
                bname = f"{prefix}{digit}{k}"
                if counts.get(bname, 0) < 4 or max_w.get(bname, 0.0) < 0.6:
                    return False
    return True


def find_bone_prefix(arm_obj, side: str) -> str:
    if f"mixamorig:{side}Hand" in arm_obj.data.bones:
        return f"mixamorig:{side}"
    return f"mixamorig{side}"


def build_uv_reference(bm_src: bmesh.types.BMesh, mesh_obj, hand_vg_indices: set[int]):
    """Clone hand triangles into a BVHTree for single-triangle barycentric UV projection."""
    uv_layer = bm_src.loops.layers.uv.active
    dlayer = bm_src.verts.layers.deform.active

    ref_bm = bmesh.new()
    vert_map: dict[int, bmesh.types.BMVert] = {}
    face_uvs: list[tuple[Vector, Vector, Vector, Vector, Vector, Vector]] = []

    hand_faces = []
    for f in bm_src.faces:
        if any(
            sum(v[dlayer].get(idx, 0.0) for idx in hand_vg_indices) > 0.05
            for v in f.verts
        ):
            hand_faces.append(f)

    for f in hand_faces:
        if len(f.loops) < 3:
            continue
        new_verts = []
        uvs = []
        for lp in f.loops:
            vi = lp.vert.index
            if vi not in vert_map:
                vert_map[vi] = ref_bm.verts.new(lp.vert.co.copy())
            new_verts.append(vert_map[vi])
            uvs.append(Vector((lp[uv_layer].uv.x, lp[uv_layer].uv.y)))
        for i in range(1, len(new_verts) - 1):
            tri_v = [new_verts[0], new_verts[i], new_verts[i + 1]]
            tri_uv = [uvs[0], uvs[i], uvs[i + 1]]
            try:
                nf = ref_bm.faces.new(tri_v)
                nf.index = len(face_uvs)
                face_uvs.append(
                    (
                        tri_v[0].co.copy(),
                        tri_v[1].co.copy(),
                        tri_v[2].co.copy(),
                        tri_uv[0],
                        tri_uv[1],
                        tri_uv[2],
                    )
                )
            except ValueError:
                pass

    ref_bm.faces.ensure_lookup_table()
    bvh = BVHTree.FromBMesh(ref_bm)
    return ref_bm, bvh, face_uvs


def project_barycentric_uv(
    pt: Vector,
    tri: tuple[Vector, Vector, Vector, Vector, Vector, Vector],
) -> tuple[float, float]:
    p0, p1, p2, uv0, uv1, uv2 = tri
    v0 = p1 - p0
    v1 = p2 - p0
    v2 = pt - p0
    d00 = v0.dot(v0)
    d01 = v0.dot(v1)
    d11 = v1.dot(v1)
    d20 = v2.dot(v0)
    d21 = v2.dot(v1)
    denom = d00 * d11 - d01 * d01
    if abs(denom) < 1e-12:
        return (uv0.x, uv0.y)
    v = (d11 * d20 - d01 * d21) / denom
    w = (d00 * d21 - d01 * d20) / denom
    u = 1.0 - v - w
    u = max(0.0, min(1.0, u))
    v = max(0.0, min(1.0, v))
    w = max(0.0, min(1.0, w))
    s = u + v + w
    if s > 1e-9:
        u, v, w = u / s, v / s, w / s
    else:
        u, v, w = 1.0, 0.0, 0.0
    uv = uv0 * u + uv1 * v + uv2 * w
    return (max(0.002, min(0.998, uv.x)), max(0.002, min(0.998, uv.y)))


def set_vert_weights(v: bmesh.types.BMVert, dlayer, weights: dict[int, float]) -> None:
    d = v[dlayer]
    d.clear()
    total = sum(weights.values())
    if total <= 1e-9:
        return
    for vg_idx, w in weights.items():
        if w > 1e-5:
            d[vg_idx] = w / total


def find_wrist_loop(
    bm: bmesh.types.BMesh,
    hand_pos: Vector,
    max_vert_dist: float = 0.08,
) -> list[bmesh.types.BMVert]:
    """Find the single closed wrist boundary cycle within max_vert_dist of hand_pos."""
    open_edges = [e for e in bm.edges if len(e.link_faces) == 1]
    if not open_edges:
        return []
    adj: dict[bmesh.types.BMVert, list[bmesh.types.BMVert]] = {}
    for e in open_edges:
        v0, v1 = e.verts[0], e.verts[1]
        adj.setdefault(v0, []).append(v1)
        adj.setdefault(v1, []).append(v0)

    visited: set[bmesh.types.BMVert] = set()
    loops: list[list[bmesh.types.BMVert]] = []
    for start in adj:
        if start in visited:
            continue
        # Collect connected component first
        comp: list[bmesh.types.BMVert] = []
        stack = [start]
        while stack:
            u = stack.pop()
            if u in visited:
                continue
            visited.add(u)
            comp.append(u)
            for nb in adj[u]:
                if nb not in visited:
                    stack.append(nb)

        if len(comp) < 3:
            continue
        if not all(len(adj[v]) == 2 for v in comp):
            continue
        if not all((v.co - hand_pos).length < max_vert_dist for v in comp):
            continue

        # Walk the closed 2-regular cycle in topological edge order
        ordered: list[bmesh.types.BMVert] = [comp[0]]
        prev = None
        curr = adj[comp[0]][0]
        while curr != comp[0] and len(ordered) <= len(comp):
            ordered.append(curr)
            nbs = adj[curr]
            nxt = nbs[0] if nbs[1] == (prev if prev is not None else comp[0]) else nbs[1]
            prev, curr = curr, nxt
        if len(ordered) == len(comp) and curr == comp[0]:
            loops.append(ordered)

    if not loops:
        return []
    return min(
        loops,
        key=lambda lp: (sum((v.co for v in lp), Vector()) / len(lp) - hand_pos).length,
    )


def build_palm_cap(
    bm: bmesh.types.BMesh,
    dlayer,
    wrist_loop: list[bmesh.types.BMVert],
    bone_pts: dict[str, Vector],
    hand_vg: int,
    thumb1_vg: int,
    new_faces: list[bmesh.types.BMFace],
) -> None:
    """Bridge the open wrist loop to a watertight low-poly palm housing all digit roots."""
    n = len(wrist_loop)
    wrist_center = sum((v.co for v in wrist_loop), Vector()) / n
    index1 = bone_pts["Index1"]
    middle1 = bone_pts["Middle1"]
    pinky1 = bone_pts["Pinky1"]
    thumb1 = bone_pts["Thumb1"]

    along = (middle1 - wrist_center).normalized()
    radial = (index1 - pinky1)
    radial = (radial - along * radial.dot(along)).normalized()
    palm_normal = along.cross(radial).normalized()
    if palm_normal.dot(thumb1 - wrist_center) < 0:
        palm_normal = -palm_normal

    # Orient topological wrist cycle consistently CCW around `along`
    def loop_angle(v: bmesh.types.BMVert) -> float:
        rel = v.co - wrist_center
        return math.atan2(rel.dot(palm_normal), rel.dot(radial))

    signed_vec = Vector((0.0, 0.0, 0.0))
    for i in range(n):
        w0 = wrist_loop[i].co - wrist_center
        w1 = wrist_loop[(i + 1) % n].co - wrist_center
        signed_vec += w0.cross(w1)
    ordered_wrist = list(wrist_loop) if signed_vec.dot(along) >= 0 else list(reversed(wrist_loop))

    knuckle_mid = (index1 + pinky1) * 0.5
    palm_tip_center = knuckle_mid + along * 0.004
    thumb_dir = (thumb1 - wrist_center)
    thumb_off = radial * 0.011 + palm_normal * 0.004

    # Create a matching N-gon knuckle ring slightly thicker at palm center & thumb base
    palm_ring: list[bmesh.types.BMVert] = []
    for i, wv in enumerate(ordered_wrist):
        ang = loop_angle(wv)
        rx = math.cos(ang)
        py = math.sin(ang)
        half_w = (index1 - pinky1).length * 0.5 + 0.0035
        half_t = 0.0075
        pos = palm_tip_center + radial * (rx * half_w) + palm_normal * (py * half_t)
        if rx > 0.3:
            pos += along * -0.004 + thumb_off * 0.25
        pv = bm.verts.new(pos)
        if rx > 0.45 and py > 0.0:
            set_vert_weights(pv, dlayer, {hand_vg: 0.75, thumb1_vg: 0.25})
        else:
            set_vert_weights(pv, dlayer, {hand_vg: 1.0})
        palm_ring.append(pv)

    # Bridge wrist_loop -> palm_ring
    for i in range(n):
        j = (i + 1) % n
        w0, w1 = ordered_wrist[i], ordered_wrist[j]
        p0, p1 = palm_ring[i], palm_ring[j]
        new_faces.append(bm.faces.new((w0, w1, p1)))
        new_faces.append(bm.faces.new((w0, p1, p0)))

    # Cap distal palm_ring to center knuckle vertex
    cap_v = bm.verts.new(palm_tip_center + along * 0.003)
    set_vert_weights(cap_v, dlayer, {hand_vg: 1.0})
    for i in range(n):
        j = (i + 1) % n
        new_faces.append(bm.faces.new((palm_ring[i], palm_ring[j], cap_v)))


def build_digit_tube(
    bm: bmesh.types.BMesh,
    dlayer,
    pts: tuple[Vector, Vector, Vector, Vector],
    r_base: float,
    palm_normal: Vector,
    hand_vg: int,
    phalanx_vgs: tuple[int, int, int],
    new_faces: list[bmesh.types.BMFace],
) -> None:
    """Create a watertight 4-sided 3-phalanx finger tube anchored into the palm."""
    p1, p2, p3, p4 = pts
    d1 = (p2 - p1).normalized()
    d2 = (p3 - p2).normalized()
    d3 = (p4 - p3).normalized()

    def frame(fwd: Vector):
        n = (palm_normal - fwd * palm_normal.dot(fwd))
        if n.length < 1e-6:
            n = Vector((0, 0, 1)).cross(fwd)
            if n.length < 1e-6:
                n = Vector((1, 0, 0)).cross(fwd)
        n.normalize()
        side = fwd.cross(n).normalized()
        return side, n

    s1, n1 = frame(d1)
    s2, n2 = frame(d2)
    s3, n3 = frame(d3)

    rings_spec = [
        (p1 - d1 * 0.003, s1, n1, r_base * 1.02, {hand_vg: 0.45, phalanx_vgs[0]: 0.55}),
        ((p1 + p2) * 0.5, s1, n1, r_base * 0.96, {phalanx_vgs[0]: 1.0}),
        ((p2 + p3) * 0.5, s2, n2, r_base * 0.88, {phalanx_vgs[1]: 1.0}),
        (p3.lerp(p4, 0.65), s3, n3, r_base * 0.78, {phalanx_vgs[2]: 1.0}),
    ]

    rings: list[list[bmesh.types.BMVert]] = []
    for center, side, norm, rad, wmap in rings_spec:
        ring = []
        for sx, ny in ((1, 0), (0, 1), (-1, 0), (0, -1)):
            v = bm.verts.new(center + side * (sx * rad) + norm * (ny * rad * 0.92))
            set_vert_weights(v, dlayer, wmap)
            ring.append(v)
        rings.append(ring)

    # Base cap inside palm
    base_cap = bm.verts.new(p1 - d1 * 0.005)
    set_vert_weights(base_cap, dlayer, {hand_vg: 0.6, phalanx_vgs[0]: 0.4})
    for i in range(4):
        j = (i + 1) % 4
        new_faces.append(bm.faces.new((rings[0][j], rings[0][i], base_cap)))

    # Connect phalanx rings
    for r_idx in range(len(rings) - 1):
        r0 = rings[r_idx]
        r1 = rings[r_idx + 1]
        for i in range(4):
            j = (i + 1) % 4
            new_faces.append(bm.faces.new((r0[i], r0[j], r1[j])))
            new_faces.append(bm.faces.new((r0[i], r1[j], r1[i])))

    # Distal fingertip cap
    tip_v = bm.verts.new(p4)
    set_vert_weights(tip_v, dlayer, {phalanx_vgs[2]: 1.0})
    last = rings[-1]
    for i in range(4):
        j = (i + 1) % 4
        new_faces.append(bm.faces.new((last[i], last[j], tip_v)))


def articulate_glb(src_path: str, dst_path: str, force: bool = False) -> None:
    if not force and os.path.exists(dst_path) and is_already_articulated(dst_path):
        print(f"[SKIP] {dst_path} already has articulated fingers.")
        return

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src_path)

    for obj in list(bpy.data.objects):
        if obj.type == "MESH" and obj.name.startswith("Icosphere"):
            bpy.data.objects.remove(obj, do_unlink=True)

    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    mesh_obj = next(o for o in bpy.data.objects if o.type == "MESH")

    arm.data.pose_position = "REST"
    bpy.context.view_layer.update()

    bm = bmesh.new()
    bm.from_mesh(mesh_obj.data)
    # Weld glTF UV-seam split vertices so boundary detection sees the true manifold mesh
    # (per-loop UVs on bm.faces remain intact).
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.verts.ensure_lookup_table()
    bm.edges.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    dlayer = bm.verts.layers.deform.active or bm.verts.layers.deform.new()
    uv_layer = bm.loops.layers.uv.active or bm.loops.layers.uv.new()

    vg_map = {vg.name: vg.index for vg in mesh_obj.vertex_groups}

    # Build per-side UV BVH reference before deleting mitten faces
    side_refs = {}
    faces_to_delete: set[bmesh.types.BMFace] = set()

    for side in SIDES:
        prefix = find_bone_prefix(arm, side)
        hand_name = f"{prefix}Hand"
        hand_vg = vg_map[hand_name]
        forearm_vg = vg_map[f"{prefix}ForeArm"]
        arm_vg = vg_map[f"{prefix}Arm"]
        hand_all_vgs = {
            vg.index for vg in mesh_obj.vertex_groups if vg.name.startswith(hand_name)
        }
        finger_vgs = hand_all_vgs - {hand_vg}
        hand_pos = arm.data.bones[hand_name].head_local.copy()

        side_refs[side] = build_uv_reference(bm, mesh_obj, hand_all_vgs)

        for f in bm.faces:
            vs = f.verts
            has_forearm = any(
                v[dlayer].get(forearm_vg, 0.0) + v[dlayer].get(arm_vg, 0.0) > 0.5
                for v in vs
            )
            has_hand = any(
                sum(v[dlayer].get(idx, 0.0) for idx in hand_all_vgs) > 0.5 for v in vs
            )
            has_far_finger = any(
                sum(v[dlayer].get(idx, 0.0) for idx in finger_vgs) > 0.5
                and (v.co - hand_pos).length > 0.04
                for v in vs
            )
            if (not has_forearm and has_hand) or (has_forearm and has_far_finger):
                faces_to_delete.add(f)

    bmesh.ops.delete(bm, geom=list(faces_to_delete), context="FACES")

    # Remove orphaned vertices left behind by deleted hand faces
    orphans = [v for v in bm.verts if len(v.link_faces) == 0]
    if orphans:
        bmesh.ops.delete(bm, geom=orphans, context="VERTS")

    new_faces_by_side: dict[str, list[bmesh.types.BMFace]] = {s: [] for s in SIDES}

    for side in SIDES:
        prefix = find_bone_prefix(arm, side)
        hand_name = f"{prefix}Hand"
        hand_vg = vg_map[hand_name]
        hand_pos = arm.data.bones[hand_name].head_local.copy()
        wrist_loop = find_wrist_loop(bm, hand_pos)
        if not wrist_loop:
            raise RuntimeError(f"Failed to locate wrist loop for {side} in {src_path}")

        bone_pts = {}
        for d in DIGITS:
            for k in (1, 2, 3, 4):
                bone_pts[f"{d}{k}"] = arm.data.bones[f"{hand_name}{d}{k}"].head_local.copy()

        along = (bone_pts["Middle1"] - hand_pos).normalized()
        radial = bone_pts["Index1"] - bone_pts["Pinky1"]
        radial = (radial - along * radial.dot(along)).normalized()
        palm_normal = along.cross(radial).normalized()
        if palm_normal.dot(bone_pts["Thumb1"] - hand_pos) < 0:
            palm_normal = -palm_normal

        side_faces = new_faces_by_side[side]
        build_palm_cap(
            bm,
            dlayer,
            wrist_loop,
            bone_pts,
            hand_vg,
            vg_map[f"{hand_name}Thumb1"],
            side_faces,
        )

        for d in DIGITS:
            pts = (
                bone_pts[f"{d}1"],
                bone_pts[f"{d}2"],
                bone_pts[f"{d}3"],
                bone_pts[f"{d}4"],
            )
            phalanx_vgs = (
                vg_map[f"{hand_name}{d}1"],
                vg_map[f"{hand_name}{d}2"],
                vg_map[f"{hand_name}{d}3"],
            )
            build_digit_tube(
                bm,
                dlayer,
                pts,
                DIGIT_RADII[d],
                palm_normal,
                hand_vg,
                phalanx_vgs,
                side_faces,
            )

    # Project UVs per face onto single reference triangle to prevent cross-island stretching
    for side in SIDES:
        ref_bm, bvh, face_uvs = side_refs[side]
        for f in new_faces_by_side[side]:
            f.smooth = True
            centroid = f.calc_center_median()
            _, _, f_idx, _ = bvh.find_nearest(centroid)
            if f_idx is None or f_idx >= len(face_uvs):
                continue
            tri = face_uvs[f_idx]
            for lp in f.loops:
                u, v = project_barycentric_uv(lp.vert.co, tri)
                lp[uv_layer].uv = (u, v)
        ref_bm.free()

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bnd = sum(1 for e in bm.edges if len(e.link_faces) == 1)
    nm = sum(1 for e in bm.edges if len(e.link_faces) > 2)
    degen = sum(1 for f in bm.faces if f.calc_area() <= 1e-10)
    if bnd or nm or degen:
        bm.free()
        raise RuntimeError(
            f"Topology validation failed for {src_path}: boundary={bnd}, nonmanifold={nm}, degen={degen}"
        )
    bm.to_mesh(mesh_obj.data)
    bm.free()
    mesh_obj.data.update()

    arm.data.pose_position = "POSE"
    bpy.context.view_layer.update()

    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    mesh_obj.select_set(True)
    bpy.context.view_layer.objects.active = arm

    bpy.ops.export_scene.gltf(
        filepath=dst_path,
        export_format="GLB",
        export_image_format="JPEG",
        export_animations=True,
        export_skins=True,
        use_selection=True,
    )
    print(f"[OK] Articulated {src_path} -> {dst_path}")


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    force = "--force" in argv
    targets = [a for a in argv if not a.startswith("--")] or list(DEFAULT_TARGETS)
    for path in targets:
        abs_path = os.path.abspath(path)
        articulate_glb(abs_path, abs_path, force=force)


if __name__ == "__main__":
    main()
