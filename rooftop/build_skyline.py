# Builds the Manhattan skyline seen from the rooftop and exports rooftop/skyline_raw.glb (no baking: the lit windows
# are drawn live by a shader in public/home/city.js, which reads the UVs here as metres: u along a wall, v up).
# Run from the repo root (a few seconds):
#   /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P rooftop/build_skyline.py
#   npx -y @gltf-transform/cli@4 meshopt rooftop/skyline_raw.glb public/skyline.glb --level medium
# Everything is placed from real latitude/longitude as seen from the Palisades at Weehawken, built at real size (metres,
# turned to Manhattan's street grid), then the whole city is scaled by one factor S and turned by ROT about the
# viewpoint to fit the scene. One uniform scale keeps every proportion true: a smaller city seen from closer looks the
# same as the real one from farther away. The one exception is One World Trade: from here it is ~90° to the right of
# Midtown, out of any frame, so it stands in at the right edge at its true scaled size (WTC_AT).
# Coordinates are in three.js terms (x right, y up, z toward the camera).
import bpy, bmesh, math, os, random
from mathutils import Vector

OUT = os.path.join(os.getcwd(), 'rooftop')
G = -84.0                                              # street level
LAT0, LON0 = 40.7685, -74.0215                         # the viewpoint: up on the Palisades at Weehawken (Boulevard East)
S, ROT, SKY_X = 0.5, -40.0, 280.0                      # city scale, turn about the viewpoint (degrees), SKY_X in public/home/city.js
GRID = 29.0                                            # Manhattan's street grid, degrees off true north
def real(lat, lon): return ((LAT0 - lat) * 111000, -(lon - LON0) * 84330)   # metres: x = south (right), z = -east
random.seed(4)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
def B(x, y, z): return Vector((x, -z, y))             # three.js → Blender (Z-up)

bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap')

def loft(rings, bottom=False):
    """Solid from a stack of rings (each a list of (x, y, z) with the same count), capped on top (and below if asked:
    the city is only ever seen from above its streets, so most bottoms would never show)."""
    vs = [[bm.verts.new(B(*p)) for p in r] for r in rings]
    n = len(rings[0])
    for a, b in zip(vs, vs[1:]):
        for i in range(n):
            j = (i + 1) % n
            if len({a[i], a[j], b[j], b[i]}) == 4: bm.faces.new((a[i], a[j], b[j], b[i]))
    if bottom: bm.faces.new(list(reversed(vs[0])))
    bm.faces.new(vs[-1])

def rect(cx, cz, w, d, y, yaw=None, n=4):
    """A w × d rectangle (n = 4) or its 8-point version (corners + edge midpoints), turned by yaw degrees."""
    yaw = GRID if yaw is None else GRID + yaw                      # buildings follow the street grid
    c, s = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
    pts = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    if n == 8: pts = [p for i, q in enumerate(pts) for p in (q, ((q[0] + pts[(i + 1) % 4][0]) / 2, (q[1] + pts[(i + 1) % 4][1]) / 2))]
    return [(cx + (x * w / 2) * c - (z * d / 2) * s, y, cz + (x * w / 2) * s + (z * d / 2) * c) for x, z in pts]

def ngon(cx, cz, r, y, n=8, rot=22.5):
    return [(cx + r * math.cos(math.radians(rot + i * 360 / n)), y, cz + r * math.sin(math.radians(rot + i * 360 / n))) for i in range(n)]

def stack(cx, cz, steps, yaw=None):
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
    stack(x, z, [(56, 62, 62)], -GRID)
    bottom = rect(x, z, 60, 60, G + 56, -GRID, 8)                        # corners + midpoints
    top = rect(x, z, 30 * math.sqrt(2), 30 * math.sqrt(2), G + 417, 45 - GRID, 8)   # the same square turned 45°, half the size
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
    loft([tri(y), tri(y + 5)], bottom=True)                        # seen from below

def hy35(x, z):                                                     # 35 Hudson Yards, 308 m: slender, tapering
    landmark('35hy', x, z, 45)
    loft([rect(x, z, 42, 32, G, 8), rect(x, z, 30, 24, G + 308, 8)])

def hy50(x, z):                                                     # 50 Hudson Yards, 300 m: the bulk
    landmark('50hy', x, z, 60)
    stack(x, z, [(250, 92, 62), (300, 80, 56)])

def spiral(x, z):                                                   # The Spiral, 314 m: terraces stepping round the corners
    landmark('spiral', x, z, 50)
    for k, (top, w) in enumerate([(120, 62), (180, 58), (230, 54), (270, 50), (314, 44)]):
        o = 3 * k
        loft([rect(x + o, z - o, w, w * 0.8, G + (0 if k == 0 else [120, 180, 230, 270][k - 1])),
              rect(x + o, z - o, w, w * 0.8, G + top)])

def jpmorgan(x, z):                                                # 270 Park, 423 m: a flared base, then setbacks and a crown
    landmark('jpm', x, z, 60)
    loft([rect(x, z, 44, 44, G), rect(x, z, 70, 66, G + 40), rect(x, z, 66, 62, G + 300)])
    loft([rect(x, z, 56, 52, G + 300), rect(x, z, 56, 52, G + 360)])
    loft([rect(x, z, 46, 42, G + 360), rect(x, z, 46, 42, G + 400), rect(x, z, 14, 12, G + 423)])

def one_vanderbilt(x, z):                                          # 427 m: tapering, slightly twisting, with a spire
    landmark('vanderbilt', x, z, 50)
    loft([rect(x, z, 58, 50, G, 0), rect(x, z, 44, 38, G + 250, 4), rect(x, z, 26, 22, G + 395, 9)])   # turns as it rises
    mast(x, z, 395, 427, 3.0)

def park432(x, z):                                                 # 426 m: the slim square column
    landmark('432', x, z, 30)
    loft([rect(x, z, 28, 28, G), rect(x, z, 28, 28, G + 426)])

def central_park_tower(x, z):                                       # 472 m: a tall slab with a stepped cantilever, glass crown
    landmark('cpt', x, z, 40)
    stack(x, z, [(60, 54, 40), (300, 36, 27), (440, 32, 24), (472, 28, 20)])

def w57_111(x, z):                                                  # 111 West 57th, 435 m: the world's slimmest, stepping in to a point
    landmark('111w57', x, z, 30)
    loft([rect(x, z, 18, 60, G), rect(x, z, 18, 60, G + 300), rect(x, z, 14, 30, G + 400), rect(x, z, 6, 8, G + 435)])

def one57(x, z):                                                    # 306 m: a wide slab with a curved, stepped-down top
    landmark('one57', x, z, 40)
    stack(x, z, [(250, 58, 30), (280, 48, 26), (306, 34, 22)])

def cps220(x, z):                                                   # 220 Central Park South, 290 m: limestone, a crowned top
    landmark('220cps', x, z, 35)
    stack(x, z, [(250, 40, 30), (275, 32, 24), (290, 22, 18)])

def w53_53(x, z):                                                   # 53 West 53rd, 320 m: tapering to a sharp spire
    landmark('53w53', x, z, 35)
    loft([rect(x, z, 34, 26, G), rect(x, z, 26, 20, G + 230), rect(x, z, 2, 2, G + 320)])

for build, lat, lon in ((the_edge, 40.7537, -74.0012), (hy35, 40.7545, -74.0027), (hy50, 40.7531, -73.9996),
                        (spiral, 40.7543, -73.9990), (empire_state, 40.7484, -73.9857), (one_vanderbilt, 40.7530, -73.9788),
                        (chrysler, 40.7516, -73.9755), (jpmorgan, 40.7556, -73.9752), (park432, 40.7616, -73.9719),
                        (central_park_tower, 40.7663, -73.9810), (w57_111, 40.7646, -73.9775), (one57, 40.7653, -73.9792),
                        (cps220, 40.7672, -73.9808), (w53_53, 40.7614, -73.9774)):
    build(*real(lat, lon))

# ── filler: Manhattan's footprint between 14th and ~125th St (Central Park left open), densest in Midtown and at Hudson Yards; real heights ──
def tower(x, z, w, d, h):
    y = G
    for step in range(random.choice((1, 1, 2, 3))):
        seg = h * (0.6 if step == 0 else 0.25)
        loft([rect(x, z, w, d, y), rect(x, z, w, d, y + seg)])
        y += seg; w *= 0.78; d *= 0.78
        if y - G > h: break
    if h > 170 and random.random() < 0.4:
        loft([rect(x, z, w * 0.9, d * 0.9, y), rect(x, z, 1, 1, y + w * 0.7)])
west = lambda lat: -74.0090 + (lat - 40.741) * 0.53 if lat < 40.771 else -73.9931 + (lat - 40.771) * 0.68   # the Hudson shore
east = lambda lat: -73.9740 + (lat - 40.730) * 0.50 if lat < 40.785 else -73.9465 + (lat - 40.785) * 0.30   # East/Harlem River
GA = (math.cos(math.radians(GRID)), math.sin(math.radians(GRID)))   # along the avenues, in real (x, z)
def in_park(lat, lon):                                              # Central Park: 59th–110th St, Fifth to Eighth Ave
    x, z = real(lat, lon); a = x * GA[0] + z * GA[1]; b = -x * GA[1] + z * GA[0]
    (x0, z0), (x1, z1) = real(40.7681, -73.9819), real(40.7969, -73.9493)   # its southwest and northeast corners
    a0, b0, a1, b1 = x0 * GA[0] + z0 * GA[1], -x0 * GA[1] + z0 * GA[0], x1 * GA[0] + z1 * GA[1], -x1 * GA[1] + z1 * GA[0]
    return min(a0, a1) < a < max(a0, a1) and min(b0, b1) < b < max(b0, b1)
bump = lambda lat, lon, la, lo, r: math.exp(-(((lat - la) * 111000) ** 2 + ((lon - lo) * 84330) ** 2) / r ** 2)
for i in range(750):                                                # 14th St up to ~125th St
    lat = random.uniform(40.735, 40.815); lon = random.uniform(west(lat) + 0.0015, east(lat) - 0.0015)
    if in_park(lat, lon): continue
    core = bump(lat, lon, 40.7549, -73.9840, 1100) + 0.8 * bump(lat, lon, 40.7535, -74.0000, 350) \
           + 0.25 * bump(lat, lon, 40.7850, -73.9780, 1500)              # the Upper West/East Sides: mostly mid-rise
    h = random.uniform(20, 70) + core * random.uniform(40, 230) * (1 if random.random() < 0.55 else 0.45)
    w, d = random.uniform(22, 55), random.uniform(22, 55)
    x, z = real(lat, lon)
    if any(math.hypot(x - lx, z - lz) < r + max(w, d) for lx, lz, r in L.values()): continue
    c, s_ = math.cos(math.radians(ROT)), math.sin(math.radians(ROT))
    if S * (x * s_ + z * c) > -810: continue                         # would stand in the river, in front of the scene's seawall
    tower(x, z, w, d, h)

def uv(faces):                                                      # planar UVs in real metres by face direction
    for f in faces:
        n = f.normal; ox = (hash((round(f.calc_center_median().x), round(f.calc_center_median().y))) % 997) * 3.0
        for l in f.loops:
            p = l.vert.co
            if abs(n.z) > 0.7: l[uvl].uv = (p.x, p.y)
            elif abs(n.x) > abs(n.y): l[uvl].uv = (p.y + ox, p.z - G)
            else: l[uvl].uv = (p.x + ox, p.z - G)
def place(verts, k, turn, dx, dz):                                  # scale by k about the street, turn about the viewpoint
    c, s = math.cos(math.radians(turn)), math.sin(math.radians(turn))
    for v in verts:
        x, y, z = v.co.x, v.co.z, -v.co.y                            # back to three.js axes
        x, z = x * c - z * s, x * s + z * c
        v.co = B(k * x + dx, G + k * (y - G), k * z + dz)
bm.normal_update(); uv(bm.faces)
place(bm.verts, S, ROT, -SKY_X, 0)

# One World Trade: built at the origin at real size, then set at the right edge of the view at the same scale
WTC_AT = (140.0, -1950.0)                                            # scene x (before SKY_X), z: just right of Hudson Yards
before = set(bm.verts); one_wtc(0, 0)
bm.normal_update(); uv([f for f in bm.faces if any(v not in before for v in f.verts)])
place([v for v in bm.verts if v not in before], S, 0, *WTC_AT)

me = bpy.data.meshes.new('skyline'); bm.to_mesh(me); bm.free()
ob = bpy.data.objects.new('skyline', me); sc.collection.objects.link(ob)
ob.select_set(True)

# ── the boroughs behind: Long Island City's towers behind Midtown, Queens beyond, Brooklyn's waterfront to the right ──
# Silhouettes only (public/home/city.js draws them faded into the haze, no windows). Anything farther than FAR_MAX from the eye
# is pulled in toward it and shrunk by the same factor: same direction, same apparent size, but inside the camera's
# 3 km draw distance.
FAR_MAX, EYE = 2600.0, (-SKY_X, 2.0, 0.0)                           # EYE: the camera, in the skyline's own coordinates
bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap')
def far(lat, lon, w, d, h):
    before = set(bm.verts); tower(*real(lat, lon), w, d, h)
    new = [v for v in bm.verts if v not in before]
    place(new, S, ROT, -SKY_X, 0)
    cx = sum(v.co.x for v in new) / len(new); cz = -sum(v.co.y for v in new) / len(new)
    dist = math.hypot(cx - EYE[0], cz - EYE[2])
    if dist > FAR_MAX:
        k = FAR_MAX / dist
        for v in new:
            x, y, z = v.co.x, v.co.z, -v.co.y
            v.co = B(EYE[0] + k * (x - EYE[0]), EYE[1] + k * (y - EYE[1]), EYE[2] + k * (z - EYE[2]))
        low = min(v.co.z for v in new)                              # pulling in lifts the base off the ground: drop it back
        for v in new:
            if v.co.z < low + 0.01: v.co.z = G
for i in range(30):                                                  # Long Island City: Skyline Tower, Court Square and co.
    far(random.uniform(40.742, 40.753), random.uniform(-73.947, -73.935), random.uniform(25, 45), random.uniform(25, 45), random.uniform(70, 230))
far(40.7477, -73.9420, 40, 40, 234); far(40.7473, -73.9447, 45, 45, 203)
for i in range(140):                                                 # Queens beyond: Astoria, Sunnyside, low and mid-rise
    far(random.uniform(40.735, 40.775), random.uniform(-73.935, -73.880), random.uniform(25, 60), random.uniform(25, 60), random.uniform(15, 55))
for i in range(90):                                                  # Brooklyn's waterfront: Greenpoint, Williamsburg
    far(random.uniform(40.705, 40.735), random.uniform(-73.965, -73.935), random.uniform(25, 50), random.uniform(25, 50), random.uniform(20, 140))
bm.normal_update()
me2 = bpy.data.meshes.new('skyline_far'); bm.to_mesh(me2); bm.free()
ob2 = bpy.data.objects.new('skyline_far', me2); sc.collection.objects.link(ob2)
ob2.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'skyline_raw.glb'), use_selection=True, export_format='GLB',
                          export_materials='NONE', export_normals=False, export_lights=False, export_cameras=False)
print('SKYLINE DONE', len(me.polygons), '+', len(me2.polygons), 'faces', flush=True)
