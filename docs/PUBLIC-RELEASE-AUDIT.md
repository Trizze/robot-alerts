# Public repository release audit

Audited 2 November 2026. Local commit: `071c06eb676c4ef48ea94506d5ae2efc767f1c6f`.
Repository: https://github.com/Trizze/robot-alerts (currently private).

## Release update — 2026-11-02

The owner ran the private historical scan and reported **no candidates**, then explicitly instructed making the repository public first. Visibility is now public. Current tests: 140 application / 57 shared-service, zero failures. README and asset modification credits updated. Background redistribution provenance and a fresh online advisory lookup remain unresolved limitations; this is not a guarantee against unknown vulnerabilities. The findings below record the earlier audit state.

## Original decision

**Do not switch the repository to public yet.** No confirmed credential leak was found, but this audit cannot certify the history as secret-free. Complete the owner-run history scan and resolve the demo background's redistribution rights first. Fix the submission documentation and publish the current tested commits before handing the repository to judges.

The official [hackathon rules](https://twitchcon-codex.devpost.com/rules) allow a public or private repository. A private submission must give the judges access; the local brief specifies `testing@devpost.com`. Keeping it private is an available submission route, but does not remove licensing or runnable-source requirements.

No visibility changes, pushes, history rewrites, deployments or application changes were made during this audit. This report is an audit artifact, not a release approval.

## Findings, in priority order

1. **Full historical secret-content clearance is incomplete.** A filename audit of all 66 reachable commits found no committed credential or database filenames. Both `.env.example` files have empty configuration values. However, filenames cannot detect a credential pasted into an ordinary source file. Automatic approval review rejected the proposed redacted historical content scan because it could read credential contents contrary to the owner's no-secrets instruction. It did not run. The owner must perform a private scan before public release. If a real credential is found, revoke/rotate it first and assess history cleanup; deleting only the latest copy is insufficient.

2. **Demo background permission is unverified.** `CREDITS.md` identifies the image only as owner-supplied `background for robot alerts.png`, cropped/compressed for the demo. That is not evidence of permission to redistribute it or use it in the submission. Confirm ownership/license and document the source, or replace/remove the image and affected demo media. Assess historical copies too if redistribution is not allowed. This audit does not assert infringement; permission remains an unanswered question.

3. **GitHub does not contain the tested current project.** Its `master` is `1562feea850c9fd3fd15777d835033f57ffd8c5f`; local `master` is 61 commits ahead. Making GitHub public immediately would expose the older version. After clearance, push the intended current commits and verify the submission link and clean clone. There are hundreds of existing untracked research/render artifacts: do not use `git add .` to collect them indiscriminately.

4. **README capability claims are substantially stale.** It says the hosted picker is disconnected, shared login/cross-channel points are undeployed and the overlay cannot use website patterns/chest images. These statements conflict with the current implementation and recorded hosted testing. Update it with the current hosted/local distinction, actual setup instructions and remaining limitations. Do not claim real paid-event or cross-channel live verification that has not occurred.

5. **Asset credit documentation needs finishing.** The door credit still describes a planned entrance and promises to document later changes; describe the actual scaling, orientation, animation and split foreground rendering. `docs/devpost-credits.md` lists the monitor and emotes but omits the door and material libraries. Complete it before submission, including the background once rights are known.

6. **Fresh online dependency advisory results are unavailable.** `npm audit` was blocked by automatic approval review because sending dependency metadata to `registry.npmjs.org` was outside the permitted network scope. The offline audit reports zero vulnerabilities, but is not a current advisory clearance. A permission request for dependency names/versions only remains pending. This is an audit limitation, not evidence of an exploitable dependency.

7. **No root code license is selected.** This does not prevent a public repository or the submission: public and open source are different permissions. Without a license, ordinary copyright restrictions remain, alongside GitHub's viewing/forking terms. If reuse is intended, the owner should choose a license for original code and explicitly preserve separate third-party asset/Twitch terms. Do not automatically label the whole repository MIT. [GitHub licensing guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository).

## Checks that passed

- `npm test`: **126 passed, zero failed**. Repeated successfully from an archive of tracked HEAD with no local data or credentials.
- `node --test shared-service/test/*.test.js`: **48 passed, zero failed**.
- A tracked-only checkout installed the three locked npm packages from the offline cache with install scripts disabled. The normal startup script also handles dependency installation for a fresh installation.
- An isolated demo on port 3299 served settings successfully and rendered the layered robot in a fresh browser playback with no browser errors or Twitch credentials. Its temporary process was stopped; the live app on 3210 was not changed.
- All 66 reachable commits were included in filename-history inspection; the repository is not shallow. No tracked secret/database filenames, tracked symlinks, tags, submodules or Git LFS configuration were found.
- `.gitignore` covers `.env`, `*.env`, `secrets*`, `*.pem`, `*.key`, runtime data, SQLite and node_modules. The service Docker context uses an allowlist and excludes runtime secrets/data.
- The current tracked tree has 3,340 files, approximately 173.3 MiB. The largest is approximately 4.4 MB; no tracked file approaches GitHub's 100 MiB per-file limit.
- GitHub had no releases, issues, pull requests, discussions or Actions runs to separately audit; Pages and Wiki were disabled at inspection.
- All 58 active catalog patterns have matching image files and credit entries.

## Third-party assets

- **Jampre CRT monitor and witnessk door:** retained CC BY 4.0 license files and user-provided source attribution. Redistribution/adaptation is permitted subject to attribution and modification notices. The door modification notice needs updating. Sketchfab pages could not be freshly fetched, so these findings rely on the supplied licenses and retained provenance.
- **Poly Haven textures:** official [CC0 license](https://polyhaven.com/license) permits redistribution.
- **Meshy free textures:** the official [texture library](https://www.meshy.ai/textures) and [Black Marquina page](https://www.meshy.ai/textures/marble/black-marquina-marble) identify CC0 availability. Preserve source records.
- **Lowbit/Willosuna sample packs:** their [published](https://lowbitlab.itch.io/seamless-pixel-textures-vol-2) [terms](https://willosuna.itch.io/stylized-textures-lite) restrict standalone/extractable redistribution. No matching source filenames were found in current or historical Git paths. The Blender checks below found no packed textures. This is evidence about inspected files, not a guarantee against renamed content.
- **Three.js:** its vendored MIT license is retained.
- **Twitch avatars/emotes:** retained credits point to Twitch sources and developer terms. These are not project-owned CC0 materials and must not be relicensed with the code. The current neutral examples do not erase earlier versions from history.
- **Background:** unresolved as described above.

Two tracked Blender files were inspected structurally, without reading embedded image/script payloads. Neither contained packed textures, text-script blocks or linked Blender libraries. The older source had one unpacked image reference; the motion source had none. Robot GLB JSON metadata contained no embedded images; the door GLB contained two images belonging to that licensed asset. The original monitor ZIP directory contained one FBX. These are structural checks, not a complete binary security/content scan.

## Private owner-run check

A read-only helper is available at `/tmp/robot-private-release-scan.py`. Run it yourself in your private SSH terminal:

```sh
cd /home/marvin/robot-alerts
python3 /tmp/robot-private-release-scan.py
```

Type `SCAN` when prompted. It performs an offline heuristic scan of reachable Git text history and prints only candidate paths, line numbers, rules and blob IDs; never credential values or source excerpts. Secret-looking filenames are flagged without opening their contents. Binary content is skipped. The helper was tested only with synthetic inputs; the assistant has not run it against repository contents. It is not a complete guarantee or a substitute for reviewing candidates privately. Tell the assistant only whether it passed or how many candidates require review; never paste credentials. The `/tmp` copy is temporary, and a copy is sent with this report.

## Remaining verification limits

No secret files, production environment, OAuth tokens, encryption keys or live databases were opened. The full historical text secret scan and fresh online advisory lookup remain incomplete. No paid Twitch event was triggered. Portable browser QA currently depends on externally installed Playwright/Chromium paths, although the normal Node test suites and credential-free demo work. This is a public-release audit, not a penetration test or a warranty that every possible renamed/encoded asset or secret was detected.

## Release sequence

1. Owner privately scans history and resolves any genuine credential findings.
2. Confirm background redistribution rights, or replace/remove affected copies and media.
3. Update README, door modification credit and complete submission credits; decide code licensing if desired.
4. Complete the fresh dependency advisory check if authorized; resolve material findings.
5. Stage only intended files, push the cleared current commits and verify a clean clone and submission link.
6. Switch visibility only after those checks, or use the permitted private-repository judging route. Preserve submitted artifacts after the deadline as required by the rules.
