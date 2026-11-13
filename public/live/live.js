// OBSIMO · page live (pour les programmateurs).
// Scène 3D reprise du rider (obsimo-rider/assets/stage3d.js) + 2 flightcases + 2 barres LED suspendues.
// Unités : mètres. x = gauche/droite vu du public, z = vers le public, y = hauteur.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ---------- RÉGLAGES : pour déplacer un élément, change ses coordonnées ici ----------
const LAYOUT = {
  flightcase1: { x: -0.75, z: -0.15, rot: Math.PI / 2, w: 1.1, h: 1.0, d: 0.6 }, // rider
  flightcase2: { x: 0.3, z: 0.35, w: 0.7, h: 1.0, d: 0.6 }, // rider
  flightcase3: { x: -1.85, z: -0.55, rot: 0.3, w: 0.6, h: 1.0, d: 0.6 }, // nouveau, à jardin (gauche)
  flightcase4: { x: 1.55, z: -0.5, rot: -0.3, w: 0.6, h: 1.0, d: 0.6 }, // nouveau, à cour (droite)
  musician: { x: 0.1, z: -0.35 },
  guitar: { x: 1.05, z: 0.5, rot: -0.35 },
  wedge1: { x: -1.2, z: 1.6, rot: -0.3 },
  wedge2: { x: 1.55, z: 1.25, rot: 0.35 },
};
// Barres LED : horizontales, suspendues derrière l'artiste
const BARS = { length: 1.8, y: 2.7, z: -1.35, gap: 0.3, trussY: 4.4 };

const VIEWS = {
  public: { pos: [0, 1.55, 7.6], target: [0, 1.45, -0.4] },
  free: { pos: [4.2, 3.3, 5.6], target: [0, 1.2, -0.3] },
};

const BPM = 120; // tempo de la démo quand aucune musique ne joue

// ---------- Textes FR / EN ----------
const I18N = {
  fr: {
    kicker: 'Live 2026 — nouvelle scénographie', hint: 'Glisse pour tourner autour de la scène', unreleased: 'Inédit',
    leds: 'LED', down: 'Bas', up: 'Haut', both: 'Les deux', view: 'Vue', public: 'Public',
    liveTitle: 'Le live',
    liveLead: 'Un live électronique en solo, entre machines, guitare et lumière. Andreï joue en <em>silhouette</em>, au milieu de ses flightcases, découpé par deux barres LED suspendues derrière lui.',
    liveBody: "Des moments calmes, presque intimes, dans la fumée. Puis des moments qui dansent, où la lumière part dans tous les sens. La musique d'Obsimo a été synchronisée pour Giorgio Armani, Red Bull, Elite et Emily in Paris (Netflix).",
    techTitle: 'Sur scène', team: 'Équipe', teamV: '1 à 4 personnes', setup: 'Installation + balance', setupV: '50 min minimum',
    stage: 'Plateau', stageV: "Flightcases (≈ 1 m de haut) + 2 barres LED suspendues derrière l'artiste",
    sound: 'Son', soundV: '2 DI mono actives ou 1 DI stéréo · 2 retours · 4 prises 230V',
    light: 'Lumière', lightV: 'Pas de face : contre-jour, silhouette, fumée conseillée',
    rider: 'Voir la fiche technique complète →', riderHref: '/rider/fr/', play: 'Lecture', pause: 'Pause',
  },
  en: {
    kicker: 'Live 2026 — new stage design', hint: 'Drag to orbit around the stage', unreleased: 'Unreleased',
    leds: 'LED', down: 'Down', up: 'Up', both: 'Both', view: 'View', public: 'Audience',
    liveTitle: 'The live show',
    liveLead: 'A solo electronic live set, between machines, guitar and light. Andreï plays as a <em>silhouette</em>, surrounded by his flight cases, cut out by two LED bars hanging behind him.',
    liveBody: "Quiet, almost intimate moments in the haze. Then moments that dance, with light going everywhere. Obsimo's music has been synced for Giorgio Armani, Red Bull, Elite and Emily in Paris (Netflix).",
    techTitle: 'On stage', team: 'Crew', teamV: '1 to 4 people', setup: 'Setup + soundcheck', setupV: '50 min minimum',
    stage: 'Stage', stageV: 'Flight cases (≈ 1 m high) + 2 LED bars hanging behind the artist',
    sound: 'Sound', soundV: '2 active mono DIs or 1 stereo DI · 2 monitors · 4 × 230V outlets',
    light: 'Light', lightV: 'No front light: backlight, silhouette, haze recommended',
    rider: 'See the full tech rider →', riderHref: '/rider/en/', play: 'Play', pause: 'Pause',
  },
};

function pickLang() {
  const q = new URLSearchParams(location.search).get('lang');
  if (I18N[q]) return q;
  try { const s = localStorage.getItem('obsimo-live-lang'); if (I18N[s]) return s; } catch {}
  return (navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}
let lang = pickLang();
function applyLang(l) {
  lang = l;
  const T = I18N[l];
  document.documentElement.lang = l;
  document.querySelectorAll('[data-i18n]').forEach((el) => { if (T[el.dataset.i18n]) el.textContent = T[el.dataset.i18n]; });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => { if (T[el.dataset.i18nHtml]) el.innerHTML = T[el.dataset.i18nHtml]; });
  document.getElementById('riderLink').href = T.riderHref;
  document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.lang === l));
  try { localStorage.setItem('obsimo-live-lang', l); } catch {}
}
document.querySelector('.lang').addEventListener('click', (e) => { const b = e.target.closest('[data-lang]'); if (b) applyLang(b.dataset.lang); });
applyLang(lang);

// ---------- Lecteur audio ----------
const PEAKS = '.13,.16,.18,.20,.17,.22,.22,.20,.30,.31,.28,.38,.40,.40,.45,.46,.49,.42,.46,.51,.51,.49,.45,.37,.34,.36,.37,.30,.34,.33,.29,.45,.43,.44,.36,.35,.35,.35,.31,.33,.29,.25,.83,.96,1.00,.91,.99,.98,.91,.92,1.00,.98,.92,.80,.45,.37,.77,1.00,.94,.94,.98,.95,.93,.92,.99,.93,.95,.82,.55,.48,.46,.41,.33,.23,.29,.30,.38,.41,.38,.22,.31,.35,.42,.40,.35,.31,.31,.32,.34,.29,.29,.35,.33,.34,.31,.30,.29,.35,.34,.33,.30,.28,.33,.31,.28,.26,.28,.92,.94,.97,.90,.94,.93,.95,.90,.96,.98,.90,.61,.42,.36,.90,.96,.96,.88,.91,.98,.92,.91,.96,.97,.88,.67,.42,.35,.77,.87,.74,.80,.81,.88,.79,.84,.76,.84,.80,.84,.89,.73,.79,.82,.86,.75,.87,.79,.76,.49,.47,.30,.31,.29,.30,.32,.27,.29,.27,.30,.35,.28,.28,.25,.23,.18,.20,.20,.04,.00,.00,.00,.00'
  .split(',').filter(Boolean).map(Number);
const audio = document.getElementById('audio');
const playBtn = document.getElementById('play');
const playIcon = document.getElementById('playIcon');
const wave = document.getElementById('wave');
const timeEl = document.getElementById('time');
let analyser = null;
let freq = null;

function fmt(s) { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function ensureAnalyser() {
  if (analyser) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = ctx.createMediaElementSource(audio);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.6;
    src.connect(analyser);
    analyser.connect(ctx.destination);
    freq = new Uint8Array(analyser.frequencyBinCount);
    audio._ctx = ctx;
  } catch (err) { console.warn('Analyse audio indisponible', err); }
}
playBtn.addEventListener('click', () => {
  ensureAnalyser();
  audio._ctx?.resume();
  if (audio.paused) audio.play(); else audio.pause();
});
audio.addEventListener('play', () => { playIcon.setAttribute('d', 'M6 4.5h4.2v15H6zM13.8 4.5H18v15h-4.2z'); playBtn.setAttribute('aria-label', I18N[lang].pause); });
audio.addEventListener('pause', () => { playIcon.setAttribute('d', 'M7 4.5v15l13-7.5z'); playBtn.setAttribute('aria-label', I18N[lang].play); });
audio.addEventListener('ended', () => { audio.currentTime = 0; });

function drawWave() {
  const p = PEAKS;
  const dpr = Math.min(devicePixelRatio, 2);
  const w = wave.clientWidth, h = wave.clientHeight;
  if (wave.width !== Math.round(w * dpr)) { wave.width = Math.round(w * dpr); wave.height = Math.round(h * dpr); }
  const c = wave.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  const n = Math.max(24, Math.floor(w / 4));
  const prog = audio.duration ? audio.currentTime / audio.duration : 0;
  const led = getComputedStyle(document.documentElement).getPropertyValue('--led').trim();
  for (let i = 0; i < n; i++) {
    const v = p[Math.floor((i / n) * p.length)] ?? 0.2;
    const bh = Math.max(2, v * (h - 4));
    c.fillStyle = i / n < prog ? led : 'rgba(255,255,255,.22)';
    c.fillRect(i * (w / n), (h - bh) / 2, Math.max(1.5, w / n - 1.5), bh);
  }
  timeEl.textContent = `${fmt(audio.currentTime)} / ${fmt(audio.duration || 210)}`;
}
wave.addEventListener('click', (e) => {
  const r = wave.getBoundingClientRect();
  const k = (e.clientX - r.left) / r.width;
  if (audio.duration) audio.currentTime = k * audio.duration;
  else { audio.addEventListener('loadedmetadata', () => (audio.currentTime = k * audio.duration), { once: true }); }
  if (audio.paused) playBtn.click();
});

// ---------- 3D ----------
const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1, ...opts });
const M = {
  floor: mat(0x1c1c20, { roughness: 0.45, metalness: 0.2 }),
  case: mat(0x121212, { roughness: 0.5 }),
  alu: mat(0xb9bcc2, { metalness: 0.85, roughness: 0.3 }),
  gear: mat(0x2a2a2e, { roughness: 0.4 }),
  wedge: mat(0x26282d, { roughness: 0.6 }),
  grille: mat(0x5d636e, { roughness: 0.8, metalness: 0.3 }),
  screen: mat(0x9a9ea5, { metalness: 0.6, roughness: 0.3 }),
  sunburst: mat(0xb5561c, { roughness: 0.35 }),
  wood: mat(0xe8d9b5, { roughness: 0.5 }),
  rubber: mat(0x0e0e0e, { roughness: 0.95 }),
  white: mat(0xe9e6df, { roughness: 0.4 }),
  knob: mat(0xff5a2a, { emissive: 0xff5a2a, emissiveIntensity: 1.2 }),
  truss: mat(0x6b6e74, { metalness: 0.8, roughness: 0.4 }),
  curtain: mat(0x0a0a0b, { roughness: 1 }),
};

function box(w, h, d, material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.castShadow = m.receiveShadow = true;
  return m;
}

function flightcase({ w, h, d }) {
  const g = new THREE.Group();
  const wheel = 0.1;
  const body = box(w, h - wheel, d, M.case);
  body.position.y = wheel + (h - wheel) / 2;
  g.add(body);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), new THREE.LineBasicMaterial({ color: 0x8e9197 }));
  edges.position.copy(body.position);
  g.add(edges);
  for (const y of [wheel + 0.02, h - 0.02, wheel + (h - wheel) * 0.62]) {
    const strip = box(w + 0.01, 0.025, d + 0.01, M.alu);
    strip.position.y = y;
    g.add(strip);
  }
  for (const sx of [-1, 1]) {
    const handle = box(0.14, 0.05, 0.02, M.alu);
    handle.position.set(sx * w * 0.3, wheel + (h - wheel) * 0.4, d / 2 + 0.01);
    g.add(handle);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.035, 16), M.rubber);
    wh.rotation.z = Math.PI / 2;
    wh.position.set(sx * (w / 2 - 0.08), 0.045, sz * (d / 2 - 0.08));
    g.add(wh);
  }
  g.userData.top = h;
  return g;
}

function laptop() {
  const g = new THREE.Group();
  const base = box(0.34, 0.018, 0.24, M.screen);
  base.position.y = 0.009;
  const lid = box(0.34, 0.24, 0.012, M.screen);
  lid.position.set(0, 0.12, -0.12);
  lid.rotation.x = -0.25;
  g.add(base, lid);
  return g;
}

function controller(w, d) {
  const g = new THREE.Group();
  const b = box(w, 0.05, d, M.gear);
  b.position.y = 0.025;
  g.add(b);
  const knobGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.02, 10);
  for (let i = 0; i < 8; i++) {
    const k = new THREE.Mesh(knobGeo, i % 3 ? M.alu : M.knob);
    k.position.set(-w / 2 + 0.05 + (i * (w - 0.1)) / 7, 0.06, -d / 4);
    g.add(k);
  }
  return g;
}

function keyboard(w) {
  // Petit synthé à clavier (posé sur le flightcase 3)
  const g = new THREE.Group();
  const b = box(w, 0.07, 0.3, M.gear);
  b.position.y = 0.035;
  g.add(b);
  const n = Math.floor((w - 0.06) / 0.024);
  for (let i = 0; i < n; i++) {
    const k = box(0.021, 0.015, 0.13, M.white);
    k.position.set(-w / 2 + 0.04 + i * 0.024, 0.075, 0.08);
    g.add(k);
  }
  for (let i = 0; i < 6; i++) {
    const k = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.02, 10), i % 2 ? M.alu : M.knob);
    k.position.set(-w / 2 + 0.06 + i * 0.05, 0.08, -0.08);
    g.add(k);
  }
  return g;
}

function crt(screenMat) {
  // Petit écran rétro (posé sur le flightcase 4), il prend la couleur des LED
  const g = new THREE.Group();
  const shell = box(0.42, 0.36, 0.38, mat(0x1d1d20, { roughness: 0.5 }));
  shell.position.y = 0.18;
  const back = box(0.3, 0.26, 0.16, mat(0x1d1d20, { roughness: 0.5 }));
  back.position.set(0, 0.17, -0.25);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.33, 0.25), screenMat);
  screen.position.set(0, 0.19, 0.191);
  g.add(shell, back, screen);
  return g;
}

function guitar() {
  const g = new THREE.Group();
  const stand = mat(0x1a1a1a, { roughness: 0.6 });
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.34, 6), stand);
    leg.position.set(s * 0.1, 0.15, 0.06);
    leg.rotation.set(0.35, 0, s * 0.35);
    g.add(leg);
  }
  const back = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.85, 6), stand);
  back.position.set(0, 0.42, -0.12);
  back.rotation.x = -0.12;
  g.add(back);
  const gt = new THREE.Group();
  const extrude = (shape, depth, material) => {
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2, curveSegments: 16 }), material);
    m.castShadow = true;
    return m;
  };
  const b = new THREE.Shape();
  b.moveTo(0, -0.22);
  b.bezierCurveTo(0.1, -0.23, 0.17, -0.18, 0.165, -0.08);
  b.bezierCurveTo(0.16, 0.0, 0.12, 0.0, 0.12, 0.03);
  b.bezierCurveTo(0.12, 0.08, 0.15, 0.15, 0.13, 0.2);
  b.bezierCurveTo(0.11, 0.23, 0.06, 0.16, 0.035, 0.12);
  b.lineTo(-0.035, 0.12);
  b.bezierCurveTo(-0.06, 0.2, -0.08, 0.27, -0.11, 0.26);
  b.bezierCurveTo(-0.14, 0.25, -0.13, 0.1, -0.12, 0.05);
  b.bezierCurveTo(-0.11, 0.0, -0.17, -0.02, -0.165, -0.08);
  b.bezierCurveTo(-0.17, -0.18, -0.1, -0.23, 0, -0.22);
  const body = extrude(b, 0.04, M.sunburst);
  body.position.z = -0.02;
  const neck = box(0.048, 0.56, 0.022, M.wood);
  neck.position.set(0, 0.39, 0.012);
  const head = box(0.06, 0.18, 0.014, M.wood);
  head.position.set(0.008, 0.75, 0.006);
  gt.add(body, neck, head);
  gt.position.set(0, 0.5, 0.03);
  gt.rotation.x = -0.12;
  g.add(gt);
  return g;
}

function wedge() {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(0.45, 0); s.lineTo(0.45, 0.12); s.lineTo(0.1, 0.38); s.lineTo(0, 0.38); s.lineTo(0, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.58, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 });
  geo.translate(-0.225, 0, -0.29);
  const m = new THREE.Mesh(geo, M.wedge);
  m.castShadow = m.receiveShadow = true;
  const grille = box(0.4, 0.006, 0.5, M.grille);
  grille.rotation.z = -Math.atan2(0.26, 0.35);
  grille.position.set(0.054, 0.255, 0);
  m.add(grille);
  m.rotation.y = Math.PI / 2;
  const g = new THREE.Group();
  g.add(m);
  return g;
}

function stickman() {
  const g = new THREE.Group();
  const m = mat(0x8a93a3);
  const add = (geo, x, y, z, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.z = rz; o.castShadow = true; g.add(o); };
  for (const s of [-1, 1]) add(new THREE.CapsuleGeometry(0.07, 0.72, 4, 10), s * 0.1, 0.45, 0);
  add(new THREE.CapsuleGeometry(0.17, 0.42, 4, 12), 0, 1.13, 0);
  add(new THREE.SphereGeometry(0.12, 16, 12), 0, 1.6, 0);
  return g;
}

function loadAvatar() {
  return new GLTFLoader().loadAsync(new URL('obsimo.glb', import.meta.url).href).then(({ scene: model }) => {
    const bb = new THREE.Box3().setFromObject(model);
    const size = bb.getSize(new THREE.Vector3());
    model.scale.setScalar(1.78 / size.y);
    bb.setFromObject(model);
    const c = bb.getCenter(new THREE.Vector3());
    model.position.set(-c.x, -bb.min.y, -c.z);
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      // un soupçon d'auto-éclairage : on devine les traits, mais on reste en silhouette
      o.material.emissive = new THREE.Color(0xffffff);
      o.material.emissiveMap = o.material.map;
      o.material.emissiveIntensity = 0.12;
    });
    return model;
  });
}

// Faisceau "volumétrique" (lumière dans la fumée) : un tronc de pyramide transparent, plus fort près de la source
const beamVert = `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const beamFrag = `uniform vec3 uColor; uniform float uI; uniform float uEdge; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){
  float along = pow(1.0 - vUv.y, 2.0);
  float edge = mix(1.0, smoothstep(0.0, 0.3, vUv.x) * smoothstep(1.0, 0.7, vUv.x), uEdge);
  float f = abs(dot(normalize(vN), normalize(vV)));
  float a = uI * along * edge * (0.2 + 0.8 * f);
  gl_FragColor = vec4(uColor * a, 1.0);
}`;
function beamMaterial(color, edge = 1) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uI: { value: 0 }, uEdge: { value: edge } },
    vertexShader: beamVert, fragmentShader: beamFrag,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
}
function beamGeometry(len, reach, spreadX, spreadZ) {
  const t = [[-len / 2, 0, -0.03], [len / 2, 0, -0.03], [len / 2, 0, 0.03], [-len / 2, 0, 0.03]];
  const b = [[-len / 2 - spreadX, -reach, -spreadZ], [len / 2 + spreadX, -reach, -spreadZ], [len / 2 + spreadX, -reach, spreadZ], [-len / 2 - spreadX, -reach, spreadZ]];
  const pos = [], uv = [], idx = [];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4, o = pos.length / 3;
    pos.push(...t[i], ...t[j], ...b[j], ...b[i]);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function ledBar(color) {
  const g = new THREE.Group();
  const L = BARS.length;
  const housing = box(L, 0.07, 0.08, mat(0x1b1b1e, { metalness: 0.6, roughness: 0.4 }));
  const stripMat = () => new THREE.MeshStandardMaterial({ color: 0x111111, emissive: new THREE.Color(color), emissiveIntensity: 0 });
  const down = new THREE.Mesh(new THREE.BoxGeometry(L - 0.04, 0.012, 0.05), stripMat());
  down.position.y = -0.04;
  const up = new THREE.Mesh(new THREE.BoxGeometry(L - 0.04, 0.012, 0.05), stripMat());
  up.position.y = 0.04;
  g.add(housing, down, up);
  // élingues jusqu'au pont
  const cableMat = new THREE.LineBasicMaterial({ color: 0x55585e });
  for (const s of [-1, 1]) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(s * (L / 2 - 0.1), 0.035, 0), new THREE.Vector3(s * (L / 2 - 0.1), BARS.trussY - BARS.y - 0.15, 0)]);
    g.add(new THREE.Line(geo, cableMat));
  }
  // faisceaux
  const beamDown = new THREE.Mesh(beamGeometry(L, BARS.y, 0.35, 0.9), beamMaterial(color));
  beamDown.position.y = -0.04;
  const beamUp = new THREE.Mesh(beamGeometry(L, 2.6, 0.3, 0.7), beamMaterial(color));
  beamUp.rotation.x = Math.PI;
  beamUp.position.y = 0.04;
  g.add(beamDown, beamUp);
  // vraies lumières (éclairent le sol, l'artiste de dos, le pont)
  const spotDown = new THREE.SpotLight(color, 0, 9, 0.85, 0.9, 1.4);
  spotDown.position.set(0, -0.05, 0);
  spotDown.target.position.set(0, -BARS.y, 0.9);
  spotDown.castShadow = true;
  spotDown.shadow.mapSize.set(512, 512);
  const spotUp = new THREE.SpotLight(color, 0, 6, 0.8, 0.9, 1.4);
  spotUp.position.set(0, 0.05, 0);
  spotUp.target.position.set(0, 3, 0);
  g.add(spotDown, spotDown.target, spotUp, spotUp.target);
  g.userData = { down, up, beamDown, beamUp, spotDown, spotUp };
  return g;
}

function truss(width) {
  const g = new THREE.Group();
  const s = 0.29 / 2;
  for (const [y, z] of [[-s, -s], [-s, s], [s, -s], [s, s]]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, width, 8), M.truss);
    c.rotation.z = Math.PI / 2;
    c.position.set(0, y, z);
    g.add(c);
  }
  const pts = [];
  const n = Math.floor(width / 0.3);
  for (let i = 0; i < n; i++) {
    const x0 = -width / 2 + i * 0.3, x1 = x0 + 0.3;
    for (const z of [-s, s]) pts.push(new THREE.Vector3(x0, -s, z), new THREE.Vector3(x1, s, z));
    for (const y of [-s, s]) pts.push(new THREE.Vector3(x0, y, -s), new THREE.Vector3(x1, y, s));
  }
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x55585e })));
  return g;
}

function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

// ---------- État du show ----------
const show = { mode: 'auto', color: new THREE.Color('#5fffc4'), env: 0, avg: 0.2, flash: 0, step: 0, lastKick: 0 };
// [gauche bas, gauche haut, droite bas, droite haut]
const PATTERNS = [[1, 0, 1, 0], [0, 1, 0, 1], [1, 0, 0, 1], [0, 1, 1, 0], [1, 1, 1, 1], [1, 0, 1, 0], [0, 0, 1, 1], [1, 1, 0, 0]];
const MASKS = { down: [1, 0, 1, 0], up: [0, 1, 0, 1], both: [1, 1, 1, 1] };

function init(root) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050506);
  scene.fog = new THREE.FogExp2(0x050506, 0.055);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 60);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  root.appendChild(renderer.domElement);

  // Ambiance très basse (pas de face, comme demandé dans le rider)
  scene.add(new THREE.HemisphereLight(0x8090a0, 0x050505, 0.35));
  const fill = new THREE.DirectionalLight(0x9fb4ff, 0.18);
  fill.position.set(-3, 3, 5);
  scene.add(fill);

  // Plateau
  const floor = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.1, 4.2), M.floor);
  floor.position.set(0, -0.05, 0.2);
  floor.receiveShadow = true;
  scene.add(floor);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), mat(0x060607, { roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.6;
  scene.add(ground);
  const nose = box(5.6, 0.02, 0.03, mat(0x333333, { emissive: 0x222222 }));
  nose.position.set(0, 0.001, 2.3);
  scene.add(nose);
  const curtain = new THREE.Mesh(new THREE.PlaneGeometry(8, 6), M.curtain);
  curtain.position.set(0, 2.9, -2.1);
  curtain.receiveShadow = true;
  scene.add(curtain);
  const tr = truss(5.4);
  tr.position.set(0, BARS.trussY, BARS.z);
  scene.add(tr);

  const place = (obj, { x, z, rot = 0 }) => { obj.position.set(x, 0, z); obj.rotation.y = rot; scene.add(obj); return obj; };

  // Flightcases + matériel
  const fc1 = place(flightcase(LAYOUT.flightcase1), LAYOUT.flightcase1);
  const fc2 = place(flightcase(LAYOUT.flightcase2), LAYOUT.flightcase2);
  const fc3 = place(flightcase(LAYOUT.flightcase3), LAYOUT.flightcase3);
  const fc4 = place(flightcase(LAYOUT.flightcase4), LAYOUT.flightcase4);
  const lap = laptop(); lap.position.set(0.25, 1, 0); fc1.add(lap);
  const c1 = controller(0.5, 0.22); c1.position.set(-0.22, 1, 0.02); fc1.add(c1);
  const c2 = controller(0.44, 0.26); c2.position.set(0, 1, 0.05); fc2.add(c2);
  const kb = keyboard(0.56); kb.position.set(0, 1, 0); fc3.add(kb);
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const tv = crt(screenMat); tv.position.set(0, 1, 0); fc4.add(tv);
  place(guitar(), LAYOUT.guitar);
  place(wedge(), LAYOUT.wedge1);
  place(wedge(), LAYOUT.wedge2);

  // Artiste
  const artist = place(stickman(), LAYOUT.musician);
  loadAvatar().then((m) => { artist.clear(); artist.add(m); }).catch((err) => console.warn('Avatar non chargé', err));

  // Douche au-dessus de l'artiste (comme sur le croquis)
  const douche = new THREE.SpotLight(0xffe7c4, 14, 7, 0.3, 0.7, 1.2);
  douche.position.set(LAYOUT.musician.x, BARS.trussY - 0.25, LAYOUT.musician.z + 0.2);
  douche.target.position.set(LAYOUT.musician.x, 0, LAYOUT.musician.z);
  douche.castShadow = true;
  douche.shadow.mapSize.set(1024, 1024);
  scene.add(douche, douche.target);
  const doucheBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.95, BARS.trussY - 0.3, 32, 1, true), beamMaterial(0xffe7c4, 0));
  doucheBeam.material.fragmentShader = doucheBeam.material.fragmentShader.replace('1.0 - vUv.y', 'vUv.y');
  doucheBeam.position.set(LAYOUT.musician.x, (BARS.trussY - 0.3) / 2, LAYOUT.musician.z + 0.1);
  scene.add(doucheBeam);
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.28, 16), mat(0x151517, { metalness: 0.6 }));
  can.position.copy(douche.position).add(new THREE.Vector3(0, 0.1, 0));
  scene.add(can);

  // Barres LED
  const xL = -(BARS.gap / 2 + BARS.length / 2);
  const barL = ledBar(show.color); barL.position.set(xL, BARS.y, BARS.z); scene.add(barL);
  const barR = ledBar(show.color); barR.position.set(-xL, BARS.y, BARS.z); scene.add(barR);
  const bars = [barL, barR];

  // Poussière dans la fumée
  const N = 900;
  const dust = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { dust[i * 3] = (Math.random() - 0.5) * 6; dust[i * 3 + 1] = Math.random() * 4.5; dust[i * 3 + 2] = -1.9 + Math.random() * 3.6; }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dust, 3));
  const dustMat = new THREE.PointsMaterial({ size: 0.018, color: 0xffffff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
  scene.add(new THREE.Points(dustGeo, dustMat));

  // Caméra
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.enableZoom = false; // la molette fait défiler la page
  renderer.domElement.style.touchAction = 'pan-y'; // sur mobile : glisser à l'horizontale = tourner, à la verticale = défiler
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = Math.PI / 2 - 0.02;
  controls.minAzimuthAngle = -1.4;
  controls.maxAzimuthAngle = 1.4;

  let anim = null;
  let idleSince = performance.now();
  let sway = null; // { theta0, phi, r, t0 }
  function goTo(name, instant = false) {
    const v = VIEWS[name];
    document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === name));
    const to = { pos: new THREE.Vector3(...v.pos), target: new THREE.Vector3(...v.target) };
    sway = null;
    idleSince = performance.now();
    if (instant || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      camera.position.copy(to.pos); controls.target.copy(to.target); controls.update(); return;
    }
    anim = { from: { pos: camera.position.clone(), target: controls.target.clone() }, to, t0: performance.now() };
  }
  document.getElementById('views').addEventListener('click', (e) => { const b = e.target.closest('[data-view]'); if (b) goTo(b.dataset.view); });
  const hint = document.getElementById('hint');
  setTimeout(() => (hint.style.opacity = 0), 7000);
  controls.addEventListener('start', () => { anim = null; sway = null; hint.style.opacity = 0; });
  controls.addEventListener('end', () => { idleSince = performance.now(); });

  document.getElementById('modes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode]');
    if (!b) return;
    show.mode = b.dataset.mode;
    document.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', x === b));
  });
  document.getElementById('colors').addEventListener('click', (e) => {
    const b = e.target.closest('[data-color]');
    if (!b) return;
    show.color.set(b.dataset.color);
    document.documentElement.style.setProperty('--led', b.dataset.color);
    document.querySelectorAll('[data-color]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    for (const bar of bars) {
      const u = bar.userData;
      u.down.material.emissive.copy(show.color); u.up.material.emissive.copy(show.color);
      u.beamDown.material.uniforms.uColor.value.copy(show.color); u.beamUp.material.uniforms.uColor.value.copy(show.color);
      u.spotDown.color.copy(show.color); u.spotUp.color.copy(show.color);
    }
  });

  function resize() {
    const w = root.clientWidth, h = root.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 1 ? 62 : 36;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(root);
  resize();
  goTo('public', true);

  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(root);

  const levels = [0, 0, 0, 0]; // gauche bas, gauche haut, droite bas, droite haut
  const beatMs = 60000 / BPM;
  let nextBeat = performance.now();
  const clock = new THREE.Clock();

  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    drawWave();
    if (!visible) return;

    // --- Analyse du son : graves → énergie + détection du kick ---
    const playing = analyser && !audio.paused;
    let kick = false;
    if (playing) {
      analyser.getByteFrequencyData(freq);
      let bass = 0;
      for (let i = 1; i < 7; i++) bass += freq[i];
      bass /= 6 * 255;
      show.env = Math.max(bass, show.env * 0.9);
      if (bass > show.avg * 1.18 && bass > 0.5 && now - show.lastKick > 220) { kick = true; show.lastKick = now; }
      show.avg = show.avg * 0.97 + bass * 0.03;
    } else {
      show.env *= 0.95;
      if (now >= nextBeat) { kick = true; nextBeat = now + beatMs; }
    }
    if (kick) {
      show.flash = 1;
      show.step++;
    }
    show.flash *= playing ? 0.86 : 0.9;

    // --- Cible de chaque rangée de LED ---
    let mask, base;
    if (show.mode === 'auto') {
      mask = PATTERNS[Math.floor(show.step / 2) % PATTERNS.length];
      base = playing ? 0.15 + 0.95 * show.flash : 0.2 + 0.7 * show.flash;
    } else {
      mask = MASKS[show.mode];
      base = playing ? 0.35 + 0.75 * show.env : 0.75 + 0.12 * Math.sin(t * 1.3);
    }
    for (let i = 0; i < 4; i++) levels[i] += (mask[i] * base - levels[i]) * 0.35;

    bars.forEach((bar, b) => {
      const u = bar.userData;
      const dn = levels[b * 2], upv = levels[b * 2 + 1];
      u.down.material.emissiveIntensity = 0.2 + dn * 4;
      u.up.material.emissiveIntensity = 0.2 + upv * 4;
      u.beamDown.material.uniforms.uI.value = dn * 0.5;
      u.beamUp.material.uniforms.uI.value = upv * 0.45;
      u.spotDown.intensity = dn * 45;
      u.spotUp.intensity = upv * 25;
    });
    const doucheLevel = playing ? 0.55 + 0.45 * (1 - show.env) : 1;
    douche.intensity = 14 * doucheLevel;
    doucheBeam.material.uniforms.uI.value = 0.13 * doucheLevel;
    screenMat.color.copy(show.color).multiplyScalar(0.25 + 0.6 * Math.max(levels[0], levels[2], show.flash * 0.6));
    dustMat.color.copy(show.color).lerp(new THREE.Color(0xffffff), 0.6);

    // poussière qui flotte
    const p = dustGeo.attributes.position.array;
    for (let i = 0; i < N; i++) {
      p[i * 3 + 1] += dt * 0.05;
      p[i * 3] += Math.sin(t * 0.3 + i) * dt * 0.02;
      if (p[i * 3 + 1] > 4.5) p[i * 3 + 1] = 0;
    }
    dustGeo.attributes.position.needsUpdate = true;

    // --- Caméra : transition, puis léger balancement quand personne ne touche ---
    if (anim) {
      const k = Math.min((now - anim.t0) / 900, 1);
      const e = 1 - Math.pow(1 - k, 3);
      camera.position.lerpVectors(anim.from.pos, anim.to.pos, e);
      controls.target.lerpVectors(anim.from.target, anim.to.target, e);
      if (k === 1) { anim = null; idleSince = now; }
    } else if (now - idleSince > 2500 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (!sway) {
        const off = camera.position.clone().sub(controls.target);
        const sph = new THREE.Spherical().setFromVector3(off);
        sway = { sph, t0: t };
      }
      const k = Math.min((t - sway.t0) / 4, 1);
      const s = sway.sph.clone();
      s.theta += Math.sin((t - sway.t0) * 0.18) * 0.38 * k;
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));
    }
    controls.update();
    renderer.render(scene, camera);
  });

  requestAnimationFrame(() => renderer.domElement.classList.add('on'));
  window.__obsimoReady = true;
}

const root = document.getElementById('stage');
if (hasWebGL()) {
  try { init(root); } catch (err) { console.error(err); }
} else {
  root.style.background = '#050506';
}
addEventListener('resize', drawWave);
drawWave();
