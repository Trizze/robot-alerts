"""Bake rest-space surface attributes on owned copies, never the source meshes."""
import bpy
from mathutils import Vector

if bpy.app.driver_namespace.get('ra_pattern_export', {}).get('running'):
    raise RuntimeError('Do not change maps while their export is running')
source = bpy.data.scenes["RA_CurrentRobot_Source"]
name = "RA_PatternMaps"
scene = bpy.data.scenes.get(name)
if scene is None:
    scene = source.copy()
    scene.name = name
    copies = {}
    # The isolated source keeps all its objects in its root collection.
    if len(source.collection.objects) != len(source.objects):
        raise RuntimeError('Source hierarchy changed; inspect before copying')
    for old in list(scene.objects):
        obj = old.copy()
        obj.name = "RA_Pattern_" + old.name
        if old.data:
            obj.data = old.data.copy()
        scene.collection.objects.link(obj)
        copies[old] = obj
    for old, obj in copies.items():
        if old.parent in copies:
            obj.parent = copies[old.parent]
    scene["ra_owned"] = True
    scene.camera = copies[source.camera]
    scene.world = source.world.copy() if source.world else None
    for old in copies:
        scene.collection.objects.unlink(old)
bpy.context.window.scene = scene
scene.frame_set(854)
dg = bpy.context.evaluated_depsgraph_get()
meshes = [o for o in scene.objects if o.type == 'MESH' and not o.hide_render]
if not scene.get("ra_maps_baked"):
    for obj in meshes:
        evaluated = obj.evaluated_get(dg)
        baked = bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=True, depsgraph=dg)
        obj.data = baked
        obj.modifiers.clear()
    points = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
    lo = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    hi = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    center = (lo + hi) / 2
    def canonical(p):
        return Vector((p.x-center.x, p.z-lo.z, -(p.y-center.y)))
    allpoints = [canonical(p) for p in points]
    origin = Vector(tuple(min(p[i] for p in allpoints)-0.01 for i in range(3)))
    span = Vector(tuple(max(p[i] for p in allpoints)-origin[i]+0.01 for i in range(3)))
    scene['ra_position_origin'] = list(origin)
    scene['ra_position_span'] = list(span)
    for obj in meshes:
        mesh = obj.data
        pos = mesh.attributes.new('ra_position', 'FLOAT_VECTOR', 'POINT')
        normal = mesh.attributes.new('ra_normal', 'FLOAT_VECTOR', 'CORNER')
        for v in mesh.vertices:
            p = canonical(obj.matrix_world @ v.co)
            pos.data[v.index].vector = tuple((p[i]-origin[i])/span[i] for i in range(3))
        nm = obj.matrix_world.to_3x3().inverted().transposed()
        for face in mesh.polygons:
            n = (nm @ face.normal).normalized()
            encoded = ((n.x+1)/2, (n.z+1)/2, (-n.y+1)/2)
            for i in face.loop_indices:
                normal.data[i].vector = encoded
    scene['ra_maps_baked'] = True

def material(kind):
    name = 'RA_PatternMap_' + kind
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    tree = mat.node_tree
    tree.nodes.clear()
    output = tree.nodes.new('ShaderNodeOutputMaterial')
    if kind == 'holdout':
        node = tree.nodes.new('ShaderNodeHoldout')
    elif kind == 'shade':
        node = tree.nodes.new('ShaderNodeBsdfPrincipled')
        node.inputs['Base Color'].default_value = (1, 1, 1, 1)
        node.inputs['Roughness'].default_value = .72
    else:
        node = tree.nodes.new('ShaderNodeEmission')
        attr = tree.nodes.new('ShaderNodeAttribute')
        attr.attribute_name = 'ra_normal' if kind == 'normal' else 'ra_position'
        value = attr.outputs['Vector']
        if kind in ['high', 'low']:
            def vector_math(operation, x, y=None):
                n = tree.nodes.new('ShaderNodeVectorMath')
                n.operation = operation
                tree.links.new(x, n.inputs[0])
                if y is not None:
                    n.inputs[1].default_value = (y, y, y)
                return n.outputs[0]
            value = vector_math('MULTIPLY', value, 4095)
            value = vector_math('FLOOR', value)
            if kind == 'high':
                value = vector_math('DIVIDE', value, 16)
                value = vector_math('FLOOR', value)
                value = vector_math('DIVIDE', value, 255)
            else:
                value = vector_math('MODULO', value, 16)
                value = vector_math('DIVIDE', value, 15)
        tree.links.new(value, node.inputs['Color'])
    tree.links.new(node.outputs[0], output.inputs['Surface'])
    return mat

for kind in ['holdout', 'high', 'low', 'normal', 'shade']:
    material(kind)
scene.render.resolution_x, scene.render.resolution_y = 1920, 1080
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.color_depth = '8'
scene.view_settings.view_transform = 'Raw'
scene.view_settings.look = 'None'
scene.view_settings.exposure, scene.view_settings.gamma = 0, 1
print('Pattern scene ready', len(meshes), 'meshes', list(scene['ra_position_origin']), list(scene['ra_position_span']))
