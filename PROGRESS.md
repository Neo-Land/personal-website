# Neo character → website: progress

## Step 1: Blender ↔ Claude Code — DONE (2026-09-30)
- Using the OFFICIAL Blender Lab connector (not ahujasid/blender-mcp).
- MCP server registered (local scope for this folder):
  `claude mcp add blender -- uvx --from "git+https://projects.blender.org/lab/blender_mcp.git#subdirectory=mcp" blender-mcp`
- Blender add-on "MCP" 1.0.3 installed from lab.blender.org repo, listening on 127.0.0.1:9876.
- Blender prefs: Allow Online Access = on (required by add-on). Auto Start = off → start manually:
  Preferences → Add-ons → MCP ▸ → Start.
- Verified: scene shows Camera, Cube, Light.
- Official connector has NO AI 3D generation (no Rodin/Hunyuan) → Step 2 uses option b (Tripo/Meshy → Mixamo).
- Security: approve each execute_blender_code call individually; don't "always allow".

## Step 2: IN PROGRESS
- 2026-09-30: Blender connection re-verified (Camera, Cube, Light).
- neo_front/side/back.png cropped from ~/Downloads/neo2005avatarfull.jpeg (turnaround sheet, A-pose).
  Multi-Views in Tripo needs a paid plan; free = neo_front.png single-image.
- neofrontv2.jpeg = Gemini upscale of front view (848x1264) — best single-image input.
- Tripo free: H2.5 looked bad (face melted); H3.1 looked great but export needs paid plan.
  Hunyuan web (V3.1) gave no free credits. → User bought Tripo Pro 1 month ($14, renews $20/mo
  — CANCEL before ~2026-10-30 if not needed).
- 2026-09-30: neo_raw.zip unzipped → neo_raw/ (tripo_convert_*.fbx + .fbm textures; keep names, FBX finds .fbm by name).
  Imported in Blender: object tripo_node_3624771e, 1,977,884 faces, 0.98 m tall, faces -Y, feet at z=0,
  all 4 PBR maps load. Default Cube hidden (not deleted).
- neo_rawv2/ = Tripo H3.1 regen, Quad 50k (48,738 faces) → object tripo_node_79bb1eaf. USE THIS ONE.
  Old 2M mesh (tripo_node_3624771e) hidden in Blender, kept in neo_raw/ as backup.
- neo_mixamo.fbx (5.7 MB, textures embedded) exported for Mixamo.
- Mixamo rejected FBX + textured OBJ ("unable to map existing skeleton" = roughness/metallic maps).
  neo_mixamo_plain.obj (mesh only, no materials) worked.
- neo_rigged.fbx = Mixamo result: Armature (41 mixamorig bones, no animation) + mesh tripo_node_79bb1eaf.001.
  Came in at 1/100 size → Armature scaled to 0.977 m, feet z=0; tripo_mat_79bb1eaf reassigned (UVs match).
  Arm/head pose test deforms cleanly; pose reset.
- Scene saved: NehemiasDev/neo.blend. Hidden (kept): Cube, tripo_node_3624771e (2M), tripo_node_79bb1eaf (unrigged).

## Step 2: DONE (2026-09-30). Next: Step 3 (see brief).
- (old) Next: export H3.1 model (~50k polys if Retopo/polycount available, FBX, Blender preset, 2K)
  → NehemiasDev/neo_raw.fbx → Claude imports/checks in Blender → Mixamo.
- Plan: Tripo or Meshy multi-view → Mixamo (FBX Binary, With Skin) → FBX in this folder → import in Blender.
- Handoff doc with full Steps 2–6: the user's original pasted brief (re-paste if needed).

## Website vision (agreed 2026-09-30) — stop after beat 7 and verify
1. Black void, Neo walks in a circle in the center (three.js, Mixamo walk In Place + code-driven circle).
2. Footsteps make water-like ripples on the black floor (ripple spawned at foot contact).
3. Click Neo → he turns to face camera and idles (crossfade walk→idle).
4. Camera zooms to jeans pocket; generic flight ticket peeks out (3D ticket parented to hip bone).
5. Click ticket → it moves to center, tear line aligned with jean seam (seam marker placed in Blender).
6. Drag/swipe to tear ticket → white slit opens along seam (FAKED, agreed — no real seam geometry) → fills screen.
7. Bright white room, floating globe with clickable pins that zoom in (reuse globe.gl code from index.html, white bg).
Decisions: white-slit reveal OK; generic ticket; must work on phones (swipe to tear, tap instead of click).
Build order: beats 1–3 first as one working page.
neo_walk.fbx = Mixamo "Walking" (replaced Happy Walk; NOT in place → drift removed from Hips in Blender; 0.297 m/s used
  in code so feet don't slide). neo_idle.fbx = "Neutral Idle". Both actions on Armature in neo.blend.
neo.glb (7 MB) = mesh+textures+skin+anims [neo_idle, neo_walk]. Re-export from neo.blend if rig/anims change
  (keep all pose bones rotation_mode QUATERNION or glTF anims break).
## Beats 1–3: DONE (2026-09-30) → neo.html (three.js 0.170 via jsdelivr importmap). Serve: python3 -m http.server 8000
  (.claude/launch.json "site"), open /neo.html. index.html = old globe page (reuse for beat 7).
  Tested desktop + 375x812: circle walk, foot ripples, tap → face camera + idle + camera recenters.
  Knobs at top of neo.html: radius (0.8 desktop / 0.5 portrait), WALK_SPEED, RIPPLE_LIFE, FOOT_PLANTS.
  Ripples fire from FOOT_PLANTS (clip times where each foot stops swinging forward, measured in Blender:
  Right 0.08 s, Left 1.27 s). Re-measure if the walk clip changes — feet barely lift, height detection fails.
Next: beat 4 (ticket in pocket + zoom).
- 2026-09-30 arm fix: Mixamo "Without Skin" anim files rest in T-pose, Neo's rig rests in A-pose → relative
  rotations put arms ~56° too low (crossing body). Fix in neo.blend: legs/spine keep original keys; arm chain
  (Shoulder/Arm/ForeArm/Hand/fingers) re-baked via world-space Copy Rotation from the source FBX. Repeat this
  for ANY new Mixamo anim. Current "Walking" clip is itself lopsided (left foot ~0.32 m out, left hand drifting inward)
  — visible in the raw FBX skeleton too → needs a different/redownloaded walk.
- 2026-09-30 RULE: download every Mixamo anim WITH SKIN (rest pose then matches Neo's rig exactly → action
  transfers by bone name, no retarget). Without-Skin files rest in T-pose → arms cross body.
  neo_slow_walk.fbx (With Skin) → action neo_slow_walk (drift removed, 0.177 m/s in neo.html). Old walk files deleted.
  Note: this clip is hunched + slightly lopsided (left foot out) in Mixamo's own file — swap clip if unwanted.
  neo_idle.fbx now With Skin too (rest matches; hands stay at sides). Tap → idle verified in browser.
## Beats 4–5: DONE (2026-09-30), merged into ONE tap (user request)
  Tap walking Neo → turn to camera + idle (0.9 s) → slow camera push-in to the seam (3.2 s) → ticket slides up
  out of his right front pocket (1.4–2.2 s) → flies to the seam (2.2–3.6 s) → state 'ready' (waiting for tear).
  Ticket = canvas-drawn generic boarding pass (NEHEMIAS, EWR → ANY, NL 2005), two meshes split at the
  perforation (ticket.userData.main / .stub) for the beat-6 tear. HIDDEN while walking (visible from 1.2 s into
  the zoom); pull = one eased quadratic-Bezier arc from inside the leg → above the pocket → seam (1.2–3.8 s).
  Placement follows real skinned-mesh vertices (pocket; seam top/bottom = FLY_TOP/FLY_BOT, nearest vertex in bind
  pose) — NOT the hips bone: glTF bones load in a walk pose, bone-anchoring put it at belt level.
  Perforation runs exactly top→bottom of the seam (slight tilt = his idle stance). Camera framing: ticket = 60% width.
## Beat 6: DONE (2026-09-30) — tear + reveal
  In state ready a "Pull to tear ↓" hint shows. Drag any direction (touch or mouse): tear = drag / (0.45 × short
  screen side). Ticket halves hinge at the bottom of the perforation (V opens top-down); white lens "slit" grows
  down the seam from FLY_TOP, width with the tear. Release ≥ TEAR_COMMIT (0.6) → state opening (1.8 s): halves fall
  away, slit blooms, camera pushes in, #white overlay fades to opaque → state white. Release early → springs back.
## Beat 7: DONE (2026-09-30) — white room + globe (all in neo.html; index.html no longer needed for the flow)
  On full white: Neo renderer stopped, #room shown. globe.gl@2 (unpkg) lazy-loaded, prefetched at state ready.
  Globe = GLOBE_SIZE (0.62) of the short screen side via homeView() altitude; CSS bob + floor shadow; autoRotate.
  Pins = pointsData steel needles (PIN_HEIGHT 0.07) + htmlElements red heads (buttons, a11y labels). Tap pin →
  pointOfView altitude 0.55 (1.6 s) + card; × → back to homeView + autoRotate. PLACES = 5 placeholders (from old
  index.html) — user to supply real list ("tons of pins").
FLOW COMPLETE through beat 7. Possible next: real PLACES, pin detail pages, softer slit edge, landscape QA.
## Room v2 (2026-09-30): industrial loft replaces the plain white room
  neo_sit.fbx = Mixamo "Male Sitting Pose" (With Skin; cross-legged on the floor) → action neo_sit in neo.glb.
  On full white: buildLoft() (three.js, same renderer): canvas-drawn hardwood (tiles seamlessly, repeat 6),
  board-formed concrete walls w/ tie holes, dark ceiling, 4×4 steel window on the right wall + sun pool on the
  floor, sun DirectionalLight with shadows, hemisphere + front fill, blue PointLight at the globe. Neo is moved
  into the loft (0,0,0.15) facing camera, playing neo_sit, casting shadow. White overlay fades out (1.6 s).
  layoutRoom(): portrait = narrower room (half-width 1.25) + camera pulled back so the window stays visible.
  Globe overlay is positioned/sized by projecting GLOBE_AT (0,0.95,0) and GLOBE_R 0.33 through the loft camera
  (homeAltitude). Aura = CSS radial gradient (screen blend, pulsing) + globe.gl atmosphere #4d8dff.
## Room v3 (2026-09-30): brick loft after user's reference photo, moodier + warmer
  Exposed running-bond brick (canvas map + bump; BRICK_TILE 1.7 m), dark glossy hardwood (roughness .38,
  RoomEnvironment reflections at .16), dark brick ceiling w/ black steel beams, duct, pipe. Right wall = brick
  piers + sill + header with 3 tall steel-grid windows (BAYS), golden-hour city sky plane outside. Low amber sun
  (5, from outside right) casts real window/pier/mullion shadows → light streaks on floor + walls. Warm dim
  hemisphere .35, warm front fill .4, blue globe PointLight 2.6. Back wall/floor/ceiling end at the window wall.
  Phones: camera shifted left + turned toward the windows; globe overlay re-projected (updateMatrixWorld first).
  Surface texture (2026-09-30): pair() draws colour + bump canvases in lockstep. Brick bump: tilted uneven faces,
  ~30 pits/brick, chipped edges, gritty recessed mortar, fine sand grit (bumpScale 4). Wood bump: uneven boards,
  raised/sunk grain, recessed seams + ends, grit, faint scratches (bumpScale 1.6, roughness .42).
## Opening screen tweaks (2026-09-30)
  Camera pulled back: dist = max(3.8, (radius + 0.5) / halfW) → whole body in view all round the circle.
  #intro (TOP LEFT, mono, clamp(19px,3.4vw,36px), block + each letter fade in, blinking caret) types on load: Welcome, friend... / Benvenuto, amico... /
  Bienvenido, amigo... / ようこそ、友よ… → pause 1.8 s → backspaces → This is Nehemias / Questo è Nehemias /
  Este es Nehemias / こちらはネヘミアスです (stays). Lines carry lang attrs; a .sr paragraph holds the text for
  screen readers; reduced motion = instant. Fades out on the tap that starts the zoom. Edit GREETINGS to change.
  Opening camera lookAt y 0.75 so the walk circle sits low, clear of the greeting.
  Walk path is now an ELLIPSE (2026-09-30): rx × rz = 1.3 × 0.5 (landscape) / 0.75 × 0.35 (portrait), long
  left↔right. Angle advances by WALK_SPEED / |tangent| for constant ground speed; faces along the tangent.
  Camera dist = max(3.8, (rx + 0.45) / halfW).
## Portfolio layer (2026-09-30) — recruiter-friendly additions in neo.html
  SITE object (top of the module script, "YOUR CONTENT") drives everything: name, role, bio[], skills[],
  projects[{title, blurb, tags, live, code, image}], email, linkedin, github, resume, cta. Empty links are
  simply not shown. Currently PLACEHOLDERS (TODO) — waiting on the user's real info.
  UI: top-right menu Work · About · Contact (hidden during ticket zoom/tear, back in the loft); "Skip intro →"
  bottom-right on the opening screen → white flash → loft (waits for the model if still loading).
  Panel = native <dialog> (showModal: focus trap, Esc closes, click outside closes), slides in from the right,
  full-screen on phones. Head: title "Nehemias — Portfolio", description, Open Graph/Twitter tags (og:url +
  og:image commented until the domain is live), inline SVG "N" favicon. Phones: greeting moves under the menu.
Deploy TODO: rename neo.html → index.html (current index.html = old 2D globe page, archive it), host static
  (GitHub Pages / Netlify / Cloudflare Pages), point the domain, then fill og:url/og:image.
## Repo (2026-09-30)
  Private GitHub repo https://github.com/Neo-Land/personal-website (branch main). README.md = public-facing
  overview + pipeline + lessons; this file = dev log. .gitignore keeps neo.blend(.blend1) (75 MB), neo_raw/
  (61 MB) and failed Mixamo uploads out (no Git LFS). Screenshots in docs/.
## Deploy hardening (2026-09-30)
  Repo restructured: site lives in public/ (index.html + style.css + app.js split out of neo.html; neo.glb moved;
  old 2D page → archive/index-2d.html). Dependencies self-hosted + pinned from npm: three 0.170.0 (module + GLTFLoader,
  BufferGeometryUtils, RoomEnvironment), globe.gl 2.46.2 min, three-globe 2.45.3 earth textures; LICENSES.txt.
  public/_headers: CSP default-src 'none'; script-src 'self' + sha256 of the importmap; style-src 'self' 'unsafe-inline'
  (globe.gl injects CSS); img/connect/worker 'self' data:/blob:; frame-ancestors/base-uri/form-action/object-src none;
  HSTS 1y, nosniff, XFO DENY, no-referrer, Permissions-Policy lockdown, COOP/CORP same-origin; vendor/* immutable cache.
  Verified locally with a header-enforcing server (.claude/launch.json "site-strict" on :8010): full flow + loft/globe,
  zero external requests. Bug found+fixed during split: globe loader onload handler had been commented out.
  Hosting plan: Cloudflare Pages, Git-connected to the private repo, build output dir = public, no build command.
  Domain: nehemiaslandaverde.com (Namecheap) → Cloudflare nameservers + Pages custom domain (user does account steps).
  index.html: canonical + og:url/og:image (public/preview.jpg 1200×630 from the loft screenshot), name "Nehemias
  Landaverde" (from the domain — confirm with user). robots.txt + sitemap.xml added.
  Cloudflare: zone nehemiaslandaverde.com ACTIVE (NS dawn/kaiser.ns.cloudflare.com, Free plan, imported Namecheap
  parking/email records deleted, AI training bots blocked, search + agents allowed). Hosting via the new Workers
  static-assets flow (Pages is "legacy" in the dashboard): wrangler.jsonc → assets.directory ./public, no script;
  _headers applies. Validated with `npx wrangler deploy --dry-run`.
## LIVE (2026-10-01): https://nehemiaslandaverde.com (+ www) — Cloudflare Workers static assets, Git auto-deploy
  Custom domains via wrangler.jsonc routes (custom_domain: true) → Cloudflare created DNS + Let's Encrypt cert
  (covers apex + *.). workers_dev/preview_urls explicitly false (single address). Verified live: all security headers,
  TLS 1.0/1.1 refused, private files 404, zero third-party requests, full flow (walk → tap → ticket → tear → loft →
  pin card → Work panel) with no console errors. Cloudflare tried to inject its Web Analytics beacon; CSP blocked it.
  User TODO in dashboard: Always Use HTTPS (http currently 200), turn off Web Analytics/RUM auto-injection, DNSSEC
  (+ DS record at Namecheap), GitHub + Namecheap 2FA.
  Dashboard hardening done (2026-10-01): Always Use HTTPS ON (http → 301 https, apex + www); Minimum TLS 1.2
  (1.0/1.1 refused by server, 1.2 + 1.3 accepted, ECDHE-AES-GCM); DNSSEC ON — DS 2371 13 2 27C4CA69… at the
  .com registry, Google DNS returns 'ad'; HSTS left to our own header (not the dashboard toggle). Cert SAN covers
  apex + www. Dashboard "pending"/"not covered by certificate" labels were stale — live checks all pass.
## Loft sections, car corner, mechanic Neo (2026-10-02)
  Loft widened (roomHalf 2.8 desktop / 1.6 phone, BACK -3.4, 4th window bay). PS2-style fog/low-res was tried and reverted.
  car.glb (2.0 MB): Tripo coupe (car_raw/, gitignored) → car.blend; cabin flattened in Blender (verts above the beltline
  between windshield base and deck squashed 0.62 with smooth ramps; hood + wing untouched). Decimated 0.5, 1K JPEG
  textures. Scaled ×2.45 in app.js (model ~1 m long, Neo ~1 unit). Note: shape reads close to an RX-7 FD, no badges.
  mechanic.glb (2.5 MB): second Tripo outfit (mechanic_raw/, gitignored) rigged WITHOUT Mixamo — same proportions as
  Neo, so it was parented to Neo's Mixamo armature and skin weights copied from the rigged Neo mesh (Data Transfer,
  nearest-face interpolated; 0 unweighted verts). All Neo clips work on it. Custom action mech_wrench (2 s loop) keyframed
  in Blender via world-space bone rotations from the idle pose: folded at the hips, legs planted, right forearm twisting.
  mechanic.blend holds the rig + action. Placed at the car's front bumper leaning into the open engine bay.
  Sections: overview first; click a hanging sign or the thing itself (invisible hotspots: Neo/globe, car box) → camera
  flies 50% of the way to it (1.4 s), Back button / Esc returns. #room is pointer-events:none so clicks reach the canvas;
  the globe only takes input when it's the focused section (it used to capture the whole screen). Signs are comic
  bursts (SVG: seeded jagged star, halftone pattern, outlined Bangers lettering, feTurbulence grain), labels/colours in
  SECTIONS. Bangers self-hosted (vendor/fonts, @fontsource/bangers 5.3.0, OFL in LICENSES.txt) — CSP font-src 'self'.
## Lighter models, same look (2026-10-02)
  PS2-style test (3–5k tris, flat shading, 256 px matte textures) was tried on car + mechanic; user preferred the smooth
  look. Most of the weight was geometry, not textures, so all three models were re-exported with smooth decimation
  (scratchpad export_lean.py: decimate to a triangle budget, cap textures, JPEG; keeps only the armature-parented mesh
  from neo.blend): neo.glb 97k→30k tris, 7.0→3.9 MB (2K textures kept for the close-up zoom); car.glb 50k→14k,
  2.0→0.9 MB; mechanic.glb 45k→14k, 2.5→1.2 MB. Total 11.5→6.0 MB. Full flow re-verified (ticket still on the seam).
## Hobbies section: display case homage (2026-10-02)
  The Mask homage, deliberately not a replica: Tripo yellow zoot suit on a headless mannequin with a floating fedora
  (suit_raw/ → suit.blend → suit.glb, 93k→14k tris, 0.74 MB) and an ORIGINAL carved green wooden mask (mask_raw/ →
  mask.blend → mask.glb, 17k→6k tris, 512 px textures, 0.32 MB — already a hollow shell, no trimming). No movie
  prop, face, likeness or title used. buildCase(): steel plinth/lid/posts, 10% glass with env reflections, light strip
  + SpotLight from the lid, mask on a thin rod. Stands in front of the window wall, turned toward the camera
  (layoutRoom). Section 'case' → "Hobbies!" (green/yellow burst). DECOR list: non-clickable bursts shown only while
  their section is focused — "SMOKIN'!" on the case. Signs narrower on phones (min 112 px) so three fit.
## Hobby nook replaces the glass case (2026-10-02)
  User wanted it casual. suit_hung.blend: mannequin removed from the Tripo suit by sampling the base-colour texture per
  face (grey = low saturation → hands 0.40–0.50 m, neck 0.80–0.93) plus everything below 5.5 cm (base + shoes), tiny
  leftover islands dropped; hat (z > 0.88) split into its own object. Origins: suit = collar top (hook point), hat =
  brim bottom. suit.glb now holds two nodes 'suit' + 'hat' (12k + 6k tris, 0.81 MB). buildNook(): rolling steel rack
  with casters, wooden hanger, fedora tipped on the hook; wooden nightstand (drawer, brass knob) with a small warm lamp
  (PointLight); mask leaning back on top. Section id 'hobbies'. The globe overlay now fades out while another section
  is focused (#room.away) — it's HTML on top of the canvas, so it used to float over the nook/car on phones.
## Swashbuckler Neo in the hobby nook (2026-10-02)
  Third outfit (sword_raw/, an original black swashbuckler costume — homage, no film names/photos/likeness) rigged with
  scratchpad rig_outfit.py: same height as Neo, arms ~6° closer to the body, weights copied cleanly (0 unweighted).
  swordsman.blend: action sword_slouch (4 s breathing loop) keyframed via sit_pose.py — hips lowered onto a 0.25 seat and
  rolled back, thighs forward + splayed, boots out front, right hand by the thigh, left hand hanging at the chair side.
  An empty 'rapier_socket' is bone-parented to LeftHand at the palm; in app.js the code-built rapier (makeRapier: pommel,
  grip, cup guard, quillons, knuckle bow, tapered blade) is attached to it and aimed in the character's frame so the
  tip rests on the floor out front. Wooden chair built in code. swordsman.glb 92k→14k tris, 1.18 MB.
  Placement (layoutRoom): beside the rack on wide screens, in front of it on phones (narrow room hid him behind Neo).
  DECOR "AS YOU WISH!" (pink burst). Burst lettering now scales down for long phrases. Loft mixers → `mixers` array.
## Less stiff: hung sleeves + propped swordsman (2026-10-02)
  Suit sleeves: scratchpad suit_drop.py borrows Neo's skeleton for the suit (weights copied from Neo's mesh), swings
  both arms 24° down + 6° forward, bakes the shape (suit_posed.blend), then suit_strip.py re-strips → suit_hung.blend
  → suit.glb. Sleeves now hang straight down the jacket sides.
  Swordsman re-posed (sit_pose.py params): right arm hangs straight beside the chair; left hand forward at hip height
  resting on the rapier. app.js now aims the rapier from the palm's actual height so the tip always meets the floor.
## Detailed held rapier + sleeves off the torso (2026-10-02)
  Rapier now modelled in Blender (scratchpad rapier.py, ~4k tris): leather grip with brass wire wrap + ferrules, oval
  pommel + button, S-curved quillons with brass knobs, cup guard with brass rim/band, knuckle bow, swept side bars,
  side rings, rear counter-guard, ricasso, diamond-section blade. sit_pose.py curls his left index/thumb into a fist,
  turns the wrist (3 iterations) so the grip runs through the fist and the blade exits the pinky side toward a floor
  point, then parents the rapier to the LeftHand bone — exported inside swordsman.glb (1.37 MB). Code rapier removed;
  rapier materials get the room env map in app.js so the steel reads. Suit sleeves re-baked at 15° down / 9° forward
  so they hang beside the jacket instead of sinking into it.
## Phone layout of the hobby nook (2026-10-02)
  Phones now keep the desktop order (swordsman left of the rack, suit, nightstand + mask right): chair at nook-local
  (-0.92, 0.4), nook pushed back to z -2.1. Sections can define eye() — on phones the Hobbies camera comes in high
  (2.1) and from straight in front (5.2 back) so the seated Neo doesn't block it and all three fit the narrow screen.
  "AS YOU WISH!" now hangs above the swordsman's head (no overlap with "SMOKIN'!"). Mask scaled 0.21 → 0.16.
## Start prompt + signs kept on screen (2026-10-02)
  "Click Neo to begin" (or "Tap…" on touch screens, via hover:none) fades in 1.8 s after Neo starts walking and is
  removed on tap/skip (#start, styled like #hint, a bit larger). Section signs are clamped so their top never goes
  above 64 px (the menu) — on wide MacBook screens "About me!" used to be cut off at the top.
## Narrow-screen declutter (2026-10-05)
  Portrait screens (aspect < 1): the globe overlay is drawn at 55% size in the overview and grows to full size while
  flying into "About me" (globeK, lerped with the camera). Seated Neo + globe shift to x = -0.22 (GLOBE_AT is now
  adjusted in layoutRoom, with its hotspot + blue light) to open a gap; the hobby nook turns to run along the right
  wall (rotation -90°+0.6) so swordsman, suit and nightstand spread into depth, same left-to-right order. The phone
  Hobbies camera now comes from 60% of the way along the overview line, raised to 1.9. Wide screens unchanged.
## Domain hygiene (2026-10-05)
  External check: headers, HTTPS redirect, TLS 1.2/1.3 only, cert (Google Trust Services, renews automatically),
  DNSSEC, private files 404 — all good. Email spoofing locked down in Cloudflare DNS (no email on this domain):
  TXT @ "v=spf1 -all", TXT _dmarc "v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s", TXT *._domainkey "v=DKIM1; p=".
  Added public/.well-known/security.txt (RFC 9116) — Expires 2027-10-01, renew before then.
  Cloudflare Bot Fight Mode / AI Labyrinth left off on purpose (static site; BFM can challenge link-preview bots and
  its injected script would be blocked by our CSP).
  Email exposure trimmed: SITE.email in app.js is assembled from two parts at runtime (no "x@y" string for harvesters
  scanning the JS; the page HTML never contained it — the Contact section is rendered by JS). security.txt uses the
  tagged alias nehe.landav+security@gmail.com so any leak is traceable/filterable. resume.pdf keeps the real address.
