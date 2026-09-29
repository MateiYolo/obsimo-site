import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

// A small 3D object in its own canvas that can be spun with a finger or the mouse and keeps some inertia.
// Subclasses add their mesh to `this.pivot`, call `this.ready(size)` once built, and say what happens when
// left alone in `settle(dt, t)`. Optional hooks: `released()` when the finger lifts, `update(dt, t)` every frame.
// Rendered only between start() and stop().
export class Spin3D {
  // fit: share of the canvas width / height the object's bounding box takes
  constructor(canvas, fit = { w: 0.94, h: 0.62 }) {
    this.canvas = canvas;
    this.fit = fit;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.6;
    const key = new THREE.DirectionalLight('#fff4e6', 2.6);
    key.position.set(-3, 4, 6);
    const rim = new THREE.DirectionalLight('#dfe8ff', 1.8);
    rim.position.set(4, 2, -4);
    this.scene.add(key, rim, new THREE.AmbientLight('#ffffff', 0.2));

    this.camera = new THREE.PerspectiveCamera(24, 1, 0.1, 100);
    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);

    this.rot = new THREE.Vector2(); // x = tilt, y = spin
    this.vel = new THREE.Vector2();
    this.held = false;
    this.running = false;
    this.clock = new THREE.Timer();

    this.attach();
    new ResizeObserver(() => this.resize()).observe(canvas);
  }

  ready(size) {
    this.size = size;
    this.resize();
    this.canvas.classList.add('ready');
  }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    if (this.size) {
      const fitW = this.size.x / this.fit.w, fitH = this.size.y / this.fit.h;
      const halfV = Math.max(fitH, fitW / this.camera.aspect) / 2;
      this.camera.position.set(0, 0, halfV / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
    }
    this.camera.updateProjectionMatrix();
  }

  attach() {
    let last = null;
    const el = this.canvas;
    el.addEventListener('pointerdown', (e) => {
      last = { x: e.clientX, y: e.clientY, t: performance.now() };
      this.held = true;
      this.vel.set(0, 0);
      if (e.pointerType === 'mouse') try { el.setPointerCapture(e.pointerId); } catch {}
    });
    el.addEventListener('pointermove', (e) => {
      if (!last) return;
      const now = performance.now();
      const dt = Math.max((now - last.t) / 1000, 1 / 120);
      const k = 0.009;
      const dx = (e.clientX - last.x) * k, dy = (e.clientY - last.y) * k;
      this.rot.y += dx;
      this.rot.x += dy;
      this.vel.set(dy / dt, dx / dt);
      last = { x: e.clientX, y: e.clientY, t: now };
    });
    const end = () => {
      last = null;
      this.held = false;
      this.vel.clampLength(0, 14);
      this.released();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.reset?.();
    const tick = () => {
      if (!this.running) return;
      requestAnimationFrame(tick);
      this.frame();
    };
    tick();
  }
  stop() { this.running = false; }

  settle() {}
  released() {}
  update() {}

  frame() {
    this.clock.update();
    const dt = Math.min(this.clock.getDelta(), 1 / 20);
    const t = this.clock.getElapsed();
    if (!this.held) {
      this.rot.x += this.vel.x * dt;
      this.rot.y += this.vel.y * dt;
      this.vel.multiplyScalar(Math.exp(-2.2 * dt));
      if (this.vel.length() < 1.2) this.settle(dt, t);
    }
    this.update(dt, t);
    // a slow breathing sway so it looks alive
    this.pivot.rotation.set(this.rot.x + Math.sin(t * 0.7) * 0.06, this.rot.y + Math.sin(t * 0.5) * 0.14, 0);
    this.renderer.render(this.scene, this.camera);
  }
}
