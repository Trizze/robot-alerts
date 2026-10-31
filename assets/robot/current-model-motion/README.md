# Revised-joint motion — 2026-10-31

Runtime revision: `joints-20261031`. The newer joints were previously present
in the picker model but absent from the alert animation sheets. This refresh
uses the approved `RA_Joint_Study` geometry and the original camera/actions,
copied into a separate `RA_CurrentRobot_Motion` scene.

All 1,936 layer frames were rerendered at 1920×1080. Output is 60 fps:

| Clip | Source frames, sampled every 0.5 frame | Output frames |
| --- | --- | --- |
| run-in | 801–854.5 | 108 |
| idle | 854–883.5 | 60 |
| run-out | 914–950.5 | 74 |

The eight layers are head, screen, torso, arm_l, arm_r, legs, chest and
display_mask. Non-target parts are holdouts. Profile pictures are drawn in
the browser; no viewer portrait is baked into these assets. Projection samples
matched the previous export within 0.001 px. New crop/sheet coordinates were
packed from the revised renders.

The prepare/render helpers are in `scripts/blender/`; the atlas packer is
`scripts/pack-current-motion.py`. Raw PNG ZIPs and review outputs remain local
in this directory. Runtime sheets are committed in the local and hosted
overlay folders. Original source meshes were not edited.

Fresh playback, joint appearance, profile compositing, chest readability and
exit cleanup were inspected. The deployed arm atlas byte-matches the verified
local file. Both regression suites pass (97 overall, 29 shared-service).

The separate `.blend` source-file export/transfer was blocked by automatic
approval review. No `.blend` from that attempt was copied into this repository.
