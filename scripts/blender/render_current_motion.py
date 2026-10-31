"""Render revised-joint layers on a separate scene, using the approved motion."""
import bpy
import pathlib
import subprocess
import time
import zipfile

namespace = bpy.app.driver_namespace
previous = namespace.get("ra_current_export")
if previous and previous.get("running"):
    print("Render already running:", previous["done"], "/", previous["total"])
else:
    scene = bpy.data.scenes.get("RA_CurrentRobot_Motion") or bpy.data.scenes["RA_CurrentRobot_Source"]
    base = namespace["ra_current_base_materials"]
    group = namespace["ra_current_layer_group"]
    meshes = [obj for obj in scene.objects if obj.name in base]
    hold = bpy.data.materials["RA_Current_Holdout"]
    white = bpy.data.materials["RA_Current_Mask"]
    root = pathlib.Path.home() / "Downloads/Marvin/Robot Alerts/robot-current-motion-20261031"
    marker = root / ".robot-alerts-owned"
    if root.exists() and not marker.exists():
        raise RuntimeError("Output folder is not owned by this render helper")
    root.mkdir(parents=True, exist_ok=True)
    marker.write_text("Robot Alerts revised-joint render\n")
    clips = [("run-in", 801, 108), ("idle", 854, 60), ("run-out", 914, 74)]
    layers = ["head", "screen", "torso", "arm_l", "arm_r", "legs", "chest", "display_mask"]
    tasks = [(clip, layer, index, start + index / 2)
             for clip, start, count in clips for layer in layers for index in range(count)]
    job = {"running": True, "done": 0, "total": len(tasks), "started": time.time(),
           "error": None, "transferred": [], "root": str(root), "active_layer": None}
    namespace["ra_current_export"] = job
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True

    def restore():
        for obj in meshes:
            for index, material in enumerate(base[obj.name]):
                obj.data.materials[index] = material
        scene.frame_set(854)

    def step():
        try:
            clip, layer, index, frame = tasks[job["done"]]
            if job["active_layer"] != layer:
                for obj in meshes:
                    target = "chest_display" in obj.name if layer == "display_mask" else group(obj) == layer
                    for slot, material in enumerate(base[obj.name]):
                        obj.data.materials[slot] = (white if layer in ["screen", "display_mask"] else material) if target else hold
                job["active_layer"] = layer
            scene.frame_set(int(frame), subframe=frame % 1)
            path = root / clip / layer / ("frame_%04d.png" % (index + 1))
            path.parent.mkdir(parents=True, exist_ok=True)
            scene.render.filepath = str(path)
            bpy.ops.render.render(write_still=True, scene=scene.name)
            job["done"] += 1
            if job["done"] == len(tasks) or tasks[job["done"]][0] != clip:
                archive = root / ("robot-current-" + clip + ".zip")
                with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as output:
                    for png in sorted((root / clip).glob("*/frame_*.png")):
                        output.write(png, png.relative_to(root / clip))
                subprocess.run(["scp", "-q", "-o", "BatchMode=yes", str(archive),
                                "marvin@marvin:/home/marvin/uploads/robot-shots/" + archive.name],
                               check=True, timeout=60)
                job["transferred"].append(clip)
            if job["done"] == len(tasks):
                restore()
                job["running"] = False
                job["seconds"] = round(time.time() - job["started"], 2)
                return None
            return 0.01
        except Exception as failure:
            restore()
            job["running"] = False
            job["error"] = str(failure)
            print("Robot render stopped:", type(failure).__name__, failure)
            return None

    bpy.app.timers.register(step, first_interval=0.2)
    print("Started", len(tasks), "layer renders; progress is in ra_current_export")
