#!/bin/sh
# Builds public/neo-slim.glb (the rooftop's Neo) from public/neo.glb. Run from the repo root: sh rooftop/slim-neo.sh
# 2026-10-22: 1.48 MB → 480 KB; 30k → 15k triangles; base colour 1024, normal + metal/rough 512, AVIF; walk clip dropped
# (the rooftop only plays neo_sit and neo_idle). Rig, skin weights and the two clips are kept; compared side by side.
# drop-anim.mjs needs @gltf-transform/core, /extensions, /functions and meshoptimizer installed where node can find
# them (e.g. `npm i` them in a scratch folder and run the script from there); everything else runs through npx.
set -e
T=$(mktemp -d)
g() { npx -y @gltf-transform/cli@4 "$@"; }
g resize public/neo.glb "$T/a.glb" --width 1024 --height 1024
g weld "$T/a.glb" "$T/b.glb"
g simplify "$T/b.glb" "$T/c.glb" --ratio 0.5 --error 0.004
g resize "$T/c.glb" "$T/d.glb" --width 512 --height 512 --pattern "*_0_3"                # normal map
g resize "$T/d.glb" "$T/e.glb" --width 512 --height 512 --pattern "neo_rawv2_metallic*" # metal/roughness
g avif "$T/e.glb" "$T/f.glb" --quality 62 --effort 60
node rooftop/drop-anim.mjs "$T/f.glb" "$T/g.glb" neo_slow_walk
g meshopt "$T/g.glb" public/neo-slim.glb --level high
g validate public/neo-slim.glb
