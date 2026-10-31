"""Preview the 30 CC0 candidates on independent copies of the robot in Blender."""
import bpy, json, os, re, subprocess, tempfile, zipfile

home = os.path.join(os.path.expanduser('~'), 'Downloads', 'Marvin', 'Robot Alerts')
source = os.path.join(home, 'Robot Alerts - robot-fancy-study-textures.zip')
study = bpy.data.scenes.get('RA_TierPattern_Preview') or bpy.data.scenes.new('RA_TierPattern_Preview')
if not study.get('ra_created'):
    copies = {}
    for old in bpy.data.scenes['RA_Joint_Study'].objects:
        obj = old.copy(); obj.name = 'RA_TierPreview_' + old.name; study.collection.objects.link(obj); copies[old] = obj
        if old.type in {'MESH', 'CAMERA'}: obj.data = old.data.copy()
    for old, obj in copies.items():
        if old.parent in copies: obj.parent = copies[old.parent]
    original = bpy.data.scenes['RA_Joint_Study']
    study.world = original.world; study.camera = copies[original.camera]
    study.render.engine = original.render.engine; study.render.film_transparent = True
    study.render.resolution_x = 1024; study.render.resolution_y = 768; study.render.resolution_percentage = 100
    study['ra_created'] = True
bpy.context.window.scene = study; study.frame_set(854)
study.render.image_settings.file_format = 'PNG'
materials = []
for obj in study.objects:
    if obj.type != 'MESH' or obj.hide_render or any(x in obj.name for x in ['screen_curved', 'chest_base', 'chest_display']): continue
    mat = bpy.data.materials.get('RA_TierStudy_' + obj.name) or bpy.data.materials.new('RA_TierStudy_' + obj.name)
    mat.use_nodes = True; nodes = mat.node_tree.nodes; nodes.clear(); links = mat.node_tree.links
    out = nodes.new('ShaderNodeOutputMaterial'); shader = nodes.new('ShaderNodeBsdfPrincipled')
    coord = nodes.new('ShaderNodeTexCoord'); image = nodes.new('ShaderNodeTexImage')
    image.projection = 'BOX'; image.projection_blend = .15; image.extension = 'REPEAT'
    coord.object = obj.parent if any(x in obj.name for x in ['Simple_shoulder_', 'Simple_hip_', 'jampre_hand_', 'jampre_boot_']) else obj
    links.new(coord.outputs['Object'], image.inputs['Vector']); links.new(image.outputs['Color'], shader.inputs['Base Color'])
    links.new(shader.outputs['BSDF'], out.inputs['Surface'])
    for slot in obj.material_slots: slot.material = mat
    materials.append(image)

with tempfile.TemporaryDirectory(prefix='robot-tier-study-') as temp:
    archive = os.path.join(temp, 'robot-fancy-pattern-renders.zip')
    with zipfile.ZipFile(source) as inputs, zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as outputs:
        catalog = json.loads(inputs.read('tier-study.json'))['textures']
        if len(catalog) != 12: raise ValueError('Expected 12 texture candidates')
        for item in catalog:
            name = item['file']; tier = item['tier']
            if not re.fullmatch(r'[a-z0-9_]+\.jpg', name) or tier not in range(1, 6): raise ValueError('Invalid texture name or tier')
            info = inputs.getinfo(name)
            if info.file_size > 15_000_000: raise ValueError('Texture is unexpectedly large')
            image_path = os.path.join(temp, name)
            with open(image_path, 'wb') as out: out.write(inputs.read(info))
            pic = bpy.data.images.load(image_path, check_existing=False)
            for node in materials: node.image = pic
            output_name = 'tier%d-%s.png' % (tier, name[:-4]); study.render.filepath = os.path.join(temp, output_name)
            bpy.ops.render.render(write_still=True, scene=study.name)
            outputs.write(study.render.filepath, arcname=output_name)
            for node in materials: node.image = None
            bpy.data.images.remove(pic); os.remove(image_path); os.remove(study.render.filepath)
            print('Rendered', output_name)
        outputs.writestr('tier-study.json', json.dumps(catalog))
    subprocess.run(['scp', '-q', '-o', 'BatchMode=yes', archive, 'marvin@marvin:/home/marvin/uploads/robot-shots/robot-fancy-pattern-renders.zip'], check=True, timeout=60)
print('Transferred all 12 robot renders')
