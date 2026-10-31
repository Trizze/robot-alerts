"""Render each color texture in the user's two sample ZIPs on an existing preview scene.
Run inside Blender; source ZIPs stay on the PC. Renders are transferred for inspection.
"""
import bpy
import os
import tempfile
import zipfile
import subprocess
from pathlib import PurePosixPath

SOURCE = r'D:\AI-Projects\1-MarvinAI\Export to Marvin\Export To marvin-uploads'
DESTINATION = 'marvin@marvin:/home/marvin/uploads/robot-shots/'
SCENE = 'RA_TexturePreview_CC0'
PACKS = {
    'lowbit': ('Lowbit_Seamless_Pixel_Textures_Vol2_Sampler_FREE.zip', '/32px/', '.png', 10),
    'willosuna': ('stylized-textures-lite.zip', '/', '_albedo.png', 8),
}

def render_sample_pack(pack):
    archive_name, directory, ending, expected = PACKS[pack]
    scene = bpy.data.scenes[SCENE]
    names = ['head_v2', 'jampre_body', 'jampre_arm_', 'jampre_leg_', 'jampre_boot_']
    parts = [o for o in scene.objects if o.type == 'MESH' and any(x in o.name for x in names)]
    if not parts or any(not o.name.startswith('RA_TexturePreview_') for o in parts):
        raise RuntimeError('Preview copies are missing')
    material_name = 'RA_TexturePreview_BatchMaterial_' + pack
    material = bpy.data.materials.get(material_name) or bpy.data.materials.new(material_name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial')
    shader = nodes.new('ShaderNodeBsdfPrincipled')
    texture = nodes.new('ShaderNodeTexImage')
    coordinates = nodes.new('ShaderNodeTexCoord')
    texture.projection = 'BOX'
    texture.projection_blend = .15
    texture.extension = 'REPEAT'
    if pack == 'lowbit':
        texture.interpolation = 'Closest'
    material.node_tree.links.new(coordinates.outputs['Generated'], texture.inputs['Vector'])
    material.node_tree.links.new(texture.outputs['Color'], shader.inputs['Base Color'])
    material.node_tree.links.new(shader.outputs['BSDF'], output.inputs['Surface'])
    for part in parts:
        for slot in part.material_slots:
            slot.material = material
    scene.render.image_settings.file_format = 'PNG'
    scene.frame_set(854)
    with tempfile.TemporaryDirectory(prefix='robot-textures-') as temp:
        output_zip = os.path.join(temp, 'robot-textures-' + pack + '.zip')
        with zipfile.ZipFile(os.path.join(SOURCE, archive_name)) as source, zipfile.ZipFile(output_zip, 'w', compression=zipfile.ZIP_DEFLATED) as result:
            entries = sorted((i for i in source.infolist() if not i.is_dir() and directory in '/' + i.filename and i.filename.lower().endswith(ending)), key=lambda i: i.filename)
            if len(entries) != expected:
                raise ValueError('Unexpected number of color textures: ' + str(len(entries)))
            for entry in entries:
                name = PurePosixPath(entry.filename).name
                if not name or entry.file_size > 25_000_000 or '/' in name or '\\' in name:
                    raise ValueError('Invalid texture entry')
                image_path = os.path.join(temp, name)
                with open(image_path, 'wb') as image_file:
                    image_file.write(source.read(entry))
                image = bpy.data.images.load(image_path, check_existing=False)
                texture.image = image
                scene.render.filepath = os.path.join(temp, pack + '-' + name)
                bpy.ops.render.render(write_still=True, scene=scene.name)
                result.write(scene.render.filepath, arcname=pack + '-' + name)
                texture.image = None
                bpy.data.images.remove(image)
                os.remove(image_path)
                print('Rendered', pack, name)
        subprocess.run(['scp', '-q', '-o', 'BatchMode=yes', output_zip, DESTINATION + os.path.basename(output_zip)], check=True, timeout=60)
        print('Transferred rendered batch:', pack, expected)

def render_lowbit():
    render_sample_pack('lowbit')

def render_willosuna():
    render_sample_pack('willosuna')
