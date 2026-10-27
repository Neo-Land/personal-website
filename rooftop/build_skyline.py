# Builds the Manhattan skyline seen from the rooftop and exports rooftop/skyline_raw.glb (no baking: the lit windows
# are drawn live by a shader in rooftop.js, which reads the UVs here as metres: u along a wall, v up).
# Run from the repo root (a few seconds):
#   /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P rooftop/build_skyline.py
#   npx -y @gltf-transform/cli@4 meshopt rooftop/skyline_raw.glb public/skyline.glb --level medium
# The landmarks are modelled from their real silhouettes and heights (metres; the ground is y = -84 in scene units,
# which are metres too), arranged as seen from Weehawken: Hudson Yards up front by the river, the Empire State behind it
# to the left, Grand Central's cluster (One Vanderbilt, the Chrysler, JPMorgan's 270 Park, 432 Park) further left and
# back, One World Trade far to the right downtown. Filler towers keep clear of them and stay lower, so they read.
# Coordinates are in three.js terms (x right, y up, z toward the camera) before rooftop.js shifts it all by SKY_X.
import bpy, bmesh, math, os, random
from mathutils import Vector

OUT = os.path.join(os.getcwd(), 'rooftop')
G = -84.0                                              # street level
random.seed(4)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
def B(x, y, z): return Vector((x, -z, y))             # three.js → Blender (Z-up)

bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap')

def loft(rings):
    """Solid from a stack of rings (each a list of (x, y, z) with the same count), capped top and bottom."""
    vs = [[bm.verts.new(B(*p)) for p in r] for r in rings]
    n = len(rings[0])
    for a, b in zip(vs, vs[1:]):
        for i in range(n):
            j = (i + 1) % n
            if len({a[i], a[j], b[j], b[i]}) == 4: bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(list(reversed(vs[0]))); bm.faces.new(vs[-1])

def rect(cx, cz, w, d, y, yaw=0.0, n=4):
    """A w × d rectangle (n = 4) or its 8-point version (corners + edge midpoints), turned by yaw degrees."""
    c, s = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
    pts = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    if n == 8: pts = [p for i, q in enumerate(pts) for p in (q, ((q[0] + pts[(i + 1) % 4][0]) / 2, (q[1] + pts[(i + 1) % 4][1]) / 2))]
    return [(cx + (x * w / 2) * c - (z * d / 2) * s, y, cz + (x * w / 2) * s + (z * d / 2) * c) for x, z in pts]

def ngon(cx, cz, r, y, n=8, rot=22.5):
    return [(cx + r * math.cos(math.radians(rot + i * 360 / n)), y, cz + r * math.sin(math.radians(rot + i * 360 / n))) for i in range(n)]

def stack(cx, cz, steps, yaw=0.0):
    """Setbacks: steps = [(top height, w, d), …] from the street up; each block sits on the last."""
    y = G
    for top, w, d in steps:
        loft([rect(cx, cz, w, d, y, yaw), rect(cx, cz, w, d, G + top, yaw)]); y = G + top

def mast(cx, cz, y0, top, r):
    loft([ngon(cx, cz, r, G + y0, 6), ngon(cx, cz, r * 0.35, G + top, 6)])

# ── landmarks ──
L = {}
def landmark(name, x, z, r):
    L[name] = (x, z, r)

def empire_state(x, z):                                            # 381 m roof, 443 m tip: the stepped shaft, crown and mast
    landmark('esb', x, z, 75)
    stack(x, z, [(25, 120, 56), (80, 62, 46), (250, 50, 40), (268, 42, 33), (290, 34, 27), (318, 26, 21), (332, 18, 15)])
    loft([ngon(x, z, 9, G + 332, 8), ngon(x, z, 9, G + 360, 8), ngon(x, z, 6, G + 372, 8)])
    mast(x, z, 372, 443, 2.2)

def chrysler(x, z):                                                # 319 m: the terraced, pointed crown
    landmark('chrysler', x, z, 55)
    stack(x, z, [(60, 58, 58), (200, 40, 40), (238, 32, 32)])
    rings, y, r = [], G + 238, 15.0
    for k in range(6):                                              # six terraces, each narrower: the sunburst crown's outline
        rings += [ngon(x, z, r, y), ngon(x, z, r, y + 7)]; y += 7; r -= 2.2
    loft(rings)
    loft([ngon(x, z, r + 1.2, y, 8), ngon(x, z, 0.5, G + 319, 8)])  # the needle

def one_wtc(x, z):                                                 # 417 m roof, 541 m tip: a square that twists into an octagon
    landmark('wtc', x, z, 70)
    stack(x, z, [(56, 62, 62)])
    bottom = rect(x, z, 60, 60, G + 56, 0, 8)                        # corners + midpoints
    top = rect(x, z, 30 * math.sqrt(2), 30 * math.sqrt(2), G + 417, 45, 8)   # the same square turned 45°, half the size
    top = top[-1:] + top[:-1]                                       # line its corners up with the base's edge midpoints
    loft([bottom, top])
    loft([ngon(x, z, 9, G + 417, 8), ngon(x, z, 9, G + 428, 8)])
    mast(x, z, 428, 541, 2.0)

def the_edge(x, z):                                                # 30 Hudson Yards, 387 m: a sloped top and the Edge's deck
    landmark('edge', x, z, 65)
    w, d = 56, 44
    b = rect(x, z, w, d, G)
    t = [(px, G + (387 if pz > z else 352), pz) for px, _, pz in rect(x, z, w * 0.9, d * 0.9, 0)]   # slopes down away from us
    loft([b, rect(x, z, w, d, G + 120), t])
    y = G + 335; cx, cz = x + w * 0.45, z + d * 0.45                # the deck: a wedge out of the corner facing the river
    tri = lambda yy: [(cx - 10, yy, cz - 4), (cx + 22, yy, cz + 22), (cx - 4, yy, cz - 10)]
    loft([tri(y), tri(y + 5)])

def hudson_yards(x, z):                                            # 35 HY (tapered), 50 HY (the bulk), the Spiral (terraces)
    landmark('35hy', x - 95, z - 15, 45)
    loft([rect(x - 95, z - 15, 42, 32, G, 8), rect(x - 95, z - 15, 30, 24, G + 308, 8)])
    landmark('50hy', x + 105, z - 40, 60)
    stack(x + 105, z - 40, [(250, 92, 62), (300, 80, 56)])
    landmark('spiral', x - 175, z - 60, 50)
    for k, (top, w) in enumerate([(120, 62), (180, 58), (230, 54), (270, 50), (314, 44)]):
        o = 3 * k                                                    # each terrace steps toward a different corner
        loft([rect(x - 175 + o, z - 60 - o, w, w * 0.8, G + (0 if k == 0 else [120, 180, 230, 270][k - 1])),
              rect(x - 175 + o, z - 60 - o, w, w * 0.8, G + top)])

def jpmorgan(x, z):                                                # 270 Park, 423 m: a flared base, then setbacks and a crown
    landmark('jpm', x, z, 60)
    loft([rect(x, z, 44, 44, G), rect(x, z, 70, 66, G + 40), rect(x, z, 66, 62, G + 300)])
    loft([rect(x, z, 56, 52, G + 300), rect(x, z, 56, 52, G + 360)])
    loft([rect(x, z, 46, 42, G + 360), rect(x, z, 46, 42, G + 400), rect(x, z, 14, 12, G + 423)])

def one_vanderbilt(x, z):                                          # 427 m: tapering, slightly twisting, with a spire
    landmark('vanderbilt', x, z, 50)
    loft([rect(x, z, 58, 50, G, 0), rect(x, z, 44, 38, G + 250, 4), rect(x, z, 26, 22, G + 395, 9)])
    mast(x, z, 395, 427, 3.0)

def park432(x, z):                                                 # 426 m: the slim square column
    landmark('432', x, z, 30)
    loft([rect(x, z, 28, 28, G), rect(x, z, 28, 28, G + 426)])

hudson_yards(-40, -1150); the_edge(-40, -1150)
empire_state(-330, -1480)
one_vanderbilt(-480, -1700); chrysler(-420, -1780); jpmorgan(-560, -1660); park432(-680, -1860)
one_wtc(430, -1950)

# ── filler: towers with setbacks, a few pyramid tops; clear of the landmarks and lower than them ──
def tower(x, z, w, d, h):
    y = G
    for step in range(random.choice((1, 1, 2, 3))):
        seg = h * (0.6 if step == 0 else 0.25)
        loft([rect(x, z, w, d, y), rect(x, z, w, d, y + seg)])
        y += seg; w *= 0.78; d *= 0.78
        if y - G > h: break
    if h > 170 and random.random() < 0.4:
        loft([rect(x, z, w * 0.9, d * 0.9, y), rect(x, z, 1, 1, y + w * 0.7)])
for i in range(260):
    x, z = random.uniform(-1100, 1100), random.uniform(-1900, -850)
    mid = math.exp(-((x + 200) / 420) ** 2)
    h = random.uniform(25, 80) + mid * random.uniform(30, 170) * (1 if random.random() < 0.5 else 0.4)
    w, d = random.uniform(18, 42), random.uniform(18, 42)
    if any(math.hypot(x - lx, z - lz) < r + max(w, d) for lx, lz, r in L.values()): continue
    tower(x, z, w, d, h)

bm.normal_update()
for f in bm.faces:                                                           # planar UVs in metres by face direction
    n = f.normal; ox = (hash((round(f.calc_center_median().x), round(f.calc_center_median().y))) % 997) * 3.0
    for l in f.loops:
        p = l.vert.co
        if abs(n.z) > 0.7: l[uvl].uv = (p.x, p.y)
        elif abs(n.x) > abs(n.y): l[uvl].uv = (p.y + ox, p.z - G)
        else: l[uvl].uv = (p.x + ox, p.z - G)
me = bpy.data.meshes.new('skyline'); bm.to_mesh(me); bm.free()
ob = bpy.data.objects.new('skyline', me); sc.collection.objects.link(ob)
ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'skyline_raw.glb'), use_selection=True, export_format='GLB',
                          export_materials='NONE', export_lights=False, export_cameras=False)
print('SKYLINE DONE', len(me.polygons), 'faces', flush=True)
