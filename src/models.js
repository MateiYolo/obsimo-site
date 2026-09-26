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
function bottleProfile(scale = 1, inset = 0, maxY = Infinity) {
  // (radius, height) from the base up: woozy bottle with a long neck
  const pts = [
    [0, 0], [0.5, 0], [0.56, 0.03], [0.58, 0.1], [0.58, 1.55], [0.55, 1.75], [0.42, 2.0],
    [0.24, 2.25], [0.19, 2.45], [0.19, 2.7], [0.215, 2.72], [0.215, 2.8], [0.19, 2.82], [0.19, 2.9],
  ];
  const out = [];
  for (const [r, y] of pts) {
    if (y > maxY) {
      out.push(new THREE.Vector2(Math.max(0, r * scale - inset), maxY));
      out.push(new THREE.Vector2(0, maxY));
      break;
    }
    out.push(new THREE.Vector2(Math.max(0, r * scale - inset), y));
  }
  return out;
}

function sauceLabel(p) {
  const m = p.model;
  return canvasTex(1024, 512, (g, w, h) => {
    g.fillStyle = m.label;
    g.fillRect(0, 0, w, h);
    // the visible front is the middle of the texture
    const cx = w / 2;
    g.fillStyle = m.ink;
    g.textAlign = 'center';
    g.font = '500 30px "Space Grotesk", sans-serif';
    g.fillText('O B S I M O', cx, 78);
    g.font = `500 ${p.title.length > 10 ? 58 : 72}px "Space Grotesk", sans-serif`;
    g.fillText(p.title, cx, 250);
    g.font = '400 26px "Space Grotesk", sans-serif';
    g.fillText('SAUCE PIQUANTE · 150 ML', cx, 312);
    // heat scale
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.arc(cx - 88 + i * 44, 390, 13, 0, Math.PI * 2);
      g.globalAlpha = i < m.heat ? 1 : 0.22;
      g.fill();
    }
    g.globalAlpha = 1;
    g.fillRect(cx - 170, 440, 340, 2);
    // back of the label: small print
    g.textAlign = 'left';
    g.font = '400 18px "Space Grotesk", sans-serif';
    g.globalAlpha = 0.7;
    ['INGRÉDIENTS', 'Piment, vinaigre, ail,', 'épices, sel.', '', 'À conserver au frais', 'après ouverture.'].forEach((l, i) => {
      g.fillText(l, 40, 150 + i * 30);
      g.fillText(l, w - 260, 150 + i * 30);
    });
  });
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
    new THREE.LatheGeometry(bottleProfile(1, 0.035, 2.3), 64),
    new THREE.MeshPhysicalMaterial({
      color: m.liquid,
      roughness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      sheen: 0.5,
      sheenColor: new THREE.Color(m.liquid).offsetHSL(0, 0, 0.2),
      emissive: new THREE.Color(m.liquid),
      emissiveIntensity: 0.05,
    })
  );
  liquid.position.y = 0.035;
  liquid.renderOrder = 1;

  // label wraps ~300° of the body; its seam is at the back
  const labelGeo = new THREE.CylinderGeometry(0.586, 0.586, 1.15, 96, 1, true, Math.PI * 0.08, Math.PI * 1.84);
  const label = new THREE.Mesh(labelGeo, new THREE.MeshStandardMaterial({ map: sauceLabel(p), roughness: 0.8 }));
  label.position.y = 0.82;
  label.rotation.y = Math.PI; // centre of the texture faces the camera (+z)
  label.renderOrder = 3;

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.245, 0.42, 48),
    new THREE.MeshStandardMaterial({ color: m.cap, roughness: 0.35, metalness: 0.2 })
  );
  cap.position.y = 2.98;
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.228, 0.228, 0.1, 48, 1, true),
    new THREE.MeshStandardMaterial({ color: m.liquid, roughness: 0.5 })
  );
  band.position.y = 2.72;

  inner.add(liquid, bottle, label, cap, band);
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
