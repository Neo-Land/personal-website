# Nehemias — Personal Website

An interactive 3D portfolio. A rigged character ("Neo") walks an oval in a black void, every footstep rippling the floor. Tap anywhere and he bends down to pick up his hackathon-winner coin; flick it up and it shoots off like a shooting star whose streak splits the screen open into light, revealing a moody loft of worn plaster and navy brick where he sits beneath a glowing, pinned globe of places.

Built with **three.js**, **Blender**, **Mixamo**, **Tripo** (AI image-to-3D) — a static site (`public/`) with every dependency self-hosted.

| Opening | Loft |
|---|---|
| ![Opening](docs/1-opening.jpg) | ![Loft](docs/4-loft.jpg) |

## The experience

1. **Void** — black screen; Neo walks a long left↔right ellipse at a constant ground speed. Each foot plant drops a water-like ripple.
2. **Greeting** — top left, typed on load: *This is Nehemias* in English, Italian, Spanish and Japanese.
3. **One tap** — his hackathon-winner coin has been lying small at the centre of his walk all along; he walks over to it, turns to camera, bends down and picks it up (Mixamo "Lifting" + a palm-up hand turn keyed in Blender, `lift.glb`). The coin grows to full size as he lifts it and ends floating above his open palm, facing the camera.
4. **Flick** — drag up on the coin: it turns with your finger; let go and it flips off the top of the screen, leaving a blue shooting-star streak as stars fade in; the streak then splits open into white, slicing the screen in half. In the loft the same coin falls in with its trail and lands on the floor in front of him.
5. **Loft** — warm, moody loft: worn lime plaster chipped away to navy brick, a wooden ceiling, dark glossy hardwood, tall steel windows with a golden-hour skyline, real window shadows. Neo sits cross-legged under a floating globe with a pulsing blue aura; its pins poke out of the surface — tap one to zoom in and read its card.
6. **Portfolio layer** — always-available *Work · About · Contact* panel, plus *Skip intro →* for visitors in a hurry.

Works on phones (tap / swipe, narrower framing), respects `prefers-reduced-motion`, and the panel is a native `<dialog>` (focus trap, Esc to close).

## Run locally

Any static server works (the page fetches `neo.glb`, so `file://` won't):

```bash
python3 -m http.server 8000 --directory public
```

Then open <http://localhost:8000/>.

## Edit your content

Everything recruiters read lives in the `SITE` object near the top of the module script in [`public/app.js`](public/app.js): name, role, bio, skills, projects (`title`, `blurb`, `tags`, `live`, `code`, `image`), email, LinkedIn, GitHub and résumé. Empty links are hidden. Places on the globe are the `PLACES` list; the greeting is `GREETINGS`.

## Project structure

| Path | What it is |
|---|---|
| `public/` | **The deployed site — only this folder is published** |
| `public/index.html`, `style.css`, `app.js` | Markup, styles, and all scene/interaction code (three.js scenes, coin flip, loft, globe, portfolio panel) |
| `public/neo.glb` | Neo — 48.7k-face textured mesh, 41-bone Mixamo rig, animations `neo_slow_walk`, `neo_idle`, `neo_sit` |
| `public/vendor/` | Self-hosted, pinned three.js 0.170.0, meshopt decoder, earth textures (+ `LICENSES.txt`) |
| `public/_headers` | Security headers (CSP, HSTS, no framing, permissions lockdown), applied by Cloudflare |
| `wrangler.jsonc` | Cloudflare Workers config: serve `public/` as static assets (no server code) |
| `neo_rawv2/` | Tripo export the character was built from (FBX + PBR textures) |
| `neo_rigged.fbx` | Mixamo auto-rig of that mesh |
| `neo_slow_walk.fbx`, `neo_idle.fbx`, `neo_sit.fbx` | Mixamo animations (downloaded **With Skin**) |
| `neo_front.png`, `neo_side.png`, `neo_back.png`, `neofrontv2.jpeg` | Character reference images (`neofrontv2` = upscaled front used for generation) |
| `archive/index-2d.html` | Earlier 2D version of the jeans/ticket/globe idea (kept for reference) |
| `PROGRESS.md` | Detailed development log, decisions and gotchas |
| `docs/` | Screenshots |

## Asset pipeline

1. **Reference** — front/side/back turnaround of the character; front view upscaled to 848×1264.
2. **Image → 3D** — Tripo H3.1, *Quad* topology, 50k polycount, 4K PBR, *Remove Lighting* on.
3. **Rig** — mesh exported from Blender as a plain OBJ (no materials) → Mixamo auto-rigger (Standard skeleton).
4. **Animate** — Mixamo clips downloaded **With Skin**, actions extracted in Blender and attached to the rig; forward drift removed from the hips so walks play in place.
5. **Export** — Blender → `neo.glb` (mesh + textures + skin + 3 actions). Blender is driven from Claude Code through the official Blender MCP connector.

### Lessons learned (the non-obvious bits)

- **Mixamo "unable to map your existing skeleton"** on a mesh with no skeleton → caused by roughness/metallic textures. Upload the mesh only; reattach materials afterwards.
- **Mixamo animations must be downloaded *With Skin*.** *Without Skin* files rest in a T-pose while the rig rests in the uploaded A-pose, so every arm rotation lands ~56° off (arms cross the body).
- **Mixamo returned the rig at 1/100 scale** (OBJ metres read as centimetres) — rescale the armature in Blender.
- **glTF bones load in an animation pose**, not the rest pose — so the coin starts from a real skinned-mesh vertex (the pocket), not to the hips bone.
- **Footstep ripples** fire from the clip's measured foot-plant times; the slow walk barely lifts the feet, so height-based detection missed steps.
- **Blender 5 actions are layered** (`action.layers → strips → channelbags → fcurves`); the glTF exporter freezes bones whose rotation mode was switched away from quaternion.

## Security & privacy

- **Static only** — no server code, database, logins or forms: nothing on the site to break into.
- **No third-party requests** — three.js, the meshopt decoder and textures are self-hosted and version-pinned, so a hijacked CDN can't inject code.
- **Strict Content-Security-Policy** (`public/_headers`): scripts only from this origin plus the hashed import map; no framing (`frame-ancestors 'none'`), no plugins, no form posts, no `<base>` tricks. Inline *styles* are allowed only because globe.gl injects CSS at runtime.
- **HSTS, nosniff, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, locked-down `Permissions-Policy`, COOP/CORP same-origin.**
- **No cookies, analytics or trackers.** Only `public/` is deployed — source assets, dev log and git history are never served.
- If you edit the `<script type="importmap">` block, recompute its SHA-256 and update `script-src` in `_headers`, or the page won't run.

## Large files (not in the repo)

GitHub warns above 50 MB and Git LFS isn't set up, so these stay local:

- `neo.blend` (75 MB) — the working Blender scene (rig, actions, retarget bakes). Rebuildable from the FBX files above following [`PROGRESS.md`](PROGRESS.md).
- `neo_raw/` (61 MB) — first, 2M-face Tripo export (superseded by `neo_rawv2/`).

To version them later: `brew install git-lfs && git lfs install && git lfs track "*.blend"`.

## Roadmap

- [ ] Fill in `SITE` (bio, projects, links, résumé) and `PLACES`
- [ ] Deploy `public/` on Cloudflare (Workers static assets, Git-connected) at nehemiaslandaverde.com
- [ ] Add `og:url` / `og:image` (1200×630 screenshot) for link previews
- [ ] Optional: Draco-compress `neo.glb` for faster first load

## Model compression

Every `public/*.glb` is compressed with [glTF-Transform](https://gltf-transform.dev) (dev-time CLI only, never served):
textures re-encoded as WebP, animations resampled, then meshopt geometry/animation compression. The site decodes them
with the self-hosted `vendor/meshopt/meshopt_decoder.js` (`gltfLoader()` in `app.js`), which is why the CSP allows
`'wasm-unsafe-eval'`. Re-run after re-exporting a model from Blender:

```bash
npx @gltf-transform/cli@4 resample in.glb a.glb      # animated models only
npx @gltf-transform/cli@4 webp a.glb b.glb --quality 86
npx @gltf-transform/cli@4 meshopt b.glb public/out.glb --level medium
```

Gotcha: quantisation stores each mesh's dequantisation in its node transform, so don't overwrite a loaded node's
position/scale — wrap it in a `THREE.Group` and move that (see the suit and hat in `buildNook`).

