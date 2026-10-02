// Läuft im Browser (über scripts/baum.mjs): erzeugt einen EZ-Tree und exportiert ihn als GLB.
import * as THREE from 'three';
import { Tree } from '@dgreenheck/ez-tree';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

window.exportiere = async (einstellungen) => {
  const tree = new Tree();
  tree.loadPreset(einstellungen.preset);
  Object.assign(tree.options, { seed: einstellungen.seed });
  // Budget: keine Rindentexturen, weniger Ringe und Nadelkarten
  tree.options.bark.textured = false;
  tree.options.bark.flatShading = true;
  tree.options.branch.sections = { 0: 6, 1: 4, 2: 3, 3: 3 };
  tree.options.branch.segments = { 0: 5, 1: 3, 2: 3, 3: 3 };
  tree.options.leaves.count = einstellungen.blaetter;
  tree.options.leaves.size = einstellungen.blattgroesse; // weniger, dafür größere Nadelkarten
  tree.options.branch.children = { ...tree.options.branch.children, 0: einstellungen.aeste };
  tree.generate();

  // Wind-Shader und Trellis gehören nicht ins Modell
  const gruppe = new THREE.Group();
  const aeste = new THREE.Mesh(tree.branchesMesh.geometry, new THREE.MeshStandardMaterial({ color: 0x6f5440, roughness: 1, flatShading: true }));
  aeste.name = 'aeste';
  const altBlatt = tree.leavesMesh.material;
  // EZ-Tree lädt die Nadeltextur asynchron: ohne Warten exportiert man durchsichtige Karten
  for (let i = 0; i < 200 && !(altBlatt.map?.image?.complete && altBlatt.map.image.naturalWidth); i++) {
    await new Promise((r) => setTimeout(r, 50));
  }
  if (!altBlatt.map?.image?.naturalWidth) throw new Error('Nadeltextur nicht geladen');
  const blaetter = new THREE.Mesh(
    tree.leavesMesh.geometry,
    new THREE.MeshStandardMaterial({ map: altBlatt.map, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 1 }),
  );
  blaetter.name = 'blaetter';
  gruppe.add(aeste, blaetter);

  const box = new THREE.Box3().setFromObject(gruppe);
  const glb = await new GLTFExporter().parseAsync(gruppe, { binary: true, maxTextureSize: 256 });
  const bytes = new Uint8Array(glb);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return {
    glb: btoa(bin),
    dreiecke: tree.triangleCount,
    hoehe: box.max.y - box.min.y,
    breite: Math.max(box.max.x - box.min.x, box.max.z - box.min.z),
  };
};
window.bereit = true;
