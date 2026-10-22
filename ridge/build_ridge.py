# Builds the snowy-ridge proof scene, bakes its lighting in Cycles and exports ridge_raw.glb.
# Run: /Applications/Blender.app/Contents/MacOS/Blender -b -P ridge/build_ridge.py   (from the repo root)
# Neo isn't baked (he's skinned and lit live in three.js); a blob stands in for him so he leaves a contact shadow.
# Axes: Blender is Z-up; glTF export maps Blender (x, y, z) → three.js (x, z, -y).
import bpy, bmesh, math, os
from mathutils import Vector, noise

OUT = os.path.join(os.getcwd(), 'ridge')
FIRE = Vector((0.15, -0.75, 0.0))                      # three.js (0.15, 0, 0.75): in front of him, a little to his left
SAMPLES = int(os.environ.get('RIDGE_SAMPLES', 96))

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

def fbm(x, y, oct=4):
    return noise.fractal(Vector((x, y, 0.0)), 0.5, 2.0, oct, noise_basis='PERLIN_ORIGINAL')

def ridge_h(x, y):
    h = 6.0 * (math.exp(-(y / 12.0) ** 2) - 1.0) + 0.6 * fbm(x * 0.08, y * 0.08) + 0.08 * fbm(x * 0.6, y * 0.6)
    w = math.exp(-((x * x + y * y) / 2.5 ** 2))       # flat little camp around the origin
    return h * (1 - w) + 0.02 * fbm(x * 2, y * 2, 2) * w

def grid(name, size, subdiv, height):
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=subdiv, y_subdivisions=subdiv, size=size, calc_uvs=True)
    ob = bpy.context.active_object; ob.name = name
    for v in ob.data.vertices: v.co.z = height(v.co.x, v.co.y)
    ob.data.update(); bpy.ops.object.shade_smooth()
    return ob

def mat(name, color, rough=0.8):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rough
    return m

snow = mat('snow', (0.86, 0.9, 0.97), 0.55)
rock = mat('rock', (0.32, 0.33, 0.36), 0.9)
wood = mat('wood', (0.22, 0.13, 0.08), 0.85)
char = mat('char', (0.03, 0.03, 0.03), 0.9)

# terrain: a ridge running along x, Neo's camp flattened at the origin
ridge = grid('ridge', 60, 180, ridge_h); ridge.data.materials.append(snow)

# far mountains: a big grid that only rises past r≈40, base below the ridge's skirts
def peaks(x, y):
    r = math.hypot(x, y); t = min(max((r - 38) / 40, 0), 1); t = t * t * (3 - 2 * t)
    ridged = 1 - abs(fbm(x * 0.012, y * 0.012, 5))
    return -9 + t * (14 + 34 * ridged ** 2)
mountains = grid('mountains', 300, 150, peaks); mountains.data.materials.append(snow)

# campfire: crossed logs, a ring of stones, charred centre
camp_parts = []
for i in range(3):
    a = i * math.pi / 3
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.035, depth=0.42, location=FIRE + Vector((0, 0, 0.06)))
    o = bpy.context.active_object; o.rotation_euler = (math.radians(68), 0, a); o.data.materials.append(wood); camp_parts.append(o)
for i in range(10):
    a = i * 2 * math.pi / 10
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.07, location=FIRE + Vector((math.cos(a) * 0.26, math.sin(a) * 0.26, 0.02)))
    o = bpy.context.active_object; o.scale = (1.2, 0.9, 0.6); o.rotation_euler = (0, 0, a * 1.7); o.data.materials.append(rock); camp_parts.append(o)
bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.2, depth=0.01, location=FIRE + Vector((0, 0, 0.004)))
o = bpy.context.active_object; o.data.materials.append(char); camp_parts.append(o)
bpy.ops.object.select_all(action='DESELECT')
for o in camp_parts: o.select_set(True)
bpy.context.view_layer.objects.active = camp_parts[0]; bpy.ops.object.join()
camp = bpy.context.active_object; camp.name = 'camp'
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
bpy.ops.object.shade_smooth()

# stand-in for sitting Neo (shadow + occlusion only, never exported)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(0, 0, 0.18))
proxy = bpy.context.active_object; proxy.name = 'neo_proxy'; proxy.scale = (0.5, 0.42, 0.42); proxy.data.materials.append(rock)

# lights: low dusk sun behind-left, cool sky, the fire
world = bpy.data.worlds.new('sky'); sc.world = world; world.use_nodes = True
bg = world.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.28, 0.36, 0.52, 1); bg.inputs['Strength'].default_value = 0.9
bpy.ops.object.light_add(type='SUN'); sun = bpy.context.active_object
sun.data.color = (1.0, 0.62, 0.45); sun.data.energy = 2.5; sun.data.angle = math.radians(3)
sun.rotation_euler = (-Vector((-1.0, 0.6, 0.18))).to_track_quat('-Z', 'Y').to_euler()
bpy.ops.object.light_add(type='POINT', location=FIRE + Vector((0, 0, 0.25))); fire = bpy.context.active_object
fire.data.color = (1.0, 0.45, 0.15); fire.data.energy = 120; fire.data.shadow_soft_size = 0.15

# Cycles bake (GPU if Metal is available), diffuse light only so nothing view-dependent gets frozen in
sc.render.engine = 'CYCLES'
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'; prefs.get_devices()
    for d in prefs.devices: d.use = True
    sc.cycles.device = 'GPU'
except Exception as e:
    print('GPU unavailable, baking on CPU:', e)
sc.cycles.samples = SAMPLES
bk = sc.render.bake
bk.use_pass_direct = bk.use_pass_indirect = bk.use_pass_diffuse = bk.use_pass_emit = True
bk.use_pass_glossy = bk.use_pass_transmission = False
bk.margin = 8

def bake(ob, res):
    if ob.name == 'camp':
        bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(island_margin=0.02); bpy.ops.object.mode_set(mode='OBJECT')
    img = bpy.data.images.new(f'{ob.name}_bake', res, res)
    for m in ob.data.materials:
        n = m.node_tree.nodes.new('ShaderNodeTexImage'); n.image = img; m.node_tree.nodes.active = n
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.bake(type='COMBINED')
    img.filepath_raw = os.path.join(OUT, f'{ob.name}_bake.png'); img.file_format = 'PNG'; img.save()
    return img

baked = {}
for ob, res in ((ridge, 2048), (mountains, 1024), (camp, 512)):
    print('baking', ob.name); baked[ob.name] = bake(ob, res)

# export materials: just the baked image (three.js shows it unlit)
for ob in (ridge, mountains, camp):
    m = bpy.data.materials.new(f'{ob.name}_baked'); m.use_nodes = True
    t = m.node_tree.nodes.new('ShaderNodeTexImage'); t.image = baked[ob.name]
    m.node_tree.links.new(t.outputs['Color'], m.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    ob.data.materials.clear(); ob.data.materials.append(m)
bpy.ops.object.select_all(action='DESELECT')
for ob in (ridge, mountains, camp): ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'ridge_raw.glb'), use_selection=True, export_format='GLB',
                          export_lights=False, export_cameras=False)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'ridge.blend'))
print('RIDGE DONE')
