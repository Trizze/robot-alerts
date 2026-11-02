"""Retain Blender dance PNG sources, then append synchronized runtime atlases."""
from pathlib import Path
from zipfile import ZipFile, BadZipFile
from io import BytesIO
from PIL import Image
import json, math, shutil, time
ROOT=Path(__file__).resolve().parents[1]
KEEP=ROOT/'assets/robot/dances'; SOURCES=KEEP/'sources';SOURCES.mkdir(parents=True,exist_ok=True)
BASE=ROOT/'website-staging/overlay/static-motion-60';MAPS=ROOT/'website-staging/overlay/pattern-motion'
rig=json.loads((BASE/'manifest-sheets.json').read_text())
maps=json.loads((MAPS/'manifest.json').read_text())
clips=['dance-shuffle','dance-disco','dance-victory']; count=96
deadline=time.monotonic()+1200
for clip in clips:
    retained=SOURCES/(clip+'.zip');incoming=Path('/home/marvin/uploads/robot-shots')/(clip+'.zip')
    while not retained.exists():
        if incoming.is_file() and not incoming.is_symlink():
            try:
                with ZipFile(incoming) as z:
                    if len(z.infolist())!=count*12+1:raise ValueError('Unexpected frame count')
                shutil.copyfile(incoming,retained)
            except (BadZipFile,OSError):pass
        if time.monotonic()>deadline:raise TimeoutError('Dance exports did not arrive')
        if not retained.exists():time.sleep(2)
    with ZipFile(retained) as z:
        meta=json.loads(z.read('metadata.json'))
        if (meta['clip'],meta['fps'],meta['width'],meta['height'],len(meta['frames']))!=(clip,60,1920,1080,count):raise ValueError('Mismatched dance settings')
        if meta['layers']!=rig['layers'] or meta['kinds']!=maps['kinds']:raise ValueError('Mismatched layers')
        frames=[{**frame,'layers':{},'sheets':{}} for frame in meta['frames']]
        def read(layer,index):
            info=z.getinfo(f'{layer}/frame_{index+1:04d}.png')
            if info.file_size>25_000_000:raise ValueError('Unexpected render size')
            im=Image.open(BytesIO(z.read(info)))
            if im.size!=(1920,1080):raise ValueError('Wrong canvas')
            return im.convert('RGBA')
        for layer in rig['layers']:
            parts=[]
            for i in range(count):
                im=read(layer,i);box=im.getchannel('A').getbbox();frames[i]['layers'][layer]=list(box) if box else None
                parts.append(im.crop(box) if box else None)
            valid=[im for im in parts if im]
            if not valid:continue
            cw,ch=max(im.width for im in valid)+2,max(im.height for im in valid)+2
            sheet=Image.new('RGBA',(cw*12,ch*math.ceil(count/12)))
            for i,im in enumerate(parts):
                if im is None:continue
                x,y=i%12*cw+1,i//12*ch+1;sheet.paste(im,(x,y));frames[i]['sheets'][layer]=[x,y,im.width,im.height]
            dest=BASE/'sheets'/clip/(layer+'.png');dest.parent.mkdir(parents=True,exist_ok=True);sheet.save(dest,compress_level=9)
        rig['clips'][clip]={'frames':frames}
        boxes=[]
        for i in range(count):
            shade=read('shade',i).resize((960,540),Image.Resampling.NEAREST);boxes.append(shade.getchannel('A').getbbox())
        mf=[{'box':list(box) if box else None,'sheet':None} for box in boxes]
        cw=max(box[2]-box[0] for box in boxes if box)+2;ch=max(box[3]-box[1] for box in boxes if box)+2
        for kind in maps['kinds']:
            sheet=Image.new('RGBA',(cw*12,ch*math.ceil(count/12)))
            for i,box in enumerate(boxes):
                if box is None:continue
                im=read(kind,i).resize((960,540),Image.Resampling.NEAREST).crop(box)
                x,y=i%12*cw+1,i//12*ch+1;sheet.paste(im,(x,y));mf[i]['sheet']=[x,y,im.width,im.height]
            dest=MAPS/clip/(kind+'.png');dest.parent.mkdir(parents=True,exist_ok=True);sheet.save(dest,compress_level=9)
        maps['clips'][clip]={'frames':mf,'sheetSize':list(sheet.size),'origin':meta['origin'],'span':meta['span']}
        print('Packed',clip,flush=True)
corners=KEEP/'rig-corners.json'
if corners.exists():
    correction=json.loads(corners.read_text())
    for clip in clips:
        if len(correction[clip])!=count:raise ValueError('Wrong projection count')
        for frame,quad in zip(rig['clips'][clip]['frames'],correction[clip]):frame.update(quad)
rig['assetVersion']='joints-dances-20261102';maps['version']='patterns-dances-1'
(BASE/'manifest-sheets.json').write_text(json.dumps(rig,separators=(',',':')))
(MAPS/'manifest.json').write_text(json.dumps(maps,separators=(',',':')))
for clip in clips:shutil.copytree(BASE/'sheets'/clip,ROOT/'public/overlay/static-motion-60/sheets'/clip,dirs_exist_ok=True)
shutil.copyfile(BASE/'manifest-sheets.json',ROOT/'public/overlay/static-motion-60/manifest-sheets.json')
source=Path('/home/marvin/uploads/robot-shots/robot-dances.blend')
if source.is_file():shutil.copyfile(source,KEEP/'robot-dances.blend')
print('Dance atlases ready; old idle/run clips retained',flush=True)
