# Builds the Palisades rooftop at dusk, bakes its lighting in Cycles and exports rooftop/rooftop_raw.glb.
# Run from the repo root (--factory-startup keeps user add-ons like BlenderKit / MCP out of it; they hung a bake):
#   /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P rooftop/build_rooftop.py
#   SAMPLES=16 SAMPLES_HI=32 for a quick test bake (defaults 128 / 256 for the ledge).
# Baked groups (each one texture, shown unlit in three.js): deck, ledge (its own hi-res, high-sample bake), façade,
# props. The skyline is exported as plain geometry with UVs in metres: its lit windows are drawn live by a
# shader in rooftop.js, so it costs no texture download. Neo isn't baked, and nothing stands in for him.
# Coordinates are written in three.js terms (x right, y up, z toward the camera) and converted with B().
import bpy, bmesh, math, os, random
from mathutils import Vector

OUT = os.path.join(os.getcwd(), 'rooftop')
SAMPLES = int(os.environ.get('SAMPLES', 128))
SUN = Vector((-0.45, 0.12, -1)).normalized()          # three.js direction to the sun (= SUN in rooftop.js)
NEO = (0.6, 0.5, -4.25)                                # where he sits on the ledge (= NEO in rooftop.js)
random.seed(4)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

def B(x, y, z): return Vector((x, -z, y))             # three.js → Blender (Z-up)

# ── materials (procedural, only used for the bake) ──
def mat(name, color, rough=0.85, noise=0.0, scale=6.0, brick=None, bump=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; bsdf = nt.nodes['Principled BSDF']; bsdf.inputs['Roughness'].default_value = rough
    co = nt.nodes.new('ShaderNodeTexCoord').outputs['Object']   # textures in metres: the default (Generated) squeezes
                                                                # each object into a unit box, stretching the 12 m ledge
    if brick:                                          # brick walls: Blender's brick texture
        t = nt.nodes.new('ShaderNodeTexBrick'); nt.links.new(co, t.inputs['Vector']); t.inputs['Color1'].default_value = (*brick[0], 1)
        t.inputs['Color2'].default_value = (*brick[1], 1); t.inputs['Mortar'].default_value = (*brick[2], 1)
        t.inputs['Scale'].default_value = 1.0; t.inputs['Mortar Size'].default_value = 0.012
        t.offset = 0.5; t.inputs['Brick Width'].default_value = 0.22; t.inputs['Row Height'].default_value = 0.075
        nt.links.new(t.outputs['Color'], bsdf.inputs['Base Color'])
    elif noise:                                        # grime: colour wobbles with a noise texture
        n = nt.nodes.new('ShaderNodeTexNoise'); nt.links.new(co, n.inputs['Vector']); n.inputs['Scale'].default_value = scale / 4; n.inputs['Detail'].default_value = 6
        r = nt.nodes.new('ShaderNodeValToRGB'); r.color_ramp.elements[0].color = tuple(c * (1 - noise) for c in color) + (1,)
        r.color_ramp.elements[1].color = tuple(min(c * (1 + noise), 1) for c in color) + (1,)
        nt.links.new(n.outputs['Fac'], r.inputs['Fac']); nt.links.new(r.outputs['Color'], bsdf.inputs['Base Color'])
    else:
        bsdf.inputs['Base Color'].default_value = (*color, 1)
    if bump:                                           # fine grain + pits the bake turns into real light and shadow
        g = nt.nodes.new('ShaderNodeTexNoise'); nt.links.new(co, g.inputs['Vector']); g.inputs['Scale'].default_value = 18; g.inputs['Detail'].default_value = 10
        b = nt.nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value = bump; b.inputs['Distance'].default_value = 0.01
        nt.links.new(g.outputs['Fac'], b.inputs['Height']); nt.links.new(b.outputs['Normal'], bsdf.inputs['Normal'])
    return m

TAR = mat('tar', (0.075, 0.07, 0.068), 0.9, noise=0.45, scale=3, bump=0.35)
STONE = mat('stone', (0.42, 0.39, 0.35), 0.8, noise=0.3, scale=9, bump=0.3)
BRICK = mat('brick', (0, 0, 0), 0.9, brick=((0.24, 0.1, 0.07), (0.17, 0.07, 0.05), (0.32, 0.3, 0.28)))
BRICK2 = mat('brick2', (0, 0, 0), 0.9, brick=((0.2, 0.13, 0.1), (0.13, 0.09, 0.07), (0.28, 0.27, 0.26)))
GLASS = mat('glass', (0.025, 0.03, 0.04), 0.3)
METAL = mat('metal', (0.32, 0.33, 0.35), 0.6, noise=0.25, scale=14)
WOOD = mat('wood', (0.28, 0.17, 0.1), 0.85, noise=0.35, scale=30)
DARK = mat('dark', (0.05, 0.05, 0.055), 0.9)

def box(size, center, m, name='b'):                    # size/center in three.js (w, h, d) / (x, y, z)
    bpy.ops.mesh.primitive_cube_add(size=1, location=B(*center))
    o = bpy.context.active_object; o.name = name; o.scale = (size[0], size[2], size[1])
    o.data.materials.append(m); return o
def cyl(r, h, center, m, r2=None, seg=24, name='c'):   # vertical cylinder / cone
    bpy.ops.mesh.primitive_cone_add(vertices=seg, radius1=r, radius2=r if r2 is None else r2, depth=h, location=B(*center))
    o = bpy.context.active_object; o.name = name; o.data.materials.append(m); return o
def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]; bpy.ops.object.join()
    o = bpy.context.active_object; o.name = name
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return o

# ── the roof Neo is on ──
deck = [box((12, 0.3, 8), (0, -0.15, -0.5), TAR), box((0.25, 0.55, 8), (-6, 0.27, -0.5), STONE), box((0.25, 0.55, 8), (6, 0.27, -0.5), STONE),
        box((1.0, 0.35, 1.0), (-4.0, 0.17, 0.6), METAL),                     # roof hatch
        box((11, 0.05, 0.06), (0, 0.03, -3.4), METAL),                       # conduit along the ledge
        box((0.8, 1.4, 0.8), (-5.2, 0.7, -3.4), BRICK)]                      # old chimney stack
for i in range(14):                                                          # tar-paper seams
    deck.append(box((12, 0.012, 0.03), (0, 0.006, 3.4 - i * 0.55), DARK))
deck = join(deck, 'deck')

# ledge: coping slab with an overhang over a stone body, a cornice band and the brick façade below
# the ledge Neo sits on gets its own texture (the camera lives here); the façade below gets a smaller one
ledge = [box((12.2, 0.08, 1.02), (0, 0.5, -4.25), STONE), box((12, 0.44, 0.84), (0, 0.24, -4.25), STONE)]
facade = [box((12.3, 0.22, 0.32), (0, -0.55, -4.78), STONE), box((12.3, 0.06, 0.4), (0, -0.42, -4.8), STONE),
          box((12, 14, 0.3), (0, -7.6, -4.65), BRICK)]
for i in range(12):                                                          # coping-stone joints
    ledge.append(box((0.012, 0.085, 1.03), (-6 + i, 0.5, -4.25), DARK))
for fl in range(4):                                                          # windows on the façade
    for col in range(5):
        x, y = -4.8 + col * 2.4, -2.0 - fl * 3.2
        facade.append(box((1.1, 1.7, 0.08), (x, y, -4.82), GLASS)); facade.append(box((1.3, 0.12, 0.2), (x, y - 0.92, -4.85), STONE))
ledge = join(ledge, 'ledge'); facade = join(facade, 'facade')

# props: water tower, HVAC units, vent pipes
props = []
for dx, dz in ((-0.45, -0.45), (0.45, -0.45), (-0.45, 0.45), (0.45, 0.45)):
    props.append(cyl(0.05, 2.0, (-2.9 + dx, 1.0, -2.2 + dz), METAL, seg=8))
props += [cyl(0.8, 0.08, (-2.9, 2.04, -2.2), WOOD), cyl(0.7, 1.3, (-2.9, 2.73, -2.2), WOOD, seg=32),
          cyl(0.78, 0.55, (-2.9, 3.66, -2.2), WOOD, r2=0.04, seg=32)]
for y in (2.3, 2.75, 3.2):                                                   # steel hoops round the tank
    props.append(cyl(0.715, 0.04, (-2.9, y, -2.2), METAL, seg=32))
props += [box((1.4, 0.9, 0.9), (2.8, 0.45, -1.8), METAL), cyl(0.3, 0.05, (2.8, 0.93, -1.8), DARK),
          box((0.8, 0.6, 0.6), (3.9, 0.3, -0.6), METAL),
          cyl(0.08, 0.7, (1.6, 0.35, -3.0), METAL, seg=12), cyl(0.13, 0.06, (1.6, 0.73, -3.0), METAL, seg=12),
          cyl(0.08, 0.9, (-1.3, 0.45, -2.9), METAL, seg=12), cyl(0.13, 0.06, (-1.3, 0.93, -2.9), METAL, seg=12)]
props = join(props, 'props')

# rooftops below the edge (toward the river), so looking over the ledge there's depth like the reference
below = []
for i in range(16):                                     # left of the building only: on the right the cliff drops into the river
    w, d = random.uniform(8, 18), random.uniform(8, 16)
    top = -random.uniform(6, 30)
    x, z = random.uniform(-90, -12), random.uniform(-12, -90)
    below.append(box((w, top + 86, d), (x, (top - 86) / 2, z), random.choice((BRICK, BRICK2))))   # all the way down to the water
    below.append(box((w, 0.2, d), (x, top + 0.1, z), TAR))
    if random.random() < 0.5:                                                # some get their own little water tower
        below.append(cyl(0.6, 1.0, (x + w * 0.2, top + 2.0, z), WOOD, seg=16)); below.append(cyl(0.66, 0.5, (x + w * 0.2, top + 2.75, z), WOOD, r2=0.03, seg=16))
below = join(below, 'below')

# skyline: towers with setbacks, a few spires; UVs in metres (u along the wall, v up) for the window shader
bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap')
def tower(x, z, w, d, h, base=-84.0):
    y = base
    for step in range(random.choice((1, 1, 2, 3))):
        seg = h * (0.6 if step == 0 else 0.25)
        geo = bmesh.ops.create_cube(bm, size=1)['verts']
        for v in geo:
            v.co = B(x + v.co.x * w, y + (v.co.z + 0.5) * seg, z + v.co.y * d)
        y += seg; w *= 0.78; d *= 0.78
        if y - base > h: break
    if h > 200 and random.random() < 0.6:
        geo = bmesh.ops.create_cone(bm, cap_ends=True, segments=4, radius1=w * 0.45, radius2=0, depth=w * 1.4)['verts']
        for v in geo: v.co = v.co + B(x, y + w * 0.7, z)
for i in range(240):
    x = random.uniform(-1100, 1100); mid = math.exp(-((x + 120) / 380) ** 2)
    h = random.uniform(30, 90) + mid * random.uniform(40, 260) * (1 if random.random() < 0.5 else 0.4)
    tower(x, random.uniform(-1700, -850), random.uniform(18, 45), random.uniform(18, 45), h)
bm.normal_update()
for f in bm.faces:                                                           # planar UVs in metres by face direction
    n = f.normal; ox = (hash((round(f.calc_center_median().x), round(f.calc_center_median().y))) % 997) * 3.0
    for l in f.loops:
        p = l.vert.co
        if abs(n.z) > 0.7: l[uvl].uv = (p.x, p.y)
        elif abs(n.x) > abs(n.y): l[uvl].uv = (p.y + ox, p.z + 84)
        else: l[uvl].uv = (p.x + ox, p.z + 84)
me = bpy.data.meshes.new('skyline'); bm.to_mesh(me); bm.free()
skyline = bpy.data.objects.new('skyline', me); sc.collection.objects.link(skyline)
skyline.data.materials.append(mat('skyline_mat', (0.1, 0.1, 0.12)))

# (no stand-in for Neo: a baked contact shadow stayed on the ledge when he stood up, so the bake leaves his spot clean)

# ── light: dusk sky gradient (same stops as the sky shader), a low warm sun behind, string-light spill ──
world = bpy.data.worlds.new('dusk'); sc.world = world; world.use_nodes = True; nt = world.node_tree
tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); ramp = nt.nodes.new('ShaderNodeValToRGB')
nt.links.new(tc.outputs['Generated'], sep.inputs['Vector'])
mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = -0.1; mr.inputs['From Max'].default_value = 0.7
nt.links.new(sep.outputs['Z'], mr.inputs['Value']); nt.links.new(mr.outputs['Result'], ramp.inputs['Fac'])
cr = ramp.color_ramp; cr.elements[0].position = 0.0; cr.elements[0].color = (0.86, 0.6, 0.42, 1)
cr.elements[1].position = 1.0; cr.elements[1].color = (0.45, 0.22, 0.24, 1)
for pos, col in ((0.125, (1.0, 0.74, 0.46, 1)), (0.3, (0.86, 0.46, 0.36, 1))):
    e = cr.elements.new(pos); e.color = col
nt.links.new(ramp.outputs['Color'], nt.nodes['Background'].inputs['Color'])
nt.nodes['Background'].inputs['Strength'].default_value = float(os.environ.get('SKY', 1.3))
bpy.ops.object.light_add(type='SUN'); sun = bpy.context.active_object
sun.data.color = (1.0, 0.7, 0.44); sun.data.energy = float(os.environ.get('SUNE', 5.0)); sun.data.angle = math.radians(2)
sun.rotation_euler = (-B(*SUN)).to_track_quat('-Z', 'Y').to_euler()
for x in (-3, 0, 3):
    bpy.ops.object.light_add(type='POINT', location=B(x, 1.8, 2.6)); l = bpy.context.active_object
    l.data.color = (1.0, 0.75, 0.45); l.data.energy = 25; l.data.shadow_soft_size = 0.3

# ── bake ──
sc.render.engine = 'CYCLES'
if os.environ.get('DEVICE') == 'GPU':                  # CPU by default: a Metal bake hung in background mode once
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'; prefs.get_devices()
    for d in prefs.devices: d.use = True
    sc.cycles.device = 'GPU'
sc.cycles.samples = SAMPLES
bk = sc.render.bake
bk.use_pass_direct = bk.use_pass_indirect = bk.use_pass_diffuse = bk.use_pass_emit = True
bk.use_pass_glossy = bk.use_pass_transmission = False
bk.margin = 8

def bake(ob, res, samples=SAMPLES):
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(island_margin=0.004, scale_to_bounds=True); bpy.ops.object.mode_set(mode='OBJECT')
    img = bpy.data.images.new(f'{ob.name}_bake', res, res)
    for m in ob.data.materials:
        n = m.node_tree.nodes.new('ShaderNodeTexImage'); n.image = img; m.node_tree.nodes.active = n
    sc.cycles.samples = samples
    print('baking', ob.name, samples, 'samples', flush=True)
    bpy.ops.object.bake(type='COMBINED')
    img.filepath_raw = os.path.join(OUT, f'{ob.name}_bake.png'); img.file_format = 'PNG'; img.save()
    return img

below.select_set(False); bpy.data.objects.remove(below)            # dropped 2026-10-22: the view over the ledge stays open
HI = int(os.environ.get('SAMPLES_HI', 256))                          # the ledge is right in front of the camera: clean it up
baked = {ob.name: bake(ob, res, smp) for ob, res, smp in ((deck, 2048, SAMPLES), (ledge, 2048, HI), (facade, 1024, SAMPLES), (props, 1024, SAMPLES))}
# export materials: just the baked image (three.js shows it unlit); skyline keeps its plain material
for ob in (deck, ledge, facade, props):
    m = bpy.data.materials.new(f'{ob.name}_baked'); m.use_nodes = True
    t = m.node_tree.nodes.new('ShaderNodeTexImage'); t.image = baked[ob.name]
    m.node_tree.links.new(t.outputs['Color'], m.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    ob.data.materials.clear(); ob.data.materials.append(m)
bpy.ops.object.select_all(action='DESELECT')
for ob in (deck, ledge, facade, props, skyline): ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'rooftop_raw.glb'), use_selection=True, export_format='GLB',
                          export_lights=False, export_cameras=False)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'rooftop.blend'))
print('ROOFTOP DONE', flush=True)
