"""Render synchronized dance layers/maps on owned copies; transfer to marvin only."""
import bpy,json,pathlib,subprocess,time,zipfile
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
ns=bpy.app.driver_namespace
if ns.get('ra_dance_export',{}).get('running'):raise RuntimeError('Dance export is already running')
scene=bpy.data.scenes['RA_Dance_Loops'];base=ns['ra_dance_base']
meshes=[scene.objects[name] for name in base]
root=pathlib.Path.home()/'Downloads/Marvin/Robot Alerts/robot-dances-v1'
marker=root/'.robot-alerts-owned'
if root.exists() and not marker.exists():raise RuntimeError('Export folder is not owned by this helper')
root.mkdir(parents=True,exist_ok=True);marker.write_text('Robot Alerts dances\n')
clips=[('dance-shuffle',1001),('dance-disco',1101),('dance-victory',1201)]
layers=['head','screen','torso','arm_l','arm_r','legs','chest','display_mask']
kinds=['high','low','normal','shade']
def group(obj):
    n=obj.name
    if 'screen_curved' in n:return 'screen'
    if 'chest_' in n:return 'chest'
    if 'head_v2' in n:return 'head'
    if any(x in n for x in ['leg_','boot_','Simple_hip_']):return 'legs'
    if any(x in n for x in ['arm_l','hand_l','Simple_shoulder_l']):return 'arm_l'
    if any(x in n for x in ['arm_r','hand_r','Simple_shoulder_r']):return 'arm_r'
    return 'torso'
def quad(obj):
    box=[Vector(v) for v in obj.bound_box];x0=min(v.x for v in box);x1=max(v.x for v in box)
    z0=min(v.z for v in box);z1=max(v.z for v in box);y=max(v.y for v in box)
    pts=[obj.matrix_world@Vector(p) for p in [(x0,y,z1),(x1,y,z1),(x1,y,z0),(x0,y,z0)]]
    projected=[world_to_camera_view(scene,scene.camera,p) for p in pts]
    normal=obj.matrix_world.to_3x3().inverted().transposed()@Vector((0,-1,0))
    return {'corners':[[round(p.x*1920,4),round((1-p.y)*1080,4)] for p in projected], 'visible':normal.dot(scene.camera.matrix_world.translation-pts[0])>0}
screen=next(o for o in meshes if 'screen_curved' in o.name)
chest=next(o for o in meshes if 'chest_display' in o.name)
for clip,start in clips:
    frames=[]
    for i in range(96):
        scene.frame_set(start+i);frames.append({'screen':quad(screen),'chestDisplay':quad(chest)})
    folder=root/clip;folder.mkdir(exist_ok=True)
    (folder/'metadata.json').write_text(json.dumps({'clip':clip,'fps':60,'width':1920,'height':1080,'layers':layers,'kinds':kinds,'origin':list(scene['ra_position_origin']),'span':list(scene['ra_position_span']),'frames':frames}))
tasks=[(clip,layer,i,start+i) for clip,start in clips for layer in layers+kinds for i in range(96)]
job={'running':True,'done':0,'total':len(tasks),'started':time.time(),'error':None,'transferred':[],'active':None}
ns['ra_dance_export']=job
scene.render.image_settings.compression=15
if bpy.context.screen.is_animation_playing:bpy.ops.screen.animation_cancel(restore_frame=False)
def restore():
    for obj in meshes:
        for i,mat in enumerate(base[obj.name]):obj.data.materials[i]=mat
    scene.view_settings.view_transform='AgX';scene.frame_set(1001)
def step():
    try:
        clip,layer,index,frame=tasks[job['done']]
        if job['active']!=layer:
            for obj in meshes:
                target=('chest_display' in obj.name) if layer=='display_mask' else group(obj)==layer
                for slot,mat in enumerate(base[obj.name]):
                    if layer in kinds:
                        exclude=any(x in obj.name for x in ['screen_curved','chest_base','chest_display'])
                        chosen=bpy.data.materials['RA_DanceMap_holdout' if exclude else 'RA_DanceMap_'+layer]
                    else:chosen=(bpy.data.materials['RA_Dance_WhiteMask'] if layer in ['screen','display_mask'] else mat) if target else bpy.data.materials['RA_DanceMap_holdout']
                    obj.data.materials[slot]=chosen
            scene.view_settings.view_transform='Raw' if layer in ['high','low','normal'] else 'AgX'
            job['active']=layer
        scene.frame_set(frame)
        dest=root/clip/layer/('frame_%04d.png'%(index+1));dest.parent.mkdir(exist_ok=True)
        scene.render.filepath=str(dest);bpy.ops.render.render(write_still=True,scene=scene.name)
        job['done']+=1
        if job['done']==len(tasks) or tasks[job['done']][0]!=clip:
            archive=root/(clip+'.zip')
            with zipfile.ZipFile(archive,'w',zipfile.ZIP_STORED) as z:
                z.write(root/clip/'metadata.json','metadata.json')
                for p in sorted((root/clip).glob('*/frame_*.png')):z.write(p,p.relative_to(root/clip))
            subprocess.run(['scp','-q','-o','BatchMode=yes',str(archive),'marvin@marvin:/home/marvin/uploads/robot-shots/'+archive.name],check=True,timeout=60)
            job['transferred'].append(clip)
        if job['done']==len(tasks):
            restore();job['running']=False;job['seconds']=round(time.time()-job['started'],2)
            path=root/'robot-dances.blend';bpy.data.libraries.write(str(path),{scene},compress=True)
            subprocess.run(['scp','-q','-o','BatchMode=yes',str(path),'marvin@marvin:/home/marvin/uploads/robot-shots/robot-dances.blend'],check=True,timeout=60)
            return None
        return .01
    except Exception as error:
        restore();job.update(running=False,error=str(error));print('Dance export stopped:',type(error).__name__,error);return None
bpy.app.timers.register(step,first_interval=.2)
print('Started',len(tasks),'dance layer/map renders; progress in ra_dance_export')
