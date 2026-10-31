"""Retain Blender exports and rebuild the cropped, synchronized motion atlases."""
from pathlib import Path
from zipfile import ZipFile, BadZipFile
from io import BytesIO
import json
import math
import shutil
import time
from PIL import Image

root = Path(__file__).resolve().parents[1]
output = root / "assets/robot/current-model-motion"
uploads = Path("/home/marvin/uploads/robot-shots")
reference = json.loads((root / "assets/robot/static-motion/final60/robot-static-60-rig.json").read_text())
layers = ["head", "screen", "torso", "arm_l", "arm_r", "legs", "chest", "display_mask"]
manifest = {"fps": 60, "width": 1920, "height": 1080, "layers": layers,
            "assetVersion": "joints-20261031", "clips": {}}
deadline = time.monotonic() + 1800
for clip, count in [("run-in", 108), ("idle", 60), ("run-out", 74)]:
    archive = output / ("robot-current-" + clip + ".zip")
    incoming = uploads / archive.name
    while not archive.exists():
        if incoming.exists():
            if incoming.is_symlink() or not incoming.is_file():
                raise ValueError("Unexpected export file type")
            # scp writes its file before it finishes; wait for a valid ZIP directory.
            try:
                with ZipFile(incoming) as probe:
                    if len(probe.infolist()) != count * len(layers):
                        raise ValueError("Unexpected export frame count")
                shutil.copyfile(incoming, archive)
            except OSError:
                pass
            except BadZipFile:
                pass
        if time.monotonic() > deadline:
            raise TimeoutError("Blender exports did not arrive within 30 minutes")
        if not archive.exists():
            time.sleep(2)
    frames = [{"screen": item["screen"], "chestDisplay": item["chestDisplay"],
               "layers": {}, "sheets": {}} for item in reference[clip]]
    if len(frames) != count:
        raise ValueError("Projection count mismatch")
    with ZipFile(archive) as source:
        for layer in layers:
            images = []
            for index, frame in enumerate(frames, 1):
                info = source.getinfo(f"{layer}/frame_{index:04d}.png")
                if info.file_size > 25_000_000:
                    raise ValueError("Unexpectedly large frame")
                image = Image.open(BytesIO(source.read(info)))
                if image.size != (1920, 1080):
                    raise ValueError("Frame dimensions mismatch")
                image = image.convert("RGBA")
                box = image.getchannel("A").getbbox()
                frame["layers"][layer] = list(box) if box else None
                if box:
                    images.append((index, image.crop(box)))
            if not images:
                continue
            width = max(image.width for _, image in images)
            height = max(image.height for _, image in images)
            columns = min(12, len(images))
            sheet = Image.new("RGBA", (width * columns, height * math.ceil(len(images) / columns)))
            for slot, (index, image) in enumerate(images):
                x, y = slot % columns * width, slot // columns * height
                sheet.paste(image, (x, y))
                frames[index - 1]["sheets"][layer] = [x, y, image.width, image.height]
            dest = output / "packed/sheets" / clip / (layer + ".png")
            dest.parent.mkdir(parents=True, exist_ok=True)
            sheet.save(dest)
    manifest["clips"][clip] = {"frames": frames}
    print("Packed", clip, count, "frames ×", len(layers), "layers", flush=True)
(output / "packed/manifest-sheets.json").write_text(json.dumps(manifest))
print("Updated motion atlases ready; no public files replaced yet.", flush=True)
