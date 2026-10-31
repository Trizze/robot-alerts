"""Prepare revised joints for rendering without changing the source scenes."""
import bpy

ns = bpy.app.driver_namespace
if ns.get("ra_current_export", {}).get("running"):
    raise RuntimeError("Do not change render setup while an export is running")
scene = bpy.data.scenes.get("RA_CurrentRobot_Motion") or bpy.data.scenes.get("RA_CurrentRobot_Source")
if scene is None:
    source = bpy.data.scenes["RA_Joint_Study"]
    original = bpy.data.scenes["RobotAlerts_CameraTests"]
    scene = bpy.data.scenes.new("RA_CurrentRobot_Motion")
    copies = {}
    for old in source.objects:
        obj = old.copy()
        obj.name = "RA_Current_" + old.name
        if old.data:
            obj.data = old.data.copy()
        scene.collection.objects.link(obj)
        copies[old] = obj
    for old, obj in copies.items():
        if old.parent in copies:
            obj.parent = copies[old.parent]
            obj.matrix_parent_inverse = old.matrix_parent_inverse.copy()
    camera = original.camera.copy()
    camera.data = original.camera.data.copy()
    camera.name = "RA_Current_ProductionCamera"
    scene.collection.objects.link(camera)
    scene.camera = camera
    scene.world = source.world.copy() if source.world else None
    scene.render.engine = original.render.engine
    scene["ra_created"] = True

original = bpy.data.scenes.get("RobotAlerts_CameraTests")
meshes = [obj for obj in scene.objects if obj.type == "MESH" and not obj.hide_render]
for obj in meshes:
    source = original.objects.get(obj.name.removeprefix("RA_Current_RA_JointStudy_")) if original else None
    if original and "Simple_shoulder_" in obj.name:
        source = original.objects.get("RA_Test_jampre_arm_" + obj.name[-1])
    if original and "Simple_hip_" in obj.name:
        source = original.objects.get("RA_Test_jampre_leg_" + obj.name[-1])
    if source:
        indices = [poly.material_index for poly in source.data.polygons]
        materials = list(source.data.materials)
        obj.data.materials.clear()
        for material in materials:
            obj.data.materials.append(material)
        if len(indices) == len(obj.data.polygons):
            for poly, index in zip(obj.data.polygons, indices):
                poly.material_index = index

def layer_group(obj):
    name = obj.name
    if "screen_curved" in name:
        return "screen"
    if "chest_" in name:
        return "chest"
    if "head_v2" in name:
        return "head"
    if any(key in name for key in ["leg_", "boot_", "Simple_hip_"]):
        return "legs"
    if any(key in name for key in ["arm_l", "hand_l", "Simple_shoulder_l"]):
        return "arm_l"
    if any(key in name for key in ["arm_r", "hand_r", "Simple_shoulder_r"]):
        return "arm_r"
    return "torso"

ns["ra_current_base_materials"] = {obj.name: tuple(obj.data.materials) for obj in meshes}
ns["ra_current_layer_group"] = layer_group
for name, shader in [("RA_Current_Holdout", "ShaderNodeHoldout"), ("RA_Current_Mask", "ShaderNodeEmission")]:
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    material.node_tree.nodes.clear()
    output = material.node_tree.nodes.new("ShaderNodeOutputMaterial")
    node = material.node_tree.nodes.new(shader)
    if node.type == "EMISSION":
        node.inputs["Color"].default_value = (1, 1, 1, 1)
    material.node_tree.links.new(node.outputs[0], output.inputs["Surface"])
formats = [item.identifier for item in bpy.types.ImageFormatSettings.bl_rna.properties["file_format"].enum_items]
if "PNG" not in formats:
    raise RuntimeError("PNG export unavailable")
scene.render.image_settings.file_format = "PNG"
modes = [item.identifier for item in scene.render.image_settings.bl_rna.properties["color_mode"].enum_items]
if "RGBA" not in modes:
    raise RuntimeError("Alpha export unavailable")
scene.render.image_settings.color_mode = "RGBA"
scene.render.film_transparent = True
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.resolution_percentage = 100
scene.frame_start = 801
scene.frame_end = 950
scene["ra_model_revision"] = "joints-20261031"
bpy.context.window.scene = scene
scene.frame_set(854)
print("Revised-joint scene ready; source meshes unchanged")
