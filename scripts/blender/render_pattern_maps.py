"""Render paint-only rest-position, face-normal and lighting maps in an owned scene."""
import bpy
import json
import pathlib
import subprocess
import time
import zipfile

ns = bpy.app.driver_namespace
if ns.get('ra_pattern_export', {}).get('running'):
    raise RuntimeError('Pattern export already running')
scene = bpy.data.scenes['RA_PatternMaps']
meshes = [o for o in scene.objects if o.type == 'MESH' and not o.hide_render]
root = pathlib.Path.home() / 'Downloads/Marvin/Robot Alerts/robot-pattern-maps-v1'
root.mkdir(parents=True, exist_ok=True)
kinds = ['high', 'low', 'normal', 'shade']
clips = [('run-in', 801, 108), ('idle', 854, 60), ('run-out', 914, 74)]
proof = ns.get('ra_pattern_proof', True)
tasks = [('proof', kind, i, frame) for i, frame in enumerate([814, 838, 854]) for kind in kinds] if proof else [
    (clip, kind, i, start+i/2) for clip, start, count in clips for i in range(count) for kind in kinds]
job = {'running': True, 'done': 0, 'total': len(tasks), 'error': None, 'started': time.time()}
ns['ra_pattern_export'] = job
metadata = {'version': 'patterns-1', 'origin': list(scene['ra_position_origin']),
            'span': list(scene['ra_position_span']), 'width': 1920, 'height': 1080,
            'fps': 60, 'kinds': kinds}
(root/'metadata.json').write_text(json.dumps(metadata))

def step():
    try:
        clip, kind, index, frame = tasks[job['done']]
        mat = bpy.data.materials['RA_PatternMap_' + kind]
        hold = bpy.data.materials['RA_PatternMap_holdout']
        for obj in meshes:
            exclude = any(word in obj.name for word in ['screen_curved', 'chest_base', 'chest_display'])
            for slot in range(len(obj.data.materials)):
                obj.data.materials[slot] = hold if exclude else mat
        scene.view_settings.view_transform = 'AgX' if kind == 'shade' else 'Raw'
        scene.render.image_settings.color_depth = '8'
        scene.frame_set(int(frame), subframe=frame % 1)
        path = root/clip/kind/('frame_%04d.png' % (index+1))
        path.parent.mkdir(parents=True, exist_ok=True)
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True, scene=scene.name)
        job['done'] += 1
        if job['done'] == len(tasks) or tasks[job['done']][0] != clip:
            archive = root/('robot-pattern-' + clip + '.zip')
            with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
                z.write(root/'metadata.json', 'metadata.json')
                for png in sorted((root/clip).glob('*/frame_*.png')):
                    z.write(png, png.relative_to(root/clip))
            subprocess.run(['scp', '-q', '-o', 'BatchMode=yes', str(archive),
                            'marvin@marvin:/home/marvin/uploads/robot-shots/' + archive.name],
                           check=True, timeout=60)
        if job['done'] == len(tasks):
            job['running'] = False
            job['seconds'] = round(time.time()-job['started'], 2)
            return None
        return .01
    except Exception as failure:
        job.update(running=False, error=str(failure))
        print('Pattern export stopped:', type(failure).__name__, failure)
        return None

bpy.app.timers.register(step, first_interval=.2)
print('Started',len(tasks),'pattern-map renders; proof =',proof)
