"""Three object-animated dance loops on an isolated copy; source meshes stay intact."""
import bpy, math
from mathutils import Vector
source = bpy.data.scenes['RA_CurrentRobot_Motion']
name = 'RA_Dance_Loops'
scene = bpy.data.scenes.get(name)
if scene and not scene.get('ra_owned_dance'):
    raise RuntimeError('Scene name belongs to someone else')
if scene is None:
    source.frame_set(854)
    scene = source.copy(); scene.name = name; copies = {}
    for old in list(scene.objects):
        obj = old.copy(); obj.name = 'RA_Dance_' + old.name
        if old.data: obj.data = old.data.copy()
        obj.animation_data_clear()
        scene.collection.objects.link(obj); copies[old] = obj
    for old, obj in copies.items():
        if old.parent in copies:
            obj.parent = copies[old.parent]
            obj.matrix_parent_inverse = old.matrix_parent_inverse.copy()
    for old in copies: scene.collection.objects.unlink(old)
    scene.camera = copies[source.camera]
    scene.world = source.world.copy() if source.world else None
    scene['ra_owned_dance'] = True
bpy.context.window.scene = scene
scene.render.fps = 60; scene.frame_start = 1001; scene.frame_end = 1296
scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage = 1920,1080,100
scene.eevee.taa_render_samples = 16
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'; scene.render.image_settings.color_mode = 'RGBA'
def part(suffix):
    return next(o for o in scene.objects if o.name.endswith(suffix))
root, upper = part('Robot_Root'), part('Upper_Root')
head = part('jampre_head_v2')
for clip, start in [('shuffle',1001),('disco',1101),('victory',1201)]:
    for index in range(96):
        p = 2*math.pi*index/95; w = math.sin(p); env = (1-math.cos(p))/2
        root.location = (0.07*w,0,0.025*(1-math.cos(2*p)))
        root.rotation_euler = (0,0,0)
        upper.rotation_euler = (0,0.06*w,0.04*w)
        if clip == 'disco': upper.rotation_euler = (0,0.08*w,0.13*w)
        if clip == 'victory':
            root.location.z = 0.13*math.sin(2*p)**2
            upper.rotation_euler = (-0.07*env,0.04*w,0)
        waist=Vector((0,0,0.9)); upper.location = waist-upper.rotation_euler.to_matrix()@waist
        head.rotation_euler = (0,0,0.025*w)
        posed=[root,upper,head]
        for side, sign in [('l',1),('r',-1)]:
            arm, leg, boot = part('jampre_arm_'+side), part('jampre_leg_'+side), part('jampre_boot_'+side)
            arm.rotation_euler = (-0.4*w*sign,0.2*env*sign,0)
            leg.rotation_euler = (0.24*w*sign,0,0.08*w*sign)
            if clip == 'disco':
                arm.rotation_euler = (-0.18*env,(0.65 if side=='l' else -2.05)*env,0)
                leg.rotation_euler = (0.1*w*sign,0,0.1*w*sign)
            if clip == 'victory':
                arm.rotation_euler = (-0.2*math.sin(2*p)*env,1.6*env*sign,0)
                leg.rotation_euler = (0.12*w*sign,0,0.08*env*sign)
            boot.rotation_euler = (-leg.rotation_euler.x,0,0)
            posed += [arm,leg,boot]
        for obj in posed:
            for path in ['location','rotation_euler']: obj.keyframe_insert(path,frame=start+index,group='Robot Alerts '+clip)
            obj.animation_data.action.name='RA_Dance_'+obj.name.removeprefix('RA_Dance_')
scene['ra_dance_clips'] = 'shuffle:1001,disco:1101,victory:1201'
scene.frame_set(1025)
print('Prepared three 96-frame loops at 60 fps on owned copies; source meshes/actions unchanged')
