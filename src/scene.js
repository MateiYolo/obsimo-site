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
const vTmp = new THREE.Vector3();

// One WebGL canvas for the whole site. Every product follows an empty DOM "slot" in the scrolling page, so scrolling
// stays native. The canvas scrolls with the page and is put back around the screen on each drawn frame: between two
// frames (iOS Safari scrolls on its own thread, and a frame can come late) the objects move with the page, in step
// with the finger, instead of trailing behind it.
export class Stage {
  constructor(canvas, products, slots) {
    const mobile = matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.dpr = Math.min(devicePixelRatio, mobile ? 2 : 1.75);
    this.renderer.setPixelRatio(this.dpr);
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
        spin: m.faceFront ? 0 : i * 1.3, // idle turn angle (vertical axis)
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
    this.scroll = this.lastScroll = scrollY;
    this.canvasTop = null;
    this.playing = false;
    this.clock = new THREE.Timer();
    this.rects = [];
    this.centred = -1; // which product is closest to the middle of the screen
    this.slow = [];
    this.inView = 1; // objects drawn last frame (the first frame always draws: it replaces the warm-up render)

    this.resize();
    addEventListener('resize', () => this.resize());
  }

  // Uploads every texture to the GPU, then compiles the shaders of everything in the scene in the background
  // (KHR_parallel_shader_compile when available). Without this, each object would stall the page for its textures
  // and geometry the first time it is drawn: on the first frame, or while scrolling for the ones further down.
  async compile(onProgress = () => {}) {
    const textures = new Set();
    this.scene.traverse((o) => {
      for (const m of [o.material].flat()) if (m) for (const v of Object.values(m)) if (v?.isTexture && v.image) textures.add(v);
    });
    let i = 0;
    for (const t of textures) {
      this.renderer.initTexture(t);
      onProgress((++i / textures.size) * 0.8);
      await new Promise((r) => setTimeout(r)); // one upload per task: the page stays responsive
    }
    await this.renderer.compileAsync(this.scene, this.camera);
    onProgress(1);
    this.renderer.render(this.scene, this.camera); // everything at once, behind the loader: uploads the geometries
  }

  // The canvas is sized on the large viewport (CSS 150lvh, the screen plus 25lvh above and below): the toolbar of
  // mobile browsers comes and goes as the page scrolls, which only changes the visible height (vh), not the drawing
  // buffer, so nothing is reallocated mid-scroll.
  resize() {
    this.vh = innerHeight;
    this.portrait = innerWidth < 820 || innerHeight > innerWidth;
    const c = this.renderer.domElement;
    const w = c.clientWidth || innerWidth, h = c.clientHeight || innerHeight * 1.5;
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this.ov = h / 6; // overscan above (and below) the screen, in CSS pixels
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // wider field for the taller canvas: the screen part keeps the 30° framing and perspective it had when fixed
    this.camera.fov = 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(15)) * h / (h - 2 * this.ov)));
    this.camera.updateProjectionMatrix();
    this.visH = 2 * this.camera.position.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.visW = this.visH * this.camera.aspect;
    this.screenH = this.visH * (h - 2 * this.ov) / h; // the screen's height, in world units
  }

  // Safety net for slow GPUs: when frames keep taking over 40 ms (under 25 fps), draw at a lower resolution, a step
  // at a time, never below 1. A browser capping at 30 fps (iOS low power mode) stays above the threshold.
  adapt(dt) {
    if (this.dpr <= 1 || dt > 0.25) return; // a tab switch or a one-off hitch says nothing about the GPU
    this.slow.push(dt);
    if (this.slow.length < 90) return;
    const median = this.slow.sort((a, b) => a - b)[45];
    this.slow.length = 0;
    if (median < 0.04) return;
    this.dpr = Math.max(1, this.dpr - 0.25);
    this.renderer.setPixelRatio(this.dpr);
  }

  // ---- interaction: called by main.js with pixel deltas ----
  grab(i) {
    const it = this.items[i];
    if (!it) return;
    it.held = true;
    it.home = false;
    it.vel.set(0, 0, 0);
  }
  // Product opened: the object glides back to its default pose (front towards the viewer, upright) and waits there
  // until the user turns it again.
  home(i) {
    const it = this.items[i];
    if (!it) return;
    it.home = true;
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
    // smoothed: with fast touch screens a single noisy event would otherwise decide the flick
    it.vel.lerp(vTmp.set(dy * k, dx * k, -twist).divideScalar(Math.max(dt, 1 / 120)), 0.5);
    it.lastTouch = performance.now();
  }
  release(i, still = false) {
    const it = this.items[i];
    if (!it) return;
    it.held = false;
    if (still) it.vel.set(0, 0, 0);
    it.lastTouch = performance.now();
    it.vel.clampLength(0, 9);
  }

  // Reads where the slots are (the only layout read of a frame) and which one is closest to the middle of the screen.
  measure() {
    this.scroll = scrollY; // read with the rects: the frame is drawn for this scroll position
    let bd = Infinity;
    this.items.forEach((it, i) => {
      const r = (this.rects[i] = it.slot.getBoundingClientRect());
      const d = Math.abs(r.top + r.height / 2 - this.vh / 2);
      if (d < bd) { bd = d; this.centred = i; }
    });
  }

  frame() {
    this.measure();
    this.clock.update();
    const raw = this.clock.getDelta();
    this.adapt(raw);
    const dt = Math.min(raw, 1 / 20);
    const t = this.clock.getElapsed();
    const now = performance.now();
    this.detail = damp(this.detail, this.detailTarget, 5.5, dt);
    const d = this.detail;
    const ease = d * d * (3 - 2 * d);

    // a little tilt from scroll speed makes the list feel physical
    const sv = (this.scroll - this.lastScroll) / Math.max(dt, 1e-3);
    this.lastScroll = this.scroll;
    this.scrollVel = damp(this.scrollVel, clamp(sv / 3000, -0.25, 0.25), 6, dt);

    const wpp = this.visH / this.h; // world units per CSS pixel
    const ov = this.ov; // the screen's top, in canvas pixels
    // phones: in the hero, a quarter of the way down the visible screen
    const detailSize = this.portrait ? Math.min(this.vh * wpp * 0.26, this.visW * 0.62) : Math.min(this.screenH * 0.52, this.visW * 0.3);
    const detailX = this.portrait ? 0 : -this.visW * 0.25;
    const detailY = this.portrait ? (this.h / 2 - ov - 0.245 * this.vh + this.detailScroll) * wpp : 0;
    const centred = this.centred;
    let inView = 0;

    this.items.forEach((it, i) => {
      const r = this.rects[i];
      const onScreen = r.bottom > -ov - r.height * 0.5 && r.top < this.h - ov + r.height * 0.5; // or in the overscan
      const isActive = i === this.active;

      // position from the DOM slot
      let x = (r.left + r.width / 2 - this.w / 2) * wpp;
      let y = -(r.top + ov + r.height / 2 - this.h / 2) * wpp;
      let size = Math.min(r.width, r.height) * wpp;
      // grows a little as it reaches the middle of the screen
      const mid = 1 - clamp(Math.abs(r.top + r.height / 2 - this.vh / 2) / this.vh, 0, 1);
      size *= 0.82 + 0.18 * mid;

      if (isActive) {
        x += (detailX - x) * ease;
        y += (detailY - y) * ease;
        size += (detailSize - size) * ease;
      } else {
        size *= 1 - ease; // the others shrink away
        y -= ease * this.screenH * 0.15;
      }
      it.pivot.visible = (onScreen || isActive) && size > 0.01;
      if (!it.pivot.visible) return;
      it.pivot.position.set(x, y, 0);
      it.pivot.scale.setScalar(size);
      if (Math.abs(x) < this.visW / 2 + size && Math.abs(y) < this.visH / 2 + size) inView++;

      // rotation: idle turn + user tilt, flick inertia, then back to upright
      const idle = now - it.lastTouch > 1400;
      if (!isActive) it.home = false;
      if (it.home) {
        it.spin = damp(it.spin, Math.round(it.spin / (2 * Math.PI)) * 2 * Math.PI, 5, dt);
        it.tilt.slerp(qTmp.identity(), 1 - Math.exp(-5 * dt));
      } else if (!it.held) {
        it.spin += it.vel.y * dt;
        qTmp.setFromAxisAngle(X, it.vel.x * dt);
        it.tilt.premultiply(qTmp);
        if (it.vel.z) it.tilt.premultiply(qTmp.setFromAxisAngle(Z, it.vel.z * dt));
        it.vel.multiplyScalar(Math.exp(-2.4 * dt));
        if (!it.m.faceFront) it.spin += AUTO_SPIN * dt * clamp((now - it.lastTouch - 600) / 1500, 0, 1);
        // wide objects (the bundle) don't turn on their own: left alone, they come back to face the viewer
        else if (idle) it.spin = damp(it.spin, Math.round(it.spin / (2 * Math.PI)) * 2 * Math.PI, 1.6, dt);
        if (idle) it.tilt.slerp(qTmp.identity(), 1 - Math.exp(-1.6 * dt));
      }
      it.orient.quaternion.setFromAxisAngle(Y, it.spin).premultiply(it.tilt);
      qTmp.setFromAxisAngle(X, this.scrollVel * (1 - ease));
      it.orient.quaternion.premultiply(qTmp);
      it.orient.position.y = Math.sin(t * 0.9 + i) * 0.015; // float

      it.focus = damp(it.focus, (this.active >= 0 ? isActive : i === centred) ? 1 : 0, 4, dt);
      it.m.update(dt, { focus: it.focus, detail: isActive ? ease : 0, playing: this.playing });
    });

    // nothing on screen (a product page scrolled past its object): the canvas is left as it is, one last draw clears
    // it, then the GPU rests and so does the compositor (no blur to redo behind the buy bar every frame)
    if (inView || this.inView) {
      this.renderer.render(this.scene, this.camera);
      // moved in the same frame as it is drawn, so the browser shows both together
      const top = this.scroll - ov;
      if (top !== this.canvasTop) {
        this.canvasTop = top;
        this.renderer.domElement.style.transform = `translate3d(0, ${top}px, 0)`;
      }
    }
    this.inView = inView;
  }
}
