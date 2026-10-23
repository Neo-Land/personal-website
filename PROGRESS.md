# Build log

How [nehemiaslandaverde.com](https://nehemiaslandaverde.com) was built, in order: what was tried, what stuck, what
was cut and why, and the gotchas worth remembering. Written as the work happened (Sept 29 – Oct 2026), condensed
for reading. The [README](README.md) has the overview.

**Contents:** [Character](#1-the-character-sept-30) · [Intro](#2-the-intro-sept-30) ·
[Loft](#3-the-loft-sept-30) · [Shipping it](#4-shipping-it-sept-30--oct-1) ·
[Sections](#5-loft-sections-and-outfit-characters-oct-2) · [Performance](#6-performance-oct-2--oct-5) ·
[Coin flip](#7-the-coin-flip-oct-5) · [Polish](#8-polish-oct-5--oct-6) · [Restyle](#9-loft-restyle-oct-6) ·
[Résumé](#10-the-résumé-campfire-oct-8) · [Bugs](#11-bugs-found-later) ·
[Rooftop](#12-the-rooftop-oct-22--oct-23)

---

## 1. The character (Sept 30)

**Goal:** a 3D version of my avatar, rigged and animated, light enough for a web page.

- **Reference:** a front/side/back turnaround sheet of the avatar in an A-pose. The front view was upscaled to
  848×1264, which turned out to be the best single-image input.
- **Image → 3D:** tried Tripo H2.5 (the face melted), Hunyuan (no free credits to test with) and Tripo H3.1, which looked right.
  Regenerated with *Quad* topology at 50k polygons instead of the first 2-million-face export.
- **Rigging:** Mixamo's auto-rigger rejected the textured mesh ("unable to map your existing skeleton"). The cause
  was the roughness/metallic maps: uploading the bare mesh worked, and the materials were reattached in Blender.
  The rig came back at 1/100 scale and was rescaled.
- **Animation:** Mixamo walk, idle and sitting clips. Two rules learned the hard way:
  - Download clips **With Skin**. Without it they rest in a T-pose while the rig rests in an A-pose, so every arm
    rotation lands about 56° off and the arms cross the body.
  - Walks must play in place: forward drift was removed from the hips in Blender, and the code moves him at the
    clip's real ground speed (0.177 m/s) so the feet don't slide.
- **Blender ↔ Claude Code:** Blender was driven through the official Blender MCP connector (each script approved
  individually), or headless from the command line with a Python script.
- **Export:** one `neo.glb` with mesh, textures, skin and actions. All pose bones stay in quaternion rotation mode,
  or the glTF exporter freezes them.

## 2. The intro (Sept 30)

- **The void:** a black floor where Neo walks a long left-to-right ellipse at a constant ground speed (the angle
  advances by speed ÷ tangent length), always facing his direction of travel.
- **Footstep ripples:** water-like rings spawn at each foot plant. Plant times were measured from the clip in
  Blender (right 0.08 s, left 1.27 s), because this walk barely lifts its feet and height-based detection missed
  steps.
- **Greeting:** typed top-left on load in English, Italian, Spanish and Japanese, with a blinking caret. Each line
  carries a `lang` attribute, a hidden paragraph holds the text for screen readers, and reduced motion shows it
  instantly.
- **First intro concept:** tapping Neo pulled a boarding pass from his pocket that you tore open into white light.
  It worked, but it didn't suit a professional portfolio, and it was replaced by the coin flip (section 7).

## 3. The loft (Sept 30)

The intro opens into a room where the portfolio lives.

- **v1:** a plain white room with a floating globe (globe.gl).
- **v2:** an industrial loft: canvas-drawn hardwood, concrete walls, a steel window, a sun light with real shadows.
- **v3:** a moody brick loft after a reference photo. Running-bond brick and dark glossy hardwood, drawn in code: a
  colour canvas and a bump canvas drawn in lockstep, so each brick gets tilted faces, pits, chipped edges and
  recessed mortar, and the floor gets uneven boards, raised grain and scratches. Three tall steel-grid windows with a
  golden-hour skyline outside; a low amber sun throws window, pier and mullion shadows across the floor and walls.
- **Phones:** a narrower room, and the camera turns toward the windows so they stay in view.
- **Portfolio layer:** a *Work · About · Contact* menu opens a native `<dialog>` panel (focus trap, Esc to close,
  full-screen on phones), all driven by one `SITE` object in `app.js`. *Skip intro →* goes straight to the loft.

## 4. Shipping it (Sept 30 – Oct 1)

- **Restructure:** the site moved into `public/` (only that folder is served); markup, styles and code split apart.
- **No CDNs:** three.js and every other dependency self-hosted and version-pinned, with their licences.
- **Security headers** (`public/_headers`): a Content-Security-Policy of `default-src 'none'` with scripts only from
  this origin plus the import map allowed by its SHA-256 hash; no framing, plugins, form posts or `<base>`; HSTS,
  nosniff, no referrer, a locked-down Permissions-Policy, COOP/CORP same-origin. Verified with a local server that
  enforces the same headers: the full flow ran with zero external requests.
- **Hosting:** Cloudflare Workers static assets, auto-deployed on every push to `main`; the domain moved from
  Namecheap to Cloudflare nameservers. The `workers.dev` and preview URLs are switched off, so the site has one
  address.
- **Live on Oct 1.** Hardening after launch: HTTP → HTTPS redirects, TLS 1.2 minimum (1.0/1.1 refused), DNSSEC with
  the DS record at the registry, 2FA on every account. Cloudflare tried to inject its analytics beacon; the CSP
  blocked it, and it was turned off.
- **Link previews and SEO:** canonical URL, Open Graph image, `robots.txt`, `sitemap.xml`.

## 5. Loft sections and outfit characters (Oct 2)

- **Sections:** the loft became a set of places. Click a hanging comic-book sign (or the thing itself, via
  invisible hotspots) and the camera flies in; Back or Esc returns. The signs are SVG bursts drawn in code: a seeded
  jagged star, a halftone pattern, outlined Bangers lettering (self-hosted font) and a grain filter.
- **Projects corner:** a Tripo sports car with its cabin flattened in Blender, and a mechanic Neo leaning into the
  engine bay.
- **Outfit characters without Mixamo:** the mechanic outfit has Neo's proportions, so it was parented to Neo's own
  skeleton with skin weights copied from his mesh (0 unweighted vertices). All of Neo's clips work on it, plus a
  custom wrench-turning loop keyframed in Blender.
- **Hobbies corner** (later replaced by the résumé): a yellow zoot suit and an original carved mask (an homage, not
  a replica) on a code-built coat tree, and a swashbuckler Neo slouched in a chair:
  - The swashbuckler outfit was rigged the same way as the mechanic, with a 4-second breathing loop posed by script.
  - His rapier was modelled in Blender (leather grip with wire wrap, cup guard, knuckle bow, diamond-section blade)
    and parented to his hand bone, after the fingers were curled into a fist and the wrist turned so the blade runs
    through it.
  - The suit's sleeves were posed by borrowing Neo's skeleton, swinging the arms down and baking the shape.
- **Open sections stand alone:** while one is open, the others' props fade out (each material's opacity is scaled,
  originals kept), so nothing peeks into its view.
- **Art direction:** a PS2-era low-poly look (3–5k triangles, flat shading) was tested on the car and mechanic.
  The smooth, detailed look won; the rule became "keep models smooth, just export them lean".

## 6. Performance (Oct 2 – Oct 5)

- **Decimation:** smooth decimation to a triangle budget per model (Neo 97k → 30k, props and outfits about 14k),
  capped textures. 11.5 MB → 6.0 MB.
- **Compression:** glTF-Transform: WebP textures, resampled animations, meshopt geometry compression. 9.7 MB →
  4.3 MB total (Neo 3.9 → 1.5 MB). Cloudflare doesn't compress `.glb`, so this is the real download. The meshopt
  decoder is self-hosted, so the CSP allows `'wasm-unsafe-eval'` (WebAssembly only, no JS `eval`).
- **One renderer:** globe.gl (1.9 MB, with its own bundled copy of three.js and a second WebGL context) was replaced
  by a globe built directly in the loft scene: an Earth sphere with day map and bump, five pins with tap targets,
  drag to spin, a tap that turns the picked pin to face you, and an additive aura sprite. Keyboard and screen-reader
  users get hidden buttons for the pins. With globe.gl gone, the CSP no longer needs inline styles.
- **Load early:** the loft's models and textures start downloading when you tap Neo, so they arrive while he picks
  up the coin.
- **Render on demand:** full frame rate only while something moves (camera flights, fades, the coin landing, the
  globe); 30 fps for idle loops; nothing at all while the portfolio panel covers the room. The intro scene is
  disposed once the loft is built.
- **Smaller wins:** the signs' bob animation was removed (the grain filter re-rasterised every frame); a hover
  jitter was traced to changing the animation's duration, which re-maps its phase mid-cycle; Earth textures went to
  WebP (1.46 → 0.70 MB).

## 7. The coin flip (Oct 5)

The intro's centrepiece: Neo's hackathon coin.

- **The coin:** a Tripo model, decimated and compressed (0.5 MB), small and flat at the centre of his walk from the
  start.
- **Pickup:** tap → he walks to the spot facing the camera with the coin by his right foot, then plays Mixamo's
  "Lifting" (retargeted by bone name). A palm-up turn was keyframed in Blender on the hand bone only: the right angle
  (95.4°) was measured from the finger curl, after a first attempt that also turned the forearm over-twisted the
  wrist. The coin grows and turns to face the camera as he lifts it, then floats above his open palm.
- **Flick:** drag up and the coin turns with your finger; let go and it flips off the top of the screen with a
  ribbon trail as stars fade in. The streak then widens into a white band that splits the screen open.
- **Landing:** in the loft the same coin falls in with its trail, bounces once and lands in front of seated Neo. Its
  materials switch from the intro's studio lighting to the loft's, so it picks up the warm light, the window shadows
  and the globe's blue glow.

## 8. Polish (Oct 5 – Oct 6)

- **Smooth entry:** the white used to start fading the moment the loft was created, and the black canvas flashed
  through while shaders compiled. Now the white holds until the models are in, `compileAsync` has finished and two
  frames have been drawn, then fades straight into the room.
- **Start prompt:** "Click Neo to begin" was ambiguous (the text, or the walking character?) and Neo is a small
  moving target on phones. Now it's "Click anywhere to begin".
- **Domain hygiene:** the domain sends no email, so it's locked against spoofing (SPF `-all`, DMARC reject, an empty
  DKIM key). A `security.txt` (RFC 9116) uses a tagged email alias; the page's email is assembled at runtime, so
  harvesters scanning the code don't find it; the public résumé has no phone number. A Cloudflare firewall rule
  blocks bots probing for `.env`, `.git` and WordPress paths (about a third of all traffic).
- **Site icon:** an original denim-textured star in Neo's jeans colours, generated from one SVG into the favicon,
  PNG and home-screen icon.
- **Link preview:** a 1200×630 image of the coin intro with name and tagline.
- **Narrow screens:** the globe shrinks in the overview and grows as you fly in; the seated Neo and globe shift left
  to open a gap for the other corner.

## 9. Loft restyle (Oct 6)

- **Exploration:** three restyles inspired by reference photos, all drawn in code so they'd add no download: worn
  plaster, plaster with an arched art ledge, plaster with blue glazed tile.
- **Chosen:** worn lime plaster chipped away to navy brick. The plaster is a 2048 px canvas spanning 2×2 brick tiles
  (so it repeats every 3.4 m): mottled colour, hairline cracks, and ragged patches where the brick shows, sunk in the
  bump map with a shadowed lip. The wear is randomised on every visit. The brick became worn navy (ink-dark,
  sun-faded slate, some with chalky white bloom), and the ceiling and beams became warm wood.
- **Cut:** an arched hallway in the back wall leading to a landscape view. It went through a code-painted mountain
  scene, then a personal photo cut into parallax depth layers, before the solid wall won.

## 10. The résumé campfire (Oct 8)

- **The idea:** the hobbies corner became "Résumé!": a small campfire (crossed logs, a ring of stones, flickering
  additive flames, a warm point light) with the résumé page floating above it.
- **Iterations:** first a cyan hologram (scanlines, a rolling bright band, a glowing edge); then a solid page that
  opened the PDF in a new tab; finally a half-transparent page that you open in-scene. "Open résumé" flies the
  camera square-on to the page, sized to fill the screen, and the page fades to solid and stops bobbing. Only
  "Download" downloads.
- **The file:** renamed to `Nehemias-Landaverde-Resume.pdf` so it's findable in a recruiter's Downloads folder. The
  file itself was renamed, not just the download hint, because iOS Safari ignores the hint. The old `/resume.pdf`
  redirects to it.
- **Updating it:** the floating page is an image of the PDF. Regenerate it whenever the PDF changes:
  `sips -s format png --resampleWidth 1400 public/Nehemias-Landaverde-Resume.pdf --out /tmp/p.png`, then
  `sharp('/tmp/p.png').flatten({ background: '#fff' }).webp({ quality: 86 }).toFile('public/resume-page.webp')`.

## 11. Bugs found later

- **Blank résumé after the full intro (Oct 23).** The page's image was fetched during the coin pickup, before the
  loft existed, so attaching it threw inside the promise and was silently swallowed. Tests had used *Skip intro*,
  which builds the loft first, so it went unnoticed. Now the image is fetched early but attached when the loft is
  built. Found while recording the README preview in a headless browser that went through the real intro.

## 12. The rooftop (Oct 22 – Oct 23)

A second scene, built as a prototype on its own branch and promoted to the home page on Oct 23. The loft moved to
`/loft.html`, and the rooftop's "This website" card links to it.

- **The idea:** a calmer, faster front door. Neo sits on a ledge at golden hour with Manhattan across the river,
  and the portfolio is five playing cards fanned above him (Hobitual, Gamify.Life, this website, the résumé, about
  me), each with a real screenshot. Hovering lifts a card toward you; clicking glides the camera over while the card flies up front and
  its details slide in. The résumé card downloads the PDF.
- **Baked in Blender, finished live:** `rooftop/build_rooftop.py` builds the roof, ledge, façade and props in
  Blender, bakes their golden-hour lighting in Cycles (the ledge at higher resolution and samples) and exports them
  for three.js, where they're shown unlit. Textures are mapped in metres, so bricks are life-size and nothing streaks.
  The skyline is plain geometry whose lit windows are drawn by a shader, so it costs no texture download; the river's
  sun streak and the sky are shaders too.
- **Iterations:** rooftops and a slope below the ledge gave way to open water and a waterfront with piers; the
  camera pulled back; Neo moved from three-quarter profile to facing the camera; the card fan tightened to a 140°
  arc and scales with the screen width; phones get a closer camera and bigger cards. Earlier prototypes
  (a ring of cards, a snowy ridge with a campfire) were shelved; the card backs went from five designs to one.
- **Slim Neo:** `rooftop/slim-neo.sh` rebuilds a rooftop-only Neo from the main model: 30k → 15k triangles, smaller
  AVIF textures, the walk clip dropped (only sitting and idle play here). 1.48 MB → 480 KB.
- **Arrival:** the screen holds on black until the scene, Neo and the shaders are ready, then a crane-down reveal,
  the cards pop in, and the camera drifts gently with the pointer. Reduced motion skips the reveal.
- **Going live:** the "preview" label and `noindex` came off, the page took the loft's search and link-preview tags
  with a new rooftop preview image, and `/rooftop.html` redirects home. Tested under the production security headers:
  the import map is identical to the loft's, so the same CSP hash covers both pages.

---

### Gotchas worth keeping

- If the `<script type="importmap">` block changes, recompute its SHA-256 and update `script-src` in `_headers`, or
  the page won't run.
- Quantised glTF stores scale in the node transform: never overwrite a loaded node's position or scale; wrap it in a
  `THREE.Group` and move that.
- glTF bones load in an animation pose, not the bind pose; anchor things to real skinned vertices, not bones.
- Never name site files with `.env`, `.git` or `wp-` in the path: the firewall rule will block them.
- Animations in a hidden browser tab run at about 2 fps, so test flows in a visible window or a headless browser.
- `security.txt` expires 2027-10-01; renew it before then.
