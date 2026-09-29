import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

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

export class TourTitle {
  constructor(canvas) {
    this.canvas = canvas;
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
    this.prevRot = new THREE.Vector2();
    this.charge = 0; // seconds spent spinning fast, drains when it slows down
    this.flash = 0;
    this.onSecret = null;
    this.lit = false;
    this.glow = 0;

    fetch('/assets/tour-title.typeface.json')
      .then((r) => r.json())
      .then((json) => this.build(new Font(json)));
    this.attach();
    new ResizeObserver(() => this.resize()).observe(canvas);
  }

  build(font) {
    const geo = new TextGeometry('TOUR', {
      font, size: 1, depth: 0.32, curveSegments: 10,
      bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.022, bevelSegments: 4,
    });
    geo.center();
    geo.computeBoundingBox();
    this.size = geo.boundingBox.getSize(new THREE.Vector3());
    this.mat = new THREE.MeshStandardMaterial({ color: WHITE, roughness: 0.32, metalness: 0.15, emissive: GREEN, emissiveIntensity: 0 });
    this.pivot.add(new THREE.Mesh(geo, this.mat));
    this.resize();
    this.canvas.classList.add('ready');
  }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    if (this.size) {
      // the word fills the canvas width, with room around it for the letters' depth when turned
      const fitW = this.size.x / 0.94, fitH = this.size.y / 0.62;
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
      // a flung spin only stays fast for a moment, so each flick counts extra
      if (this.vel.length() > SECRET_SPEED) this.charge += FLICK_BONUS;
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

  frame() {
    this.clock.update();
    const dt = Math.min(this.clock.getDelta(), 1 / 20);
    const t = this.clock.getElapsed();
    if (!this.held) {
      this.rot.x += this.vel.x * dt;
      this.rot.y += this.vel.y * dt;
      this.vel.multiplyScalar(Math.exp(-2.2 * dt));
      // once the flick has died down, come back to the nearest full turn so the word reads again
      if (this.vel.length() < 1.2) {
        this.rot.y = damp(this.rot.y, Math.round(this.rot.y / (Math.PI * 2)) * Math.PI * 2, 2.2, dt);
        this.rot.x = damp(this.rot.x, Math.round(this.rot.x / (Math.PI * 2)) * Math.PI * 2, 2.2, dt);
      }
    }
    this.spinCharge(dt);
    // a slow breathing sway so it looks alive
    this.pivot.rotation.set(this.rot.x + Math.sin(t * 0.7) * 0.06, this.rot.y + Math.sin(t * 0.5) * 0.14, 0);
    this.renderer.render(this.scene, this.camera);
  }

  // how fast the word turned since the last frame, whether dragged or flung
  spinCharge(dt) {
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
