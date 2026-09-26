import * as THREE from 'three';

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
// Concentric grooves as a roughness map: the sheen breaks into rings like a real record.
const grooveRoughness = () =>
  canvasTex(1024, 1024, (g, w) => {
    g.fillStyle = '#6a6a6a';
    g.fillRect(0, 0, w, w);
    const c = w / 2;
    for (let r = 0.36 * c; r < 0.985 * c; r += 1.6) {
      const band = Math.sin(r * 0.045) > 0.93 ? 150 : 60 + Math.random() * 40; // track gaps are smoother
      g.strokeStyle = `rgb(${band},${band},${band})`;
      g.lineWidth = 1;
      g.beginPath();
      g.arc(c, c, r, 0, Math.PI * 2);
      g.stroke();
    }
  }, false);

function blackDisc(labelUrl, fill = '#0b0b0b') {
  const img = new Image();
  const t = canvasTex(1024, 1024, (g, w) => {
    const c = w / 2;
    g.fillStyle = fill;
    g.beginPath(); g.arc(c, c, c, 0, Math.PI * 2); g.fill();
  });
  img.onload = () => {
    const g = t.image.getContext('2d');
    const c = 512, lr = 512 * (5 / 15);
    g.save();
    g.beginPath(); g.arc(c, c, lr, 0, Math.PI * 2); g.clip();
    g.drawImage(img, c - lr, c - lr, lr * 2, lr * 2);
    g.restore();
    t.needsUpdate = true;
  };
  if (!labelUrl) return t;
  manager.itemStart(labelUrl);
  img.addEventListener('load', () => manager.itemEnd(labelUrl));
  img.addEventListener('error', () => manager.itemEnd(labelUrl));
  img.src = labelUrl;
  return t;
}

export function buildVinyl(p) {
  const m = p.model;
  const W = 3.14, T = 0.04, R = 1.5;
  const inner = new THREE.Group();

  // sleeve
  const edge = new THREE.MeshStandardMaterial({ color: m.edge || '#e8e6e0', roughness: 0.85 });
  // no artwork yet: a plain sleeve in m.sleeve
  const face = (url, roughness) =>
    new THREE.MeshStandardMaterial(url ? { map: tex(url), roughness } : { color: m.sleeve || '#e8e6e0', roughness });
  const front = face(m.cover, 0.62);
  const back = face(m.back || m.cover, 0.7);
  const sleeve = new THREE.Mesh(new THREE.BoxGeometry(W, W, T), [edge, edge, edge, edge, front, back]);
  inner.add(sleeve);

  // disc, behind the sleeve; it slides out to the right
  const discMap = m.disc ? tex(m.disc) : blackDisc(m.label, m.discFill);
  const top = new THREE.MeshPhysicalMaterial({
    map: discMap,
    alphaTest: 0.5,
    roughness: 0.55,
    roughnessMap: grooveRoughness(),
    clearcoat: 0.6,
    clearcoatRoughness: 0.25,
  });
  const side = new THREE.MeshStandardMaterial({ color: m.discColor || '#dcdad4', roughness: 0.4 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.018, 128, 1), [side, top, top]);
  disc.rotation.x = Math.PI / 2; // caps face the camera
  const slide = new THREE.Group();
  const spin = new THREE.Group();
  spin.add(disc);
  slide.add(spin);
  inner.add(slide); // inside the jacket: the board hides what has not slid out yet

  // the layout box is computed with the disc a little out, so the object turns about the middle of its silhouette
  slide.position.x = 0.5;
  const root = normalise(inner);

  let spinSpeed = 0;
  return {
    root,
    kind: 'vinyl',
    update(dt, s) {
      const out = 0.5 + s.detail * 0.55;
      slide.position.x += (out - slide.position.x) * (1 - Math.exp(-dt * 5));
      const target = s.focus > 0.5 ? (s.playing ? 3.49 : 0.6) : 0; // 33 rpm when the music plays
      spinSpeed += (target - spinSpeed) * (1 - Math.exp(-dt * 2));
      spin.rotation.z -= spinSpeed * dt;
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
