import * as THREE from 'three';
import { Vinyl, Sleeve, SLEEVE } from './hifi/objects.js';
import { discTextureFromImage, borderColor } from './hifi/textures.js';
import { loadBakedMaps, loadVarnish } from './hifi/baked.js';

// Every model is built at real-ish proportions, then normalised so its tallest/widest side is 1 unit.
// Each returns { root, update(dt, state) } where state = { focus 0..1, detail 0..1, playing bool }.

const loader = new THREE.TextureLoader();
export const manager = new THREE.LoadingManager();
loader.manager = manager;

function tex(url, { srgb = true, aniso = 8 } = {}) {
  const t = loader.load(url);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function normalise(inner) {
  const box = new THREE.Box3().setFromObject(inner);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  inner.position.sub(center);
  const root = new THREE.Group();
  const holder = new THREE.Group();
  holder.scale.setScalar(1 / Math.max(size.x, size.y));
  holder.add(inner);
  root.add(holder);
  return root;
}

// ---------- vinyl ----------
// The high-fidelity record and sleeve of the mockup generator (src/hifi, in cm): lathed disc with grooves and
// anisotropic sheen, paper labels, a rounded fibre-bumped sleeve with spot varnish. Its procedural maps are baked to
// files (src/hifi/baked.js), so building a record costs almost nothing on the main thread.
// Model fields: cover, back, disc (top-down PNG of the pressing), label, labelB, varnishFront, varnishBack
// (masks), or plain colours: sleeve, edge, discFill (disc surface), discColor.
const images = new Map(); // url -> Promise<HTMLImageElement | null>, records of the same release share their files
function image(url) {
  if (images.has(url)) return images.get(url);
  const load = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Shopify CDN: the canvases read these pixels back
    manager.itemStart(url);
    img.onload = () => { manager.itemEnd(url); resolve(img); };
    img.onerror = () => { manager.itemEnd(url); resolve(null); };
    img.src = url;
  });
  images.set(url, load);
  return load;
}
const imgTex = (img) => {
  const t = new THREE.Texture(img);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
};
let baked = null;
const shared = new Map(); // key -> Promise<texture>: printed sleeves, pressings and labels, built once per release
const once = (key, make) => (shared.has(key) || shared.set(key, make()), shared.get(key));

// Starts downloading the files of the records right away (while the page waits for its web fonts); buildVinyl then
// picks up the same promises.
export function prefetch(products) {
  for (const { kind, model: m } of products) {
    if (kind !== 'vinyl') continue;
    baked ||= loadBakedMaps(image);
    for (const url of [m.cover, m.back, m.disc, m.label, m.labelB]) if (url) image(url);
    for (const mask of [m.varnishFront, m.varnishBack]) if (mask) loadVarnish(mask, image, baked);
  }
}

export function buildVinyl(p) {
  const m = p.model;
  baked ||= loadBakedMaps(image);
  const inner = new THREE.Group();

  // sleeve, front face towards the camera (+z)
  const sleeve = new Sleeve({ maxAniso: 8 });
  sleeve.wear = 0.12; // new stock: barely handled
  sleeve.setWarp(0.12);
  if (m.edge || m.sleeve) sleeve.setEdge(m.edge || m.sleeve);
  if (!m.cover) for (const f of [sleeve.front, sleeve.back]) f.color.set(m.sleeve || '#e8e6e0');
  inner.add(sleeve.mesh);
  // printed artwork (+ its spot varnish): what Sleeve.setArt / setVarnishMask do, sharing the result
  const sides = [['front', m.cover, m.varnishFront, 1], ['back', m.back || m.cover, m.varnishBack, 2]];
  for (const [side, url, mask, seed] of sides) {
    if (!url) continue;
    const varnish = mask ? loadVarnish(mask, image, baked) : null;
    Promise.all([image(url), varnish]).then(async ([img, v]) => {
      if (!img) return;
      sleeve.images[side] = img;
      sleeve.varnish.maps[side] = v;
      const mat = side === 'front' ? sleeve.front : sleeve.back;
      mat.map = await once(`art|${url}|${mask}|${seed}`, () => sleeve.makeTex(img, seed, v));
      sleeve.applySurface();
      if (side === 'front' && !m.edge) sleeve.setEdge(borderColor(img));
    });
  }

  // record, inside the jacket; it slides out to the right, turning on its spindle
  const vinyl = new Vinyl(baked.grooves);
  vinyl.setDust(0);
  vinyl.group.rotation.x = Math.PI / 2; // side A faces the camera
  vinyl.setStyle({ mode: 'solid', color: m.discFill || m.discColor || '#0b0b0b' });
  if (m.disc)
    image(m.disc).then(async (img) => {
      if (img) vinyl.setStyle({ mode: 'texture', map: await once(`disc|${m.disc}`, () => discTextureFromImage(img)) });
    });
  vinyl.labelA.visible = vinyl.labelB.visible = !!m.label;
  if (m.label) {
    const label = (url) => once(`label|${url}`, () => image(url).then((img) => img && imgTex(img)));
    Promise.all([label(m.label), label(m.labelB || m.label)]).then(([a, b]) => vinyl.setLabels(a, b));
  }
  inner.add(vinyl.group);

  // the part of the record still in the sleeve is clipped away, so it can't poke through the warped board
  const clip = new THREE.Plane();
  const opening = new THREE.Plane(new THREE.Vector3(1, 0, 0), -(SLEEVE.w / 2 - 0.05));
  vinyl.setClip(clip);

  // the layout box is computed with the disc a little out, so the object turns about the middle of its silhouette.
  // In the product page it slides out until the middle of the label is at the mouth of the sleeve (half the label
  // shows); the whole thing is re-centred and scaled down as it gets wider, so it keeps its place and size on screen.
  const REST = 5, OPEN = SLEEVE.w / 2; // disc centre, cm
  vinyl.group.position.x = REST;
  const root = normalise(inner);
  const holder = root.children[0];
  const x0 = inner.position.x, k0 = holder.scale.x, W0 = 1 / k0; // widest side at rest

  let spinSpeed = 0;
  return {
    root,
    kind: 'vinyl',
    update(dt, s) {
      const g = vinyl.group;
      g.position.x += (REST + s.detail * (OPEN - REST) - g.position.x) * (1 - Math.exp(-dt * 5));
      const d = g.position.x - REST;
      inner.position.x = x0 - d / 2;
      holder.scale.setScalar(k0 * (W0 / (W0 + d)));
      const target = s.focus > 0.5 ? (s.playing ? 3.49 : 0.6) : 0; // 33 rpm when the music plays
      spinSpeed += (target - spinSpeed) * (1 - Math.exp(-dt * 2));
      vinyl.spin.rotation.y -= spinSpeed * dt;
      sleeve.mesh.updateWorldMatrix(true, false);
      clip.copy(opening).applyMatrix4(sleeve.mesh.matrixWorld);
    },
  };
}

// ---------- hot sauce ----------
// The 50 ml bottle of La Sauce Piqu'hans, in mm, measured on a product photo: straight body, round shoulder, long
// neck, screw cap. Model fields: art (the printed label: black ink on white, white = bare sticker), holo (the sticker
// is holographic foil), liquid, cap, capMetal, or for a label drawn in code: label, ink, heat.
const BODY_R = 18.9, BODY_H = 75.6, NECK_R = 8.6, NECK_TOP = 117, LIQUID_TOP = 99.5, GLASS = 1.6;
const LABEL = { w: 104, h: 67, y: 7.3 }; // sticker size (mm) and height above the base
function bottleProfile(inset = 0, maxY = Infinity) {
  // (radius, height) from the base up; the shoulder is smoothed through the measured points
  const base = [[0, 0], [16.5, 0], [18.3, 0.6], [BODY_R, 2.2]];
  const shoulder = new THREE.SplineCurve(
    [[BODY_R, BODY_H], [18.75, 79.2], [17.9, 82.5], [16.0, 86.1], [13.4, 89.6], [11.3, 92.9], [10.5, 96.5],
      [9.9, 100], [9.3, 104], [8.75, 108], [NECK_R, 111]].map(([r, y]) => new THREE.Vector2(r, y))
  ).getPoints(48);
  const pts = [...base.map(([r, y]) => new THREE.Vector2(r, y)), ...shoulder, new THREE.Vector2(NECK_R, NECK_TOP), new THREE.Vector2(NECK_R - 1.4, NECK_TOP)];
  const out = [];
  for (const p of pts) {
    if (p.y > maxY) {
      out.push(new THREE.Vector2(Math.max(0, p.x - inset), maxY), new THREE.Vector2(0, maxY));
      break;
    }
    out.push(new THREE.Vector2(p.x > 0 ? Math.max(0, p.x - inset) : 0, p.y + (p.y === 0 ? inset : 0)));
  }
  return out;
}

// Label drawn in code, for a sauce without printed artwork (the front is the middle of the texture).
function sauceLabel(p) {
  const m = p.model;
  return canvasTex(1024, 660, (g, w, h) => {
    g.fillStyle = m.label || '#e9e5dc';
    g.fillRect(0, 0, w, h);
    g.translate(0, 74);
    const cx = w / 2;
    g.fillStyle = m.ink || '#161514';
    g.textAlign = 'center';
    g.font = '500 30px "Space Grotesk", sans-serif';
    g.fillText('O B S I M O', cx, 78);
    g.font = `500 ${p.title.length > 10 ? 58 : 72}px "Space Grotesk", sans-serif`;
    g.fillText(p.title, cx, 250);
    g.font = '400 26px "Space Grotesk", sans-serif';
    g.fillText('SAUCE PIQUANTE', cx, 312);
    // heat scale
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.arc(cx - 88 + i * 44, 390, 13, 0, Math.PI * 2);
      g.globalAlpha = i < (m.heat || 3) ? 1 : 0.22;
      g.fill();
    }
    g.globalAlpha = 1;
    g.fillRect(cx - 170, 440, 340, 2);
  });
}

// Black ink printed on a holographic sticker. Where there is no ink the sticker is a mirror-like foil whose
// diffraction splits the light into a rainbow; the colour follows the angle between the surface and the eye, so
// the bands sweep across the label as the bottle turns. The ink is a plain satin black on top.
function holoLabel(url) {
  const mat = new THREE.MeshPhysicalMaterial({
    map: tex(url),
    metalness: 1,
    roughness: 0.24,
    envMapIntensity: 3.4,
    clearcoat: 0.5,
    clearcoatRoughness: 0.12,
  });
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'void main() {\n  vec3 foilGlow = vec3( 0.0 );').replace(
      '#include <clearcoat_normal_fragment_begin>',
      /* glsl */ `
      {
        float ink = 1.0 - smoothstep( 0.25, 0.75, texture2D( map, vMapUv ).r );
        vec3 eye = normalize( vViewPosition );
        // grating: the hue depends on the tilt of the foil towards the eye, plus a little of the foil's own pattern
        float h = 1.3 * normal.x + 0.55 * normal.y + 0.9 * ( 1.0 - dot( normal, eye ) )
          + 0.07 * sin( vMapUv.x * 70.0 + 3.0 * sin( vMapUv.y * 9.0 ) ) + 0.04 * sin( vMapUv.y * 160.0 );
        vec3 rainbow = 0.5 + 0.5 * cos( 6.28318 * ( h + vec3( 0.0, 0.33, 0.67 ) ) );
        vec3 foil = mix( vec3( 0.95 ), rainbow, 0.5 );
        diffuseColor.rgb = mix( foil, vec3( 0.015 ), ink );
        foilGlow = foil * ( 1.0 - ink );
        metalnessFactor = 1.0 - ink;
        roughnessFactor = mix( 0.16, 0.5, ink );
      }
      #include <clearcoat_normal_fragment_begin>`
    ).replace(
      '#include <lights_fragment_end>',
      // a foil never goes fully dark where the room behind the camera has nothing to reflect
      '#include <lights_fragment_end>\n  reflectedLight.indirectSpecular += foilGlow * 0.12;'
    );
  };
  return mat;
}

export function buildSauce(p) {
  const m = p.model;
  const inner = new THREE.Group();

  const glass = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.04,
    metalness: 0,
    transparent: true,
    opacity: 0.12,
    envMapIntensity: 2.6,
    clearcoat: 1,
    depthWrite: false,
    side: THREE.FrontSide,
  });
  const bottle = new THREE.Mesh(new THREE.LatheGeometry(bottleProfile(), 96), glass);
  bottle.renderOrder = 2;

  const liquid = new THREE.Mesh(
    new THREE.LatheGeometry(bottleProfile(GLASS, LIQUID_TOP), 64),
    new THREE.MeshPhysicalMaterial({
      color: m.liquid,
      roughness: 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      sheen: 0.2,
      sheenColor: new THREE.Color(m.liquid).offsetHSL(0, 0, 0.2),
      emissive: new THREE.Color(m.liquid),
      emissiveIntensity: 0.05,
    })
  );
  liquid.renderOrder = 1;

  // the sticker wraps most of the body, centred on the front (+z); the gap between its two ends is at the back
  const r = BODY_R + 0.12, around = LABEL.w / r;
  const label = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, LABEL.h, 128, 1, true, -around / 2, around),
    m.art && m.holo ? holoLabel(m.art)
      : new THREE.MeshStandardMaterial({ map: m.art ? tex(m.art) : sauceLabel(p), roughness: 0.8 })
  );
  label.position.y = LABEL.y + LABEL.h / 2;
  label.renderOrder = 3;

  // screw cap with its tamper ring, separated by a thin groove
  const capMat = m.capMetal
    ? new THREE.MeshStandardMaterial({ color: m.cap, metalness: 1, roughness: 0.3, envMapIntensity: 1.6 })
    : new THREE.MeshStandardMaterial({ color: m.cap, roughness: 0.35, metalness: 0.2 });
  const capPts = [[0, 131], [9.4, 131], [10.2, 130.6], [10.5, 129.6], [10.5, 121], [10.15, 120.7], [10.15, 120.2],
    [10.5, 119.9], [10.5, 116.2], [NECK_R, 116.2]].map(([r, y]) => new THREE.Vector2(r, y)).reverse();
  const cap = new THREE.Mesh(new THREE.LatheGeometry(capPts, 64), capMat);

  inner.add(liquid, bottle, label, cap);
  const root = normalise(inner);

  let t = Math.random() * 10;
  return {
    root,
    kind: 'sauce',
    update(dt, s) {
      t += dt;
      // the sauce sways a little, more when it is the product in focus
      inner.rotation.z = Math.sin(t * 1.3) * 0.02 * (0.4 + s.focus);
    },
  };
}

// Placeholder for products without a dedicated model yet (t-shirts later): a floating card with the first image.
export function buildCard(p) {
  const inner = new THREE.Group();
  const url = p.images[0];
  const mat = new THREE.MeshStandardMaterial({ color: url ? '#ffffff' : p.accent || '#444', roughness: 0.7 });
  if (url) mat.map = tex(url);
  inner.add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 3, 0.03), mat));
  return { root: normalise(inner), kind: 'card', update() {} };
}

export function buildModel(p) {
  if (p.kind === 'vinyl') return buildVinyl(p);
  if (p.kind === 'sauce') return buildSauce(p);
  return buildCard(p);
}
