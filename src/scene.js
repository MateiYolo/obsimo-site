import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildModel } from './models.js';

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const AUTO_SPIN = 0.32; // rad/s, the slow idle turn
const Y = new THREE.Vector3(0, 1, 0);
const X = new THREE.Vector3(1, 0, 0);
const Z = new THREE.Vector3(0, 0, 1);
const qTmp = new THREE.Quaternion();

// One fixed WebGL canvas for the whole site. Every product follows an empty DOM "slot" in the scrolling page,
// so scrolling stays native (and silky on phones) while the 3D is drawn behind it.
export class Stage {
  constructor(canvas, products, slots) {
    const mobile = matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 2 : 1.75));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.localClippingEnabled = true; // records are clipped at their sleeve's opening

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
      const pivot = new THREE.Group(); // placement on screen
      const orient = new THREE.Group(); // spin + user rotation
      orient.add(m.root);
      pivot.add(orient);
      this.scene.add(pivot);
      return {
        p, m, pivot, orient, slot: slots[i],
        spin: i * 1.3, // idle turn angle (vertical axis)
        tilt: new THREE.Quaternion(), // what the user added on top (x / z), eases back to upright
        vel: new THREE.Vector3(), // angular velocity after a flick (x, y, z) in rad/s
        held: false, lastTouch: -1e9, focus: 0,
      };
    });

    this.active = -1; // product shown in the detail page
    this.detail = 0;
    this.detailTarget = 0;
    this.detailScroll = 0;
    this.scrollVel = 0;
    this.lastScroll = scrollY;
    this.playing = false;
    this.clock = new THREE.Timer();

    this.resize();
    addEventListener('resize', () => this.resize());
  }

  // Compiles the shaders of everything in the scene in the background (KHR_parallel_shader_compile when available).
  compile() {
    return this.renderer.compileAsync(this.scene, this.camera);
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.visH = 2 * this.camera.position.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.visW = this.visH * this.camera.aspect;
    this.portrait = w < 820 || h > w;
  }

  // ---- interaction: called by main.js with pixel deltas ----
  grab(i) {
    const it = this.items[i];
    if (!it) return;
    it.held = true;
    it.vel.set(0, 0, 0);
  }
  rotate(i, dx, dy, twist = 0, dt = 1 / 60) {
    const it = this.items[i];
    if (!it) return;
    const k = 0.0085;
    it.spin += dx * k; // horizontal drag = the same axis as the idle turn
    qTmp.setFromAxisAngle(X, dy * k);
    it.tilt.premultiply(qTmp);
    if (twist) it.tilt.premultiply(qTmp.setFromAxisAngle(Z, -twist));
    it.vel.set(dy * k, dx * k, -twist).divideScalar(Math.max(dt, 1 / 120));
    it.lastTouch = performance.now();
  }
  release(i) {
    const it = this.items[i];
    if (!it) return;
    it.held = false;
    it.lastTouch = performance.now();
    it.vel.clampLength(0, 9);
  }

  // Which product is closest to the middle of the screen.
  get centred() {
    let best = -1, bd = Infinity;
    this.items.forEach((it, i) => {
      const r = it.slot.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - this.h / 2);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  frame() {
    this.clock.update();
    const dt = Math.min(this.clock.getDelta(), 1 / 20);
    const t = this.clock.getElapsed();
    const now = performance.now();
    this.detail = damp(this.detail, this.detailTarget, 5.5, dt);
    const d = this.detail;
    const ease = d * d * (3 - 2 * d);

    // a little tilt from scroll speed makes the list feel physical
    const sv = (scrollY - this.lastScroll) / Math.max(dt, 1e-3);
    this.lastScroll = scrollY;
    this.scrollVel = damp(this.scrollVel, clamp(sv / 3000, -0.25, 0.25), 6, dt);

    const wpp = this.visH / this.h; // world units per CSS pixel
    const detailSize = this.portrait ? Math.min(this.visH * 0.26, this.visW * 0.62) : Math.min(this.visH * 0.52, this.visW * 0.3);
    const detailX = this.portrait ? 0 : -this.visW * 0.25;
    const detailY = this.portrait ? (0.5 - 0.245) * this.visH + this.detailScroll * wpp : 0;
    const centred = this.centred;

    this.items.forEach((it, i) => {
      const r = it.slot.getBoundingClientRect();
      const onScreen = r.bottom > -r.height * 0.5 && r.top < this.h + r.height * 0.5;
      const isActive = i === this.active;

      // position from the DOM slot
      let x = (r.left + r.width / 2 - this.w / 2) * wpp;
      let y = -(r.top + r.height / 2 - this.h / 2) * wpp;
      let size = Math.min(r.width, r.height) * wpp;
      // grows a little as it reaches the middle of the screen
      const mid = 1 - clamp(Math.abs(r.top + r.height / 2 - this.h / 2) / this.h, 0, 1);
      size *= 0.82 + 0.18 * mid;

      if (isActive) {
        x += (detailX - x) * ease;
        y += (detailY - y) * ease;
        size += (detailSize - size) * ease;
      } else {
        size *= 1 - ease; // the others shrink away
        y -= ease * this.visH * 0.15;
      }
      it.pivot.visible = (onScreen || isActive) && size > 0.01;
      if (!it.pivot.visible) return;
      it.pivot.position.set(x, y, 0);
      it.pivot.scale.setScalar(size);

      // rotation: idle turn + user tilt, flick inertia, then back to upright
      const idle = now - it.lastTouch > 1400;
      if (!it.held) {
        it.spin += it.vel.y * dt;
        qTmp.setFromAxisAngle(X, it.vel.x * dt);
        it.tilt.premultiply(qTmp);
        if (it.vel.z) it.tilt.premultiply(qTmp.setFromAxisAngle(Z, it.vel.z * dt));
        it.vel.multiplyScalar(Math.exp(-2.4 * dt));
        it.spin += AUTO_SPIN * dt * clamp((now - it.lastTouch - 600) / 1500, 0, 1);
        if (idle) it.tilt.slerp(qTmp.identity(), 1 - Math.exp(-1.6 * dt));
      }
      it.orient.quaternion.setFromAxisAngle(Y, it.spin).premultiply(it.tilt);
      qTmp.setFromAxisAngle(X, this.scrollVel * (1 - ease));
      it.orient.quaternion.premultiply(qTmp);
      it.orient.position.y = Math.sin(t * 0.9 + i) * 0.015; // float

      it.focus = damp(it.focus, (this.active >= 0 ? isActive : i === centred) ? 1 : 0, 4, dt);
      it.m.update(dt, { focus: it.focus, detail: isActive ? ease : 0, playing: this.playing });
    });

    this.renderer.render(this.scene, this.camera);
  }
}
