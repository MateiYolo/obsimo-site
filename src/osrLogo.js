import * as THREE from 'three';
import { Spin3D, damp } from './spin3d.js';

// The OSR Records logo at the top of the contact page, drawn flat like the printed one (circle, ellipse, the axis
// from the top down to the centre, the short line under the ellipse) with round strokes, the same material as the
// tour title. Spins with a finger or the mouse, then comes back to face the reader.
const RY = 0.507; // ellipse height / circle height on the logo

export class OsrLogo extends Spin3D {
  constructor(canvas) {
    super(canvas, { w: 0.62, h: 0.84 });
    const mat = new THREE.MeshStandardMaterial({ color: '#eceae4', roughness: 0.32, metalness: 0.15 });
    const tube = 0.026;
    const ellipse = (ry) => {
      const pts = new THREE.EllipseCurve(0, 0, 1, ry).getSpacedPoints(128).map((p) => new THREE.Vector3(p.x, p.y, 0));
      return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 200, tube, 8, true), mat);
    };
    const cap = new THREE.SphereGeometry(tube, 8, 6); // rounded ends, like the drawn strokes
    const line = (y0, y1) => {
      const a = new THREE.Vector3(0, y0, 0), b = new THREE.Vector3(0, y1, 0);
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(a, b), 1, tube, 8), mat);
      for (const p of [a, b]) mesh.add(new THREE.Mesh(cap, mat).translateY(p.y));
      return mesh;
    };
    this.pivot.add(ellipse(1), ellipse(RY), line(1, 0), line(-RY, -1));
    this.ready(new THREE.Vector3(2 + tube * 2, 2 + tube * 2, 0));
  }

  // back to the nearest full turn, facing the reader
  settle(dt) {
    this.rot.y = damp(this.rot.y, Math.round(this.rot.y / (Math.PI * 2)) * Math.PI * 2, 2.2, dt);
    this.rot.x = damp(this.rot.x, Math.round(this.rot.x / (Math.PI * 2)) * Math.PI * 2, 2.2, dt);
  }
}
