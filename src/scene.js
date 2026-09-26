import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildModel } from './models.js';

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// One WebGL canvas for the whole site. Products sit in a row; `pos` (a float index) says which one is centred.
export class Stage {
  constructor(canvas, products) {
    this.canvas = canvas;
    const mobile = matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 2 : 1.75));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;

    const key = new THREE.DirectionalLight('#fff4e6', 2.4);
    key.position.set(-3, 4, 6);
    const rim = new THREE.DirectionalLight('#dfe8ff', 1.6);
    rim.position.set(4, 2, -4);
    this.scene.add(key, rim, new THREE.AmbientLight('#ffffff', 0.15));

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    this.camera.position.set(0, 0, 12);

    this.items = products.map((p, i) => {
      const m = buildModel(p);
      const pivot = new THREE.Group(); // carousel placement
      const turn = new THREE.Group(); // user / idle rotation
      turn.add(m.root);
      pivot.add(turn);
      this.scene.add(pivot);
      return { p, m, pivot, turn, spinY: 0, spinV: 0, focus: i === 0 ? 1 : 0, phase: i * 1.7 };
    });

    this.pos = 0;
    this.detail = 0; // 0 home → 1 detail page
    this.detailTarget = 0;
    this.scrollPx = 0;
    this.pointer = new THREE.Vector2();
    this.tilt = new THREE.Vector2();
    this.playing = false;
    this.raycaster = new THREE.Raycaster();
    this.clock = new THREE.Clock();

    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const visH = 2 * this.camera.position.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const visW = visH * this.camera.aspect;
    const portrait = w < 820 || h > w;
    this.portrait = portrait;
    this.visW = visW; this.visH = visH;
    this.pxPerWorld = h / visH;
    // product size in world units, and where it sits on screen
    if (portrait) {
      this.size = Math.min(visW * 0.8, visH * 0.4);
      this.spacing = visW / 2 + this.size * 0.2; // neighbours peek in at the edges
      this.homeY = (0.5 - 0.47) * visH;
    } else {
      this.size = Math.min(visH * 0.46, visW * 0.3);
      this.spacing = Math.max(this.size * 1.35, Math.min(visW * 0.3, this.size * 1.9));
      this.homeY = (0.5 - 0.5) * visH;
    }
  }

  // Width of one step of the carousel in screen pixels (used to map a drag to `pos`).
  get stepPx() {
    return this.spacing * this.pxPerWorld;
  }

  pick(clientX, clientY) {
    const ndc = new THREE.Vector2((clientX / this.w) * 2 - 1, -(clientY / this.h) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    let best = null;
    this.items.forEach((it, i) => {
      const hit = this.raycaster.intersectObject(it.pivot, true)[0];
      if (hit && (!best || hit.distance < best.d)) best = { i, d: hit.distance };
    });
    return best ? best.i : -1;
  }

  // Drag to turn the product in the detail page.
  spinBy(dxPx) {
    const it = this.items[Math.round(this.pos)];
    if (!it) return;
    it.spinY += dxPx * 0.012;
    it.spinV = dxPx * 0.012 * 60;
  }
  frame() {
    const dt = Math.min(this.clock.getDelta(), 1 / 20);
    const t = this.clock.elapsedTime;
    this.detail = damp(this.detail, this.detailTarget, 6, dt);
    this.tilt.x = damp(this.tilt.x, this.pointer.x, 3, dt);
    this.tilt.y = damp(this.tilt.y, this.pointer.y, 3, dt);
    const d = this.detail;
    const ease = d * d * (3 - 2 * d);
    const scrollWorld = this.scrollPx / this.pxPerWorld;

    // detail layout: phone → object shrinks to the top; desktop → object moves to the left column
    const detailScale = this.portrait ? Math.min(this.visH * 0.23, this.visW * 0.5) / this.size : 1.1;
    const detailX = this.portrait ? 0 : -this.visW * 0.24;
    const detailY = this.portrait ? (0.5 - 0.255) * this.visH + scrollWorld : 0;

    this.items.forEach((it, i) => {
      const o = i - this.pos;
      const a = Math.abs(o);
      const near = clamp(1 - a, 0, 1);
      it.focus = damp(it.focus, a < 0.5 ? 1 : 0, 4, dt);
      const s = Math.sign(o);

      let x = o * this.spacing;
      let y = this.homeY;
      let z = -Math.min(a, 1.5) * this.size * 0.9;
      let sc = this.size * (0.72 + 0.28 * near);
      // neighbours leave the screen while the detail page is open
      x += s * ease * this.visW * 0.7;
      // the centred one travels to its detail spot
      x = x * (1 - ease * near) + detailX * ease * near;
      y = y * (1 - ease * near) + detailY * ease * near;
      sc *= 1 + (detailScale - 1) * ease * near;
      it.pivot.position.set(x, y, z);
      it.pivot.scale.setScalar(sc);
      it.pivot.visible = a < 3.2;

      // rotation: neighbours face the centre, the focused one follows the pointer and sways gently
      if (Math.abs(it.spinV) > 0.01 && !this.dragging) {
        it.spinY += it.spinV * dt;
        it.spinV = damp(it.spinV, 0, 2.5, dt);
      }
      if (ease < 0.05) it.spinY = damp(it.spinY, 0, 3, dt); // back to front when returning home
      const sway = Math.sin(t * 0.6 + it.phase) * 0.12;
      it.pivot.rotation.y = clamp(-o * 0.55, -0.9, 0.9);
      it.turn.rotation.y = sway * (1 - ease) + it.spinY + this.tilt.x * 0.25 * near;
      it.turn.rotation.x = -this.tilt.y * 0.12 * near + Math.sin(t * 0.8 + it.phase) * 0.025;
      it.turn.position.y = Math.sin(t * 0.9 + it.phase) * 0.02; // float

      it.m.update(dt, { focus: it.focus, detail: ease * near, playing: this.playing });
    });

    this.renderer.render(this.scene, this.camera);
  }
}
