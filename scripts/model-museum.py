"""Generate architectural shells in Blender with named runtime exhibit anchors."""

import json
import math
from collections import defaultdict
from pathlib import Path

import bpy
from mathutils import Vector


root = Path(__file__).resolve().parents[1]
architecture = json.loads((root / 'src/museum/architecture.json').read_text())
output = root / '.museum-tools/raw'
output.mkdir(parents=True, exist_ok=True)
parts = defaultdict(list)
materials = {}


def linear(channel):
    value = channel / 255
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def material(name, color, roughness=0.8, metal=0, texture=None, glow=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    rgb = (*[linear(channel) for channel in bytes.fromhex(color)], 1)
    shader.inputs['Base Color'].default_value = rgb
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metal
    if glow:
        shader.inputs['Emission Color'].default_value = rgb
        shader.inputs['Emission Strength'].default_value = glow
    if texture:
        image = mat.node_tree.nodes.new('ShaderNodeTexImage')
        image.image = bpy.data.images.load(str(root / f'.museum-tools/textures/{texture}.png'), check_existing=True)
        mat.node_tree.links.new(image.outputs['Color'], shader.inputs['Base Color'])
    materials[name] = mat


def face(name, vertices, uv=None):
    if uv is None:
        a, b, c = vertices[:3]
        d = [b[i] - a[i] for i in range(3)]
        e = [c[i] - a[i] for i in range(3)]
        normal = [d[(i+1) % 3] * e[(i+2) % 3] - d[(i+2) % 3] * e[(i+1) % 3] for i in range(3)]
        axis = max(range(3), key=lambda i: abs(normal[i]))
        u, v = [i for i in range(3) if i != axis]
        scale = 0.25 if name == 'Parquet' else 0.35 if name == 'Pavers' else 0.32
        uv = [(point[u] * scale, point[v] * scale) for point in vertices]
    parts[name].append((vertices, uv))


def solid(name, sections):
    near, far = sections
    face(name, near[::-1])
    face(name, far)
    for i in range(len(near)):
        j = (i + 1) % len(near)
        face(name, [near[i], near[j], far[j], far[i]])


def box(name, x, y, z, width, height, depth):
    x0, x1 = x - width / 2, x + width / 2
    y0, y1 = y - height / 2, y + height / 2
    near = [(x0, y0, z-depth/2), (x1, y0, z-depth/2), (x1, y1, z-depth/2), (x0, y1, z-depth/2)]
    solid(name, [near, [(a, b, z+depth/2) for a, b, _ in near]])


def shape(name, coordinates, z, depth, lateral=False):
    sections = [[(x, y, z+offset) for x, y in coordinates] for offset in (-depth/2, depth/2)]
    if lateral:
        sections = [[(z, y, -x) for x, y, z in section] for section in sections]
    solid(name, sections)


def arch(name, x, y, z, rx, ry, thickness, depth, segments=24, lateral=False):
    def at(theta, offset):
        return (x + (rx + offset) * math.cos(theta), y + (ry + offset) * math.sin(theta))
    for i in range(segments):
        a, b = math.pi*i/segments, math.pi*(i+1)/segments
        shape(name, [at(a, -thickness), at(a, 0), at(b, 0), at(b, -thickness)], z, depth, lateral)


def column(name, x, z, y0, y1, width, ornate=False):
    center = (y0+y1)/2
    box(name, x, center, z, width, y1-y0, width * 0.75)
    for y in (y0 + 0.08, y0 + 0.28, y1 - 0.28, y1 - 0.08):
        box('Trim', x, y, z, width * 1.34, 0.12, width)
    if ornate:
        for i in range(-2, 3):
            box('Trim', x+i*width*0.17, center, z+width*0.37, width*0.045, y1-y0-0.55, 0.027)


def build_meshes():
    for name, faces in parts.items():
        vertices, polygons = [], []
        for polygon, _ in faces:
            start = len(vertices)
            # glTF Y-up coordinates become Blender Z-up and negative Y depth.
            vertices.extend((x, -z, y) for x, y, z in polygon)
            polygons.append(tuple(range(start, len(vertices))))
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(vertices, [], polygons)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        obj.data.materials.append(materials[name])
        uv_map = mesh.uv_layers.new(name='UVMap')
        for polygon, (_, coords) in zip(mesh.polygons, faces):
            for loop, uv in zip(polygon.loop_indices, coords):
                uv_map.data[loop].uv = uv


def anchor(name, x, y, z, yaw):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = 'PLAIN_AXES'
    obj.location = (x, -z, y)
    obj.rotation_euler[2] = yaw
    bpy.context.collection.objects.link(obj)


def window(x, y, z, width, height, arched=False, lit=False):
    # The backing sits just in front of the facade. The glazing sits at the back of the stone reveal.
    box('Deep Stone', x, y, z, width+0.26, height+0.24, 0.21)
    box('Window Light' if lit else 'Dark Glass', x, y, z+0.12, width-0.03, height-0.06, 0.028)
    for side in (-1, 1):
        box('Limestone', x+side*(width/2+0.074), y, z+0.31, 0.16, height+0.14, 0.45)
        box('Trim', x+side*(width/2+0.11), y, z+0.54, 0.075, height+0.13, 0.064)
    box('Window Metal', x, y, z+0.154, 0.045, height, 0.047)
    for offset in (-height/2, height*0.08, height/2):
        box('Window Metal', x, y+offset, z+0.154, width, 0.043, 0.041)
    box('Deep Stone', x, y-height/2-0.12, z+0.26, width+0.3, 0.15, 0.49)
    box('Trim', x, y-height/2-0.035, z+0.33, width+0.42, 0.085, 0.59)
    box('Trim', x, y+height/2+0.065, z+0.29, width+0.35, 0.16, 0.44)
    if arched:
        arch('Deep Stone', x, y+height/2+0.082, z+0.20, width*0.57, 0.41, 0.4, 0.19, 12)
        arch('Trim', x, y+height/2+0.082, z+0.36, width*0.66, 0.49, 0.13, 0.35, 12)
        box('Limestone', x, y+height/2+0.54, z+0.54, 0.16, 0.17, 0.12)


def courtyard():
    box('Pavers', 0, -0.15, 5, 93, 0.28, 59)
    box('Limestone', 0, 5.65, -19.2, 85, 11.3, 5.3)
    for y, thickness, depth in [(0.35,0.65,0.83), (3.68,0.2,0.62), (4.05,0.17,0.42), (7.92,0.22,0.55), (10.74,0.18,0.64), (11.05,0.23,0.85), (11.43,0.14,0.76)]:
        box('Trim', 0, y, -16.55, 85.25, thickness, depth)
    box('Roof', 0, 11.9, -19.1, 84.5, 0.93, 5.1)
    box('Trim', 0, 12.43, -19.1, 84.65, 0.15, 5.25)
    box('Deep Stone', 0, 11.61, -16.59, 84.8, 0.17, 0.38)
    box('Trim', 0, 12.04, -16.62, 84.8, 0.12, 0.36)
    for i in range(-96, 97):
        box('Trim', i*0.435, 11.82, -16.6, 0.075 if i % 7 else 0.24, 0.45, 0.21)
    for x in (-23.5, 23.5):
        shape('Roof', [(x-3.62,11.3), (x+3.62,11.3), (x+2.05,13.9), (x-2.05,13.9)], -18.5, 3.95)
        box('Trim', x, 13.91, -18.5, 4.33, 0.13, 4.06)
        window(x, 12.65, -16.52, 0.89, 1.18, True, x < 0)
    for i in range(-13, 14):
        x = i * 3.1
        window(x, 2.15, -16.42, 1.33, 2.15, True, i % 3 == 0)
        window(x, 5.94, -16.4, 1.38, 2.29, i % 3 == 0, i % 4 != 1)
        window(x, 9.26, -16.39, 1.14, 1.51, False, i % 4 == 0)
        box('Trim', x, 7.18, -16.39, 1.78, 0.14, 0.39)
        if i != 13:
            for bottom, top in [(0.42,3.6), (4.15,7.84), (8.03,10.63)]:
                column('Deep Stone' if bottom < 1 else 'Trim', x+1.55, -16.55, bottom, top, 0.44, bottom > 1)
    for x in (-18.6, 0, 18.6):
        for side in (-1, 1):
            column('Trim', x+side*2.08, -16.11, 3.98, 10.64, 0.62, True)
        shape('Limestone', [(x-2.9,11.45), (x+2.9,11.45), (x,13.4 if x else 14.9)], -16.8, 0.84)
        for side in (-1, 1):
            shape('Trim', [(x,13.44 if x else 14.94), (x+side*3,11.58), (x+side*3,11.38), (x,13.22 if x else 14.69)][::1 if side < 0 else -1], -16.36, 0.22)
    for i in range(-44, 45):
        box('Deep Stone', i*0.93, 10.49, -16.47, 0.21, 0.3, 0.27)
    for x in (-10.25, 10.25):
        box('Deep Stone', x, 0.07, 1.4, 6.08, 0.16, 6.08)
        for side in (-1, 1):
            box('Trim', x+side*2.98, 0.19, 1.4, 0.26, 0.33, 6.22)
            box('Trim', x, 0.19, 1.4+side*2.98, 6.22, 0.33, 0.26)
        box('Pool', x, 0.185, 1.4, 5.65, 0.035, 5.65)
    pyramid = architecture['pyramid']
    h, z = pyramid['halfWidth'], pyramid['centerZ']
    for side in (-1, 1):
        box('Trim', side*h, 0.065, z, 0.3, 0.13, 2*h+0.3)
        box('Trim', side*(h+pyramid['doorHalfWidth'])/2, 0.065, z+h, h-pyramid['doorHalfWidth'], 0.13, 0.3)
    box('Trim', 0, 0.065, z-h, 2*h+0.3, 0.13, 0.3)
    box('Deep Stone', 0, 0.018, z+h+0.21, 2*pyramid['doorHalfWidth'], 0.055, 0.48)
    box('Trim', 0, 0.046, z+h+0.30, 2*pyramid['doorHalfWidth'], 0.017, 0.11)
    box('Deep Stone', 0, 0.08, z-0.4, 2*h-0.32, 0.15, 2*h-0.55)


def frame_recess(side, wall_x, z):
    box('Deep Stone', side*(wall_x-0.064), 2.75, z, 0.094, 2.86, 2.78)
    box('Warm Plaster', side*(wall_x-0.117), 2.75, z, 0.037, 2.68, 2.6)


def wing_portal(side, wall_x, z, door, wall_height):
    half = door['halfWidth']
    spring, rise = door['springHeight'], door['rise']
    center = side * (wall_x + 0.19)
    # Fill the wall above the vaulted opening while leaving the entire walkable width clear below it.
    segments = 16
    for index in range(segments):
        a, b = math.pi*index/segments, math.pi*(index+1)/segments
        x0, x1 = -z-half*math.cos(a), -z-half*math.cos(b)
        y0, y1 = spring+rise*math.sin(a), spring+rise*math.sin(b)
        shape('Limestone', [(x0,y0), (x1,y1), (x1,wall_height), (x0,wall_height)], center, 0.38, lateral=True)
    arch('Trim', -z, spring, center, half+0.23, rise+0.19, 0.19, 0.67, segments, lateral=True)
    for edge in (-1, 1):
        jamb_z = z + edge * (half + 0.115)
        box('Trim', center, spring/2, jamb_z, 0.67, spring, 0.22)
        box('Deep Stone', center, 0.105, jamb_z, 0.70, 0.21, 0.23)
        box('Trim', center, spring-0.07, jamb_z, 0.69, 0.14, 0.25)
    sconce_z = z + half + 0.36
    box('Window Metal', side*(wall_x-0.086), 2.54, sconce_z, 0.16, 0.32, 0.16)
    box('Window Light', side*(wall_x-0.177), 2.54, sconce_z, 0.03, 0.24, 0.088)


def gallery_wing(hall, wing):
    side, outer, near, far = [wing[key] for key in ('side', 'outerX', 'nearZ', 'farZ')]
    inner = hall['halfWidth']
    middle, center = (near+far)/2, side*(inner+outer)/2
    spring, rise = 3.28, 1.28
    width = outer-inner
    box('Parquet', center, -0.11, middle, width, 0.21, near-far)
    box('Limestone', side*(outer+0.17), spring/2, middle, 0.34, spring, near-far+0.46)
    box('Warm Plaster', side*(outer-0.022), 1.96, middle, 0.05, 2.48, near-far)
    box('Deep Stone', side*(outer-0.044), 0.38, middle, 0.10, 0.76, near-far)
    for y, height in ((0.11, 0.13), (0.78, 0.11), (3.15, 0.13)):
        box('Trim', side*(outer-0.066), y, middle, 0.18, height, near-far)
    for z, offset in ((near, 1), (far, -1)):
        box('Limestone', center, (spring+rise)/2, z+offset*0.17, width+0.64, spring+rise, 0.34)
        box('Deep Stone', center, 0.34, z-offset*0.038, width, 0.68, 0.08)
        box('Trim', center, 0.73, z-offset*0.055, width, 0.09, 0.11)

    # A lower barrel vault gives the side galleries their own scale and leaves the main hall legible.
    radius = width/2
    for index in range(24):
        a, b = math.pi*index/24, math.pi*(index+1)/24
        x0, x1 = center+radius*math.cos(a), center+radius*math.cos(b)
        y0, y1 = spring+rise*math.sin(a), spring+rise*math.sin(b)
        face('Vault', [(x0,y0,near), (x1,y1,near), (x1,y1,far), (x0,y0,far)])
    for z in (near-0.28, middle, far+0.28):
        arch('Trim', center, spring, z, radius, rise, 0.14, 0.27, 20)
    for exhibit in wing['exhibits']:
        z = exhibit['z']
        if exhibit.get('recess', True):
            frame_recess(side, outer, z)
        anchor(exhibit['anchor'], side*(outer-0.18), 2.12, z, -side*math.pi/2)


def gallery():
    hall = architecture['hall']
    h, front, end, back = [hall[key] for key in ('halfWidth', 'frontZ', 'alcoveZ', 'backZ')]
    spring = hall['springHeight']
    alcove = hall['alcoveHalfWidth']
    box('Parquet', 0, -0.11, (front+back)/2, 2*h, 0.21, front-back+0.1)
    wing_exhibits = {item['anchor'] for wing in hall['wings'] for item in wing['exhibits']}
    door = hall['wingDoor']
    for wing in hall['wings']:
        side = wing['side']
        door_half = door['halfWidth']
        tops = [front, *(z-door_half for z in wing['doorZ'])]
        bottoms = [*(z+door_half for z in wing['doorZ']), end]
        for near, far in zip(tops, bottoms):
            middle, length = (near+far)/2, near-far
            box('Limestone', side*(h+0.19), spring/2, middle, 0.38, spring, length)
            box('Warm Plaster', side*(h-0.025), 3.02, middle, 0.08, 3.74, length)
            box('Deep Stone', side*(h-0.02), 0.47, middle, 0.12, 0.93, length)
            for y, thick, projection in [(0.14,0.15,0.24),(0.95,0.16,0.22),(1.1,0.06,0.15),(4.82,0.11,0.16),(5.03,0.21,0.38),(5.25,0.13,0.31)]:
                box('Trim', side*(h-0.09), y, middle, projection, thick, length)
            for y in (0.27, 4.62):
                box('Deep Stone', side*(h-0.18), y, middle, 0.09, 0.042, length)
            wing_near, wing_far = min(near, wing['nearZ']), max(far, wing['farZ'])
            if wing_near > wing_far:
                for y, thick in ((0.16, 0.22), (0.78, 0.09), (3.15, 0.13)):
                    box('Trim', side*(h+0.40), y, (wing_near+wing_far)/2, 0.13, thick, wing_near-wing_far)
        for z in wing['doorZ']:
            wing_portal(side, h, z, door, spring)
        gallery_wing(hall, wing)
        box('Limestone', side*(h+alcove)/2, spring/2, end, h-alcove, spring, 0.52)
        box('Warm Plaster', side*(alcove+0.1), 2.0, (end+back)/2, 0.2, 4.0, end-back+0.2)
        box('Trim', side*(alcove+.06), 0.18, (end+back)/2, 0.22, 0.36, end-back+0.2)
        box('Trim', side*(alcove+0.06), 3.4, (end+back)/2, 0.28, 0.16, end-back+0.2)
    box('Limestone', 0, 3.7, front+0.14, 2*h, 7.4, 0.35)
    box('Warm Plaster', 0, 2.4, back-0.1, 2*alcove+0.3, 4.8, 0.36)
    box('Deep Stone', 0, 2.36, back+0.085, 3.18, 3.86, 0.13)
    box('Warm Plaster', 0, 2.38, back+0.18, 2.87, 3.56, 0.12)
    box('Trim', 0, 4.12, (end+back)/2, 2*alcove+0.2, 0.25, end-back+0.18)
    arch('Trim', 0, 2.62, end+0.12, alcove+0.27, 1.36, 0.25, 0.45)
    for side in (-1, 1):
        column('Trim', side*(alcove+0.16), end+0.13, 0, 2.68, 0.33)
    # The partition above the final opening follows the interior barrel.
    for i in range(24):
        a, b = math.pi*i/24, math.pi*(i+1)/24
        x0, x1 = h*math.cos(a), h*math.cos(b)
        y0, y1 = spring+3.06*math.sin(a), spring+3.06*math.sin(b)
        shape('Limestone', [(x1,spring-0.1), (x0,spring-0.1), (x0,y0), (x1,y1)], end, 0.43)
    for x in (-1, 1):
        box('Limestone', x*1.52, 4.28, end, 1.18, 2.15, 0.42)
    box('Limestone', 0, 4.59, end, 2.15, 1.37, 0.43)
    box('Limestone', 0, 4.05, end, 1.32, 0.26, 0.43)

    for z in [*hall['bayLines'], end, front]:
        arch('Trim', 0, spring, z, h, 3.06, 0.29, 0.48)
        arch('Deep Stone', 0, spring, z+0.27, h-0.02, 3.02, 0.08, 0.08)
        for side in (-1, 1):
            column('Trim', side*(h-0.14), z, 0, spring, 0.36)

    # Coffered barrel vault segmented at the skylight edges.
    cuts = [i * math.pi / 36 for i in range(37)]
    for z0, z1, has_skylight in [(front,5,False),(5,-3,True),(-3,-11,True),(-11,-19,True),(-19,end,False)]:
        for i, (a, b) in enumerate(zip(cuts, cuts[1:])):
            x0, x1 = h*math.cos(a), h*math.cos(b)
            y0, y1 = spring+3.06*math.sin(a), spring+3.06*math.sin(b)
            name = 'Skylight' if has_skylight and 15 <= i < 21 else 'Vault'
            face(name, [(x0,y0,z0), (x1,y1,z0), (x1,y1,z1), (x0,y0,z1)])
        if has_skylight:
            for x in (-1.38,-0.69,0,0.69,1.38):
                box('Window Metal', x, spring+3.03-abs(x)*0.075, (z0+z1)/2, 0.07, 0.08, z0-z1)
            for index in range(1, 8):
                box('Window Metal', 0, spring+2.91, z0-index, 2.79, 0.08, 0.065)
            for i in (5, 10, 15, 21, 26, 31):
                theta = cuts[i]
                x, y = (h-0.028)*math.cos(theta), spring+3.03*math.sin(theta)
                box('Trim', x, y, (z0+z1)/2, 0.10, 0.11, z0-z1)
            for z in (z0-2.65, z0-5.35):
                arch('Trim', 0, spring, z, h, 3.07, 0.075, 0.08, 36)
    for bay, line in enumerate(hall['bayLines'][:-1]):
        for i, (side, offset) in enumerate([(-1,2.28),(1,2.28),(-1,5.62),(1,5.62)]):
            name = f'EXHIBIT_{bay*4+i+1:02}'
            if name in wing_exhibits:
                continue
            if i < 3:
                frame_recess(side, h, line-offset)
            anchor(name, side*(h-0.18), 2.24, line-offset, -side*math.pi/2)
    anchor('EXHIBIT_FINALE', 0, 2.3, back+0.29, 0)


def set_world(color, strength):
    scene = bpy.context.scene
    scene.world = bpy.data.worlds.new('Room lighting')
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get('Background')
    background.inputs['Color'].default_value = (*color, 1)
    background.inputs['Strength'].default_value = strength


def aimed_light(name, kind, position, target, color, power, size):
    data = bpy.data.lights.new(name, kind)
    data.color, data.energy = color, power
    if kind == 'AREA':
        data.shape, data.size = 'DISK', size
    else:
        data.spot_size, data.spot_blend, data.shadow_soft_size = size, 0.8, 0.21
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = (position[0], -position[2], position[1])
    focus = Vector((target[0], -target[2], target[1]))
    obj.rotation_euler = (focus-obj.location).to_track_quat('-Z', 'Y').to_euler()
    return obj


def bake_gallery():
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 144
    scene.cycles.sample_clamp_indirect = 1.5
    scene.cycles.max_bounces = 5
    set_world((0.26, 0.35, 0.53), 0.1)
    warm, cool = (1, 0.74, 0.5), (0.62, 0.76, 1)
    lights = [aimed_light('Skylight spill', 'AREA', (0, 7.9, z), (0, 0, z), cool, 126, 3.1) for z in (1, -7, -15)]
    lights.append(aimed_light('Entry spill', 'AREA', (0, 4.8, 6.8), (0, 1.4, 1), warm, 62, 2.35))
    finale_z = -bpy.data.objects['EXHIBIT_FINALE'].location.y
    lights.append(aimed_light('Alcove ceiling spill', 'AREA', (0, 3.95, finale_z+1.45), (0, 0, finale_z+0.4), warm, 36, 1.15))
    hall = architecture['hall']
    for wing in hall['wings']:
        side = wing['side']
        center = side * (hall['halfWidth'] + wing['outerX']) / 2
        tint = warm if side < 0 else (0.77, 0.83, 1)
        for z in wing['doorZ']:
            lights.append(aimed_light('Side gallery spill', 'AREA', (center, 3.65, z), (side*hall['halfWidth'], 0.9, z), tint, 47, 1.44))
    # Picture lights stay with the runtime exhibits so empty anchors do not cast a spill.

    receivers = [bpy.data.objects[name] for name in ('Limestone', 'Warm Plaster', 'Trim', 'Deep Stone', 'Parquet', 'Vault')]
    bpy.ops.object.select_all(action='DESELECT')
    for obj in receivers:
        channel = obj.data.uv_layers.new(name='BakedLight', do_init=False)
        obj.data.uv_layers.active = channel
        for polygon in obj.data.polygons:
            polygon.select = True
        obj.select_set(True)
    bpy.context.view_layer.objects.active = receivers[0]
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(65), island_margin=0.0)
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(margin_method='FRACTION', margin=0.0035)
    bpy.ops.object.mode_set(mode='OBJECT')

    atlas = bpy.data.images.new('Gallery bounce', width=2048, height=2048, alpha=False, float_buffer=True)
    targets = []
    for obj in receivers:
        nodes = obj.active_material.node_tree.nodes
        target = nodes.new('ShaderNodeTexImage')
        target.image = atlas
        nodes.active = target
        targets.append((obj, nodes, target))
    # Keep albedo in the primary UV set and bake illumination alone on the secondary set.
    scene.render.bake.use_pass_direct = True
    scene.render.bake.use_pass_indirect = True
    scene.render.bake.use_pass_color = False
    bpy.ops.object.bake(type='DIFFUSE', uv_layer='BakedLight', margin=5, margin_type='EXTEND')
    scene.view_settings.view_transform = 'Standard'
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    atlas.save_render(str(output / 'gallery-light.png'), scene=scene)
    for obj, nodes, target in targets:
        nodes.remove(target)
        obj.data.uv_layers.active_index = 0
    for lamp in lights:
        bpy.data.objects.remove(lamp, do_unlink=True)


def render_courtyard_reflection():
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 16
    scene.cycles.use_denoising = True
    set_world((0.35, 0.46, 0.71), 0.75)
    for x in (-16, -8, 0, 8, 16):
        aimed_light('Façade uplight', 'SPOT', (x, 0.6, -12.6), (x, 6.8, -16.5), (1, 0.68, 0.43), 1400, 1.25)
    data = bpy.data.cameras.new('Pyramid reflection probe')
    data.type, data.panorama_type = 'PANO', 'EQUIRECTANGULAR'
    camera = bpy.data.objects.new(data.name, data)
    bpy.context.collection.objects.link(camera)
    camera.location = (0, -4.4, 2.9)
    camera.rotation_euler = Vector((1, 0, 0)).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = camera
    scene.view_settings.view_transform = 'Standard'
    scene.render.film_transparent = True
    scene.render.resolution_x, scene.render.resolution_y = 512, 256
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.filepath = str(output / 'courtyard-probe.png')
    bpy.ops.render.render(write_still=True)


def export(name, builder):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    parts.clear()
    materials.clear()
    material('Pavers', '958c7c', 0.91, texture='pavers')
    material('Limestone', 'b8aa97', 0.84, texture='limestone')
    material('Warm Plaster', 'bca48f', 0.82, texture='plaster')
    material('Parquet', '986b44', 0.58, texture='parquet')
    material('Trim', 'd3bd9d', 0.78)
    material('Deep Stone', '897564', 0.84)
    material('Vault', 'c3ad92', 0.83)
    material('Roof', '343c46', 0.76)
    material('Dark Glass', '222a33', 0.28, 0.18)
    material('Window Metal', '544334', 0.45, 0.31)
    material('Window Light', 'c98d53', 0.48, glow=0.33)
    material('Skylight', 'b2c4d7', 0.75, glow=0.63)
    material('Pool', '28414b', 0.2, 0.23)
    builder()
    build_meshes()
    if name == 'gallery':
        bake_gallery()
    bpy.ops.export_scene.gltf(filepath=str(output / f'{name}.glb'), export_format='GLB', export_yup=True)
    if name == 'courtyard':
        render_courtyard_reflection()


export('courtyard', courtyard)
export('gallery', gallery)
