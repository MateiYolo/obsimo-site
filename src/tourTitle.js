import * as THREE from 'three';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { Spin3D, damp } from './spin3d.js';

// The "Tour" heading as extruded 3D letters that can be spun with a finger or the mouse, then settle back
// to face the reader. The glyphs come from public/assets/tour-title.typeface.json (Space Grotesk SemiBold,
// only T O U R). Rendered only while the tour page is open.
export class TourTitle extends Spin3D {
  constructor(canvas) {
    super(canvas);
    fetch('/assets/tour-title.typeface.json')
      .then((r) => r.json())
      .then((json) => this.build(new Font(json)));
  }

  build(font) {
    const geo = new TextGeometry('TOUR', {
      font, size: 1, depth: 0.32, curveSegments: 10,
      bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.022, bevelSegments: 4,
    });
    geo.center();
    geo.computeBoundingBox();
    const mat = new THREE.MeshStandardMaterial({ color: '#eceae4', roughness: 0.32, metalness: 0.15 });
    this.pivot.add(new THREE.Mesh(geo, mat));
    // the word fills the canvas width, with room around it for the letters' depth when turned
    this.ready(geo.boundingBox.getSize(new THREE.Vector3()));
  }

  // once the flick has died down, come back to the nearest full turn so the word reads again
  settle(dt) {
    this.rot.y = damp(this.rot.y, Math.round(this.rot.y / (Math.PI * 2)) * Math.PI * 2, 2.2, dt);
    this.rot.x = damp(this.rot.x, Math.round(this.rot.x / (Math.PI * 2)) * Math.PI * 2, 2.2, dt);
  }
}
