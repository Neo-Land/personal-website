// Drop named animations from a glTF and prune what they leave behind. Usage: node drop-anim.mjs in.glb out.glb name...
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
const [, , inp, out, ...names] = process.argv;
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(inp);
for (const a of doc.getRoot().listAnimations()) if (names.includes(a.getName())) { console.log('dropping', a.getName()); a.dispose(); }
await doc.transform(prune());
await io.write(out, doc);
console.log('kept:', doc.getRoot().listAnimations().map((a) => a.getName()).join(', '));
