import * as THREE from 'three';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { Spin3D, damp } from './spin3d.js';

// The "Tour" heading as extruded 3D letters that can be spun with a finger or the mouse, then settle back
// to face the reader. The glyphs come from public/assets/tour-title.typeface.json (Space Grotesk SemiBold,
// only T O U R). Rendered only while the tour page is open.
// Easter egg: spin it fast for a few seconds and the letters turn green, then `onSecret` fires. They stay green
// while `lit` is set (the secret track playing).
const SECRET_SPEED = 7; // rad/s the word has to turn at to charge
const SECRET_TIME = 3; // seconds of fast spinning needed
const FLICK_BONUS = 0.3; // extra charge for each fast flick, so repeated flicks get there as quickly as holding
const WHITE = new THREE.Color('#eceae4');
const GREEN = new THREE.Color('#0fc24a'); // darker than it looks: tone mapping and the glow lighten it

export class TourTitle extends Spin3D {
  constructor(canvas) {
    super(canvas);
    this.prevRot = new THREE.Vector2();
    this.charge = 0; // seconds spent spinning fast, drains when it slows down
    this.flash = 0;
    this.onSecret = null;
    this.lit = false;
    this.glow = 0;

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
    this.mat = new THREE.MeshStandardMaterial({ color: WHITE, roughness: 0.32, metalness: 0.15, emissive: GREEN, emissiveIntensity: 0 });
    this.pivot.add(new THREE.Mesh(geo, this.mat));
    // the word fills the canvas width, with room around it for the letters' depth when turned
    this.ready(geo.boundingBox.getSize(new THREE.Vector3()));
  }

  // once the flick has died down, come back to the nearest full turn so the word reads again
  settle(dt) {
    this.rot.y = damp(this.rot.y, Math.round(this.rot.y / (Math.PI * 2)) * Math.PI * 2, 2.2, dt);
    this.rot.x = damp(this.rot.x, Math.round(this.rot.x / (Math.PI * 2)) * Math.PI * 2, 2.2, dt);
  }

  // a flung spin only stays fast for a moment, so each flick counts extra
  released() {
    if (this.vel.length() > SECRET_SPEED) this.charge += FLICK_BONUS;
  }

  // how fast the word turned since the last frame, whether dragged or flung
  update(dt) {
    const speed = this.rot.distanceTo(this.prevRot) / dt;
    this.prevRot.copy(this.rot);
    if (speed > SECRET_SPEED) this.charge += dt;
    else this.charge = Math.max(0, this.charge - dt * 0.6);
    if (this.charge >= SECRET_TIME) {
      this.charge = 0;
      this.flash = 1;
      this.vel.y += 30; // one last big whirl
      this.onSecret?.();
    }
    this.flash = Math.max(0, this.flash - dt * 0.8);
    // 0 = white, 1 = fully green; eased so the change is quick to notice once it starts
    const target = this.lit ? 1 : Math.min(this.charge / SECRET_TIME, 1) ** 0.7;
    this.glow = damp(this.glow, target, 8, dt);
    if (this.mat) {
      this.mat.color.lerpColors(WHITE, GREEN, this.glow);
      this.mat.emissiveIntensity = this.glow * 0.3 + this.flash * 1.2;
    }
  }
}
