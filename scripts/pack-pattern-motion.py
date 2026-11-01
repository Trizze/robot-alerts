"""Pack half-resolution data maps; never resample encoded coordinates linearly."""
from pathlib import Path
from io import BytesIO
from zipfile import ZipFile
from PIL import Image
import json
import math
import shutil

root = Path(__file__).resolve().parents[1]
retained = root / 'assets/robot/pattern-motion'
output = root / 'website-staging/overlay/pattern-motion'
retained.mkdir(parents=True, exist_ok=True)
output.mkdir(parents=True, exist_ok=True)
manifest = None
for clip, count in [('run-in', 108), ('idle', 60), ('run-out', 74)]:
    name = 'robot-pattern-' + clip + '.zip'
    archive = retained / name
    if not archive.exists():
        incoming = Path('/home/marvin/uploads/robot-shots') / name
        if incoming.is_symlink() or not incoming.is_file():
            raise ValueError('Expected regular Blender export')
        shutil.copyfile(incoming, archive)
    with ZipFile(archive) as z:
        meta = json.loads(z.read('metadata.json'))
        if manifest is None:
            manifest = {**meta, 'mapScale': 2, 'clips': {}}
        if len(z.infolist()) != count * 4 + 1:
            raise ValueError('Frame count mismatch')
        images = {kind: [] for kind in meta['kinds']}
        frames = []
        for index in range(count):
            decoded = {}
            for kind in meta['kinds']:
                data = z.read(f'{kind}/frame_{index+1:04d}.png')
                im = Image.open(BytesIO(data)).convert('RGBA')
                if im.size != (1920, 1080):
                    raise ValueError('Unexpected render dimensions')
                # Match coverage across all maps. Keep data lossless at sampled pixels.
                decoded[kind] = im.resize((960, 540), Image.Resampling.NEAREST)
            box = decoded['shade'].getchannel('A').getbbox()
            frames.append({'box': list(box) if box else None, 'sheet': None})
            for kind in meta['kinds']:
                images[kind].append(decoded[kind].crop(box) if box else None)
        valid = [im for im in images['shade'] if im]
        cw, ch = max(im.width for im in valid)+2, max(im.height for im in valid)+2
        columns = min(12, count)
        for kind, parts in images.items():
            sheet = Image.new('RGBA', (cw*columns, ch*math.ceil(count/columns)))
            for i, part in enumerate(parts):
                if part is None:
                    continue
                x, y = i % columns*cw+1, i//columns*ch+1
                sheet.paste(part, (x, y))
                frames[i]['sheet'] = [x, y, part.width, part.height]
            dest = output / clip / (kind+'.png')
            dest.parent.mkdir(parents=True, exist_ok=True)
            sheet.save(dest)
        manifest['clips'][clip] = {'frames': frames, 'sheetSize': list(sheet.size)}
        print('Packed', clip, count, 'frames', sheet.size, flush=True)
(output/'manifest.json').write_text(json.dumps(manifest, separators=(',', ':')))
print('Surface maps ready')
