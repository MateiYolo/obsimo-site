import * as THREE from 'three';
import { Vinyl, Sleeve, SLEEVE } from './hifi/objects.js';
import { discTextureFromImage, borderColor, releaseCanvas } from './hifi/textures.js';
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
// (masks), dieCut (round window onto side A's label), sticker ({ art, x, y, h } in cm: a holographic sticker on the
// front), rest (how far the disc sticks out at rest, cm), or plain colours: sleeve, edge, discFill (disc surface), discColor.
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
// The 2048 px canvases of printed sleeves and pressings (16 MB each) are only needed for their one upload to the GPU:
// emptied right after it, so the total stays under iOS Safari's canvas memory cap (past it, new canvases come out
// blank: black or see-through sleeves, dark objects)
const uploadOnce = (t) => {
  t.onUpdate = () => {
    t.onUpdate = null;
    releaseCanvas(t.image);
  };
  return t;
};

// Starts downloading the files of the records right away (while the page waits for its web fonts); buildVinyl then
// picks up the same promises.
export function prefetch(products) {
  const records = products.flatMap(({ kind, model }) => (kind === 'vinyl' ? [model] : kind === 'bundle' ? model.records : []));
  for (const m of records) {
    baked ||= loadBakedMaps(image);
    for (const url of [m.cover, m.back, m.disc, m.label, m.labelB, m.sticker?.art]) if (url) image(url);
    for (const mask of [m.varnishFront, m.varnishBack]) if (mask) loadVarnish(mask, image, baked);
  }
}

// Holographic sticker stuck on the front of the sleeve: follows the board's warp (Sleeve geometry, warpDir +1).
function sleeveSticker(sleeve, { art, x, y, h }) {
  const mat = holoLabel(art, { flat: true });
  mat.alphaTest = 0.5; // rounded corners
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -2;
  mat.polygonOffsetUnits = -8;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 4, 64), mat);
  image(art).then((img) => {
    if (!img) return;
    const w = (h * img.naturalWidth) / img.naturalHeight, half = SLEEVE.w / 2;
    const pos = mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = x + pos.getX(i) * w, py = y + pos.getY(i) * h, nx = px / half, ny = py / half;
      const warp = sleeve.warp * (0.85 * (nx * nx * ny * ny) + 0.15 * ny * ny * Math.abs(nx));
      pos.setXYZ(i, px, py, SLEEVE.t / 2 + warp + 0.004);
    }
    pos.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
    mesh.geometry.computeBoundingSphere();
  });
  mesh.receiveShadow = true;
  return mesh;
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
  if (m.dieCut) sleeve.setDieCut(true);
  if (m.sticker) sleeve.mesh.add(sleeveSticker(sleeve, m.sticker));
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
      mat.map = await once(`art|${url}|${mask}|${seed}`, () => uploadOnce(sleeve.makeTex(img, seed, v)));
      sleeve.applySurface();
      if (side === 'front' && !m.edge) sleeve.setEdge(borderColor(img));
    });
  }

  // record, inside the jacket; it slides out to the right, turning on its spindle
  const vinyl = new Vinyl(baked.grooves);
  vinyl.setDust(0);
  vinyl.group.rotation.x = Math.PI / 2; // side A faces the camera
  vinyl.setStyle({ mode: 'solid', color: m.discFill || m.discColor || '#0b0b0b' });
  // die-cut window: the sleeve shows the part of this very record that sits behind the hole
  const syncWindow = () => m.dieCut && sleeve.syncDiscMaterial(vinyl.material);
  syncWindow();
  if (m.disc)
    image(m.disc).then(async (img) => {
      if (img) vinyl.setStyle({ mode: 'texture', map: await once(`disc|${m.disc}`, () => uploadOnce(discTextureFromImage(img))) });
      syncWindow();
    });
  vinyl.labelA.visible = vinyl.labelB.visible = !!m.label;
  if (m.label) {
    const label = (url) => once(`label|${url}`, () => image(url).then((img) => img && imgTex(img)));
    Promise.all([label(m.label), label(m.labelB || m.label)]).then(([a, b]) => {
      vinyl.setLabels(a, b);
      if (m.dieCut) sleeve.setLabels(a, b);
    });
  }
  inner.add(vinyl.group);

  // the part of the record still in the sleeve is clipped away, so it can't poke through the warped board
  const clip = new THREE.Plane();
  const opening = new THREE.Plane(new THREE.Vector3(1, 0, 0), -(SLEEVE.w / 2 - 0.05));
  vinyl.setClip(clip);

  // the layout box is computed with the disc a little out (model.rest, cm; 0 = all the way in, e.g. behind a die-cut
  // window), so the object turns about the middle of its silhouette. In the product page it slides out until the middle of the label is at the mouth of the sleeve (half the label
  // shows); the whole thing is re-centred and scaled down as it gets wider, so it keeps its place and size on screen.
  const REST = m.rest ?? 5, OPEN = SLEEVE.w / 2; // disc centre, cm
  vinyl.group.position.x = REST;
  const root = normalise(inner);
  const holder = root.children[0];
  const x0 = inner.position.x, k0 = holder.scale.x, W0 = 1 / k0; // widest side at rest

  let spinSpeed = 0, windowKey = '';
  return {
    root,
    kind: 'vinyl',
    sleeveX: x0 * k0, // where the sleeve's centre sits in root units, and root units per cm (see buildBundle)
    perCm: k0,
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
      if (m.dieCut) {
        // rebuilt only when the record moved or turned under the window
        const key = `${g.position.x.toFixed(3)}|${vinyl.spin.rotation.y.toFixed(3)}`;
        if (key !== windowKey) {
          windowKey = key;
          sleeve.syncRecord(sleeve.mesh, vinyl);
        }
      }
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
    out.push(new THREE.Vector2(p.x > 0 ? Math.max(0, p.x - inset) : 0, inset ? Math.max(p.y, inset) : p.y));
  }
  return out;
}

// Height of the sauce's surface along its tilted "up" so that the amount of sauce stays the same: a table over the
// angle between up and the bottle's axis, computed once from the inside of the bottle sampled on a coarse grid
// (about 10k cells, a few ms). Returns a function of cos(angle).
let levelTable = null;
function sauceLevels(inside) {
  const N = 32;
  if (!levelTable) {
    const rAt = (y) => {
      for (let i = 1; i < inside.length; i++) {
        const a = inside[i - 1], b = inside[i];
        if (b.y > a.y && y <= b.y) return y < a.y ? 0 : a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y);
      }
      return 0;
    };
    const xs = [], ys = [], ws = [];
    let full = 0;
    const top = inside.at(-1).y, DY = 1.5, RINGS = 8, TURNS = 16;
    for (let y = inside[0].y + DY / 2; y < top; y += DY) {
      const R = rAt(y);
      for (let j = 0; j < RINGS; j++) {
        const r = ((j + 0.5) / RINGS) * R;
        for (let k = 0; k < TURNS; k++) {
          xs.push(r * Math.cos((k / TURNS) * Math.PI * 2));
          ys.push(y);
          ws.push(r * R);
          if (y <= LIQUID_TOP) full += r * R;
        }
      }
    }
    levelTable = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI, sa = Math.sin(a), ca = Math.cos(a);
      let lo = -100, hi = 200;
      for (let it = 0; it < 24; it++) {
        const d = (lo + hi) / 2;
        let v = 0;
        for (let n = 0; n < xs.length; n++) if (xs[n] * sa + ys[n] * ca <= d) v += ws[n];
        if (v < full) lo = d; else hi = d;
      }
      levelTable[i] = (lo + hi) / 2;
    }
  }
  return (cos) => {
    const f = (Math.acos(Math.min(1, Math.max(-1, cos))) / Math.PI) * N, i = Math.min(N - 1, Math.floor(f));
    return levelTable[i] + (levelTable[i + 1] - levelTable[i]) * (f - i);
  };
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
// flat: a sticker on a flat board. With no curvature to spread the hues, the bands come from the reflected view ray
// and run along the sticker; the foil is pearlier (less mirror, more of its own colour) so it stays iridescent even
// where it faces the dark part of the room.
function holoLabel(url, { flat = false } = {}) {
  const mat = new THREE.MeshPhysicalMaterial({
    map: tex(url),
    metalness: 1,
    roughness: 0.24,
    envMapIntensity: 3.4,
    clearcoat: 0.5,
    clearcoatRoughness: 0.12,
  });
  const hue = flat
    ? /* glsl */ `vec3 refl = reflect( - eye, normal );
        float h = 1.7 * refl.x + 1.1 * refl.y + 1.4 * vMapUv.y + 0.3 * vMapUv.x
          + 0.05 * sin( vMapUv.y * 240.0 + 4.0 * sin( vMapUv.x * 14.0 ) ) + 0.03 * sin( vMapUv.x * 90.0 );`
    : /* glsl */ `float h = 1.3 * normal.x + 0.55 * normal.y + 0.9 * ( 1.0 - dot( normal, eye ) )
          + 0.07 * sin( vMapUv.x * 70.0 + 3.0 * sin( vMapUv.y * 9.0 ) ) + 0.04 * sin( vMapUv.y * 160.0 );`;
  const [tint, metal, glow] = flat ? ['0.85', '0.45', '0.5'] : ['0.5', '1.0', '0.12'];
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'void main() {\n  vec3 foilGlow = vec3( 0.0 );').replace(
      '#include <clearcoat_normal_fragment_begin>',
      /* glsl */ `
      {
        float ink = 1.0 - smoothstep( 0.25, 0.75, texture2D( map, vMapUv ).r );
        vec3 eye = normalize( vViewPosition );
        // grating: the hue depends on the tilt of the foil towards the eye, plus a little of the foil's own pattern
        ${hue}
        vec3 rainbow = 0.5 + 0.5 * cos( 6.28318 * ( h + vec3( 0.0, 0.33, 0.67 ) ) );
        vec3 foil = mix( vec3( 0.95 ), rainbow, ${tint} );
        diffuseColor.rgb = mix( foil, vec3( 0.015 ), ink );
        foilGlow = foil * ( 1.0 - ink );
        metalnessFactor = ${metal} * ( 1.0 - ink );
        roughnessFactor = mix( 0.16, 0.5, ink );
      }
      #include <clearcoat_normal_fragment_begin>`
    ).replace(
      '#include <lights_fragment_end>',
      // a foil never goes fully dark where the room behind the camera has nothing to reflect
      `#include <lights_fragment_end>\n  reflectedLight.indirectSpecular += foilGlow * ${glow};`
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

  // The sauce fills the whole inside of the bottle and a clipping plane is its surface; the inside faces seen through
  // that cut are shaded as the flat top of the sauce. The plane leans with gravity, a little late since the sauce
  // is thick, at the height that keeps the same amount of sauce (see sauceLevels).
  const surface = new THREE.Plane();
  const liquidMat = new THREE.MeshPhysicalMaterial({
    color: m.liquid,
    roughness: 0.3,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    sheen: 0.2,
    sheenColor: new THREE.Color(m.liquid).offsetHSL(0, 0, 0.2),
    emissive: new THREE.Color(m.liquid),
    emissiveIntensity: 0.05,
    side: THREE.DoubleSide,
    clippingPlanes: [surface],
  });
  const surfaceUp = { value: new THREE.Vector3(0, 1, 0) }; // world space
  liquidMat.onBeforeCompile = (sh) => {
    sh.uniforms.surfaceUp = surfaceUp;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 surfaceUp;')
      .replace(
        '#include <lights_fragment_begin>',
        /* glsl */ `
        if ( ! gl_FrontFacing ) {
          normal = normalize( ( viewMatrix * vec4( surfaceUp, 0.0 ) ).xyz );
          #ifdef USE_CLEARCOAT
            clearcoatNormal = normal;
          #endif
        }
        #include <lights_fragment_begin>`
      );
  };
  const inside = bottleProfile(GLASS).slice(0, -1);
  inside.push(new THREE.Vector2(0, inside.at(-1).y));
  const liquid = new THREE.Mesh(new THREE.LatheGeometry(inside, 64), liquidMat);
  liquid.renderOrder = 1;
  const level = sauceLevels(inside);

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
  const up = new THREE.Vector3(0, 1, 0), upVel = new THREE.Vector3(), target = new THREE.Vector3(), q = new THREE.Quaternion();
  return {
    root,
    kind: 'sauce',
    update(dt, s) {
      t += dt;
      // the sauce sways a little, more when it is the product in focus
      inner.rotation.z = Math.sin(t * 1.3) * 0.02 * (0.4 + s.focus);
      // "up" seen from the bottle; the surface follows it on a soft, well damped spring: a thick sauce slides, it
      // doesn't slosh
      liquid.updateWorldMatrix(true, false);
      liquid.getWorldQuaternion(q);
      target.set(0, 1, 0).applyQuaternion(q.invert());
      upVel.addScaledVector(target.sub(up), 14 * dt).multiplyScalar(Math.exp(-6.5 * dt));
      up.addScaledVector(upVel, dt).normalize();
      surface.set(target.copy(up).negate(), level(up.y)).applyMatrix4(liquid.matrixWorld);
      surfaceUp.value.copy(surface.normal).negate();
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

// ---------- bundle ----------
// Two records side by side, fanned like cards in a hand: the first on the left and a little behind, the second
// overlapping it in front, both records all the way in their sleeves (rest: 0 in the catalogue). Both sleeves are drawn at the same size and each sways
// gently on its own; the pair keeps facing the viewer (faceFront: no idle turn in scene.js). In the product page they
// open up side by side. Model field: records (the model of each vinyl).
export function buildBundle(p) {
  const inner = new THREE.Group();
  const LAYOUT = [
    { x: -0.34, y: 0.05, z: -0.14, turn: 0.3, phase: 0 },
    { x: 0.34, y: -0.05, z: 0.14, turn: -0.3, phase: 2.2 },
  ];
  const parts = p.model.records.map((model, i) => {
    const rec = buildVinyl({ ...p, model });
    const f = 1 / (SLEEVE.w * rec.perCm); // sleeve width = 1
    rec.root.scale.setScalar(f);
    const pivot = new THREE.Group(); // turns about the sleeve's centre
    rec.root.position.x = -rec.sleeveX * f;
    pivot.add(rec.root);
    inner.add(pivot);
    return { rec, pivot, at: LAYOUT[i % 2] };
  });
  let t = 0;
  const place = (open, sway = 0) => {
    for (const { pivot, at } of parts) {
      // closed: overlapping fan; open: side by side, a little apart
      pivot.position.set(at.x * (1 + 0.62 * open), at.y * (1 - open), at.z * (1 - open));
      pivot.rotation.y = at.turn * (1 - 0.6 * open) + sway * 0.12 * Math.sin(t * 0.7 + at.phase);
      pivot.rotation.z = sway * 0.025 * Math.sin(t * 0.5 + at.phase);
    }
  };
  place(0);
  const root = normalise(inner);
  return {
    root,
    kind: 'bundle',
    faceFront: true,
    update(dt, s) {
      t += dt;
      place(s.detail, 1 - s.detail * 0.7);
      // the records stay in their sleeves: sliding out, they would run into each other
      for (const { rec } of parts) rec.update(dt, { ...s, detail: 0 });
    },
  };
}

// ---------- record postcard ----------
// A postcard that plays on a turntable, in mm: the printed front is covered by a clear film cut with a groove around
// the centre hole, the back is a plain postcard (divider through the hole, address lines, a holographic Obsimo sticker
// as the stamp). Model fields: recto (the printed front, centred on the hole), sticker (the sticker cut out: black ink
// on white, white = bare foil, transparent around it).
const CARD = { w: 152, h: 105.7, t: 0.6, hole: 2.5, corner: 1, grooveIn: 14, grooveOut: 51 };
const STICKER = { h: 28, margin: 2.5, turn: 0.02 };

// The back, drawn as seen from behind (canvas left = the card's left when it is turned over).
function postcardVerso() {
  const W = 2048, H = Math.round(W * CARD.h / CARD.w), mm = W / CARD.w;
  return canvasTex(W, H, (g) => {
    g.fillStyle = '#f4f3ef';
    g.fillRect(0, 0, W, H);
    // divider, through the hole
    const line = g.createLinearGradient(0, 0.07 * H, 0, 0.93 * H);
    line.addColorStop(0, '#1f3f44');
    line.addColorStop(1, '#2c6b66');
    g.fillStyle = line;
    g.fillRect(W / 2 - 0.18 * mm, 0.07 * H, 0.36 * mm, 0.86 * H);
    // address lines
    g.fillStyle = '#9db2b0';
    for (const y of [0.385, 0.46, 0.54, 0.62, 0.7]) g.fillRect(0.55 * W, y * H, 0.39 * W, 0.24 * mm);
    g.fillStyle = '#8f9d9b';
    g.font = `500 ${1.5 * mm}px "Space Grotesk", sans-serif`;
    g.textAlign = 'center';
    g.letterSpacing = `${0.25 * mm}px`;
    g.fillText('MANUFACTURED BY VINYLPOST.CO', 0.72 * W, 0.955 * H);
  });
}

// The groove, computed in the shader from the position on the card: the film's anisotropic sheen runs along circles
// around the hole (a radial streak of light, like on a record), with a few track gaps where the sheen fades.
function grooveFilm(material) {
  material.anisotropyMap = new THREE.DataTexture(new Uint8Array([255, 128, 255, 255]), 1, 1); // only switches the map path on
  material.anisotropyMap.needsUpdate = true;
  material.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace(
        'void main() {',
        /* glsl */ `
        float grooveBand( float r ) {
          float w = fwidth( r ) + 0.05;
          float band = smoothstep( ${CARD.grooveIn.toFixed(1)} - w, ${CARD.grooveIn.toFixed(1)} + w, r )
            * ( 1.0 - smoothstep( ${CARD.grooveOut.toFixed(1)} - w, ${CARD.grooveOut.toFixed(1)} + w, r ) );
          float gap = 0.0;
          for ( int i = 0; i < 4; i ++ ) gap = max( gap, 1.0 - smoothstep( 0.12, 0.3 + w, abs( r - ( 20.0 + 8.0 * float( i ) ) ) ) );
          // louder passages are cut wider: the sheen swells and fades across the band
          float loud = 0.78 + 0.22 * sin( r * 1.7 ) * sin( r * 0.61 + 1.3 );
          return band * loud * ( 1.0 - 0.75 * gap );
        }
        vec3 grooveAniso( vec2 uv ) {
          vec2 p = ( uv - 0.5 ) * vec2( ${CARD.w.toFixed(1)}, ${CARD.h.toFixed(1)} );
          float r = max( length( p ), 1e-3 );
          return vec3( vec2( - p.y, p.x ) / r * 0.5 + 0.5, grooveBand( r ) );
        }
        void main() {`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        // the cut film is glossier than the bare laminate around it
        `#include <roughnessmap_fragment>
        roughnessFactor = mix( roughnessFactor, 0.14, grooveAniso( vAnisotropyMapUv ).b );`
      )
      .replace('texture2D( anisotropyMap, vAnisotropyMapUv ).rgb', 'grooveAniso( vAnisotropyMapUv )')
      .replace(
        '#include <lights_physical_fragment>',
        // the cut grooves catch more light than the flat film, and split it a little like a grating: the streak
        // shifts through the rainbow with the angle
        /* glsl */ `#include <lights_physical_fragment>
        {
          float gb = grooveAniso( vAnisotropyMapUv ).b;
          float h = 1.6 * dot( normal, normalize( vViewPosition ) ) + 0.012 * length( ( vAnisotropyMapUv - 0.5 ) * vec2( ${CARD.w.toFixed(1)}, ${CARD.h.toFixed(1)} ) );
          vec3 rainbow = 0.5 + 0.5 * cos( 6.28318 * ( h + vec3( 0.0, 0.33, 0.67 ) ) );
          vec3 boost = ( 1.0 + 1.2 * gb ) * mix( vec3( 1.0 ), 1.5 * rainbow, 0.3 * gb );
          material.specularColor *= boost;
          material.specularColorBlended *= boost;
        }`
      );
  };
  return material;
}

export function buildPostcard(p) {
  const m = p.model;
  const { w: W, h: H, t: T, hole, corner: c } = CARD;
  const shape = new THREE.Shape();
  shape.moveTo(-W / 2 + c, -H / 2);
  shape.lineTo(W / 2 - c, -H / 2);
  shape.quadraticCurveTo(W / 2, -H / 2, W / 2, -H / 2 + c);
  shape.lineTo(W / 2, H / 2 - c);
  shape.quadraticCurveTo(W / 2, H / 2, W / 2 - c, H / 2);
  shape.lineTo(-W / 2 + c, H / 2);
  shape.quadraticCurveTo(-W / 2, H / 2, -W / 2, H / 2 - c);
  shape.lineTo(-W / 2, -H / 2 + c);
  shape.quadraticCurveTo(-W / 2, -H / 2, -W / 2 + c, -H / 2);
  const spindle = new THREE.Path();
  spindle.absarc(0, 0, hole, 0, Math.PI * 2, true);
  shape.holes.push(spindle);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false, curveSegments: 24 });
  geo.translate(0, 0, -T / 2);
  // ExtrudeGeometry puts both faces in group 0 (back half, then front half) and the edge in group 1: one material each
  const [lids, sides] = geo.groups;
  const half = lids.count / 2;
  geo.clearGroups();
  geo.addGroup(lids.start, half, 0); // back
  geo.addGroup(lids.start + half, half, 1); // front
  geo.addGroup(sides.start, sides.count, 2);
  // card UVs on both faces; the back is read from behind, so mirrored
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = lids.start; i < lids.start + lids.count; i++) {
    const x = pos.getX(i) / W, y = pos.getY(i) / H + 0.5;
    uv.setXY(i, i < lids.start + half ? 0.5 - x : 0.5 + x, y);
  }

  const verso = new THREE.MeshPhysicalMaterial({ map: uploadOnce(postcardVerso()), roughness: 0.85, sheen: 0.3, sheenRoughness: 0.7, sheenColor: 0xffffff });
  const recto = grooveFilm(
    new THREE.MeshPhysicalMaterial({ map: tex(m.recto), color: 0xe0e0e0, roughness: 0.3, anisotropy: 0.9, ior: 1.5, specularIntensity: 0.8, envMapIntensity: 0.7 })
  );
  const edge = new THREE.MeshStandardMaterial({ color: '#efede8', roughness: 0.9 });
  const card = new THREE.Mesh(geo, [verso, recto, edge]);

  // the stamp: holographic sticker in the top right corner of the back
  const spinner = new THREE.Group(); // turns on the spindle
  spinner.add(card);
  if (m.sticker) {
    const mat = holoLabel(m.sticker, { flat: true });
    mat.alphaTest = 0.5; // die-cut outline
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -2;
    mat.polygonOffsetUnits = -8;
    const sticker = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    sticker.rotation.set(0, Math.PI, STICKER.turn);
    sticker.scale.set(STICKER.h, STICKER.h, 1);
    const place = (aspect) => {
      const w = STICKER.h * aspect;
      sticker.scale.x = w;
      sticker.position.set(-(W / 2 - STICKER.margin - w / 2), H / 2 - STICKER.margin - STICKER.h / 2, -T / 2 - 0.05);
    };
    place(0.92);
    image(m.sticker).then((img) => img && place(img.naturalWidth / img.naturalHeight));
    spinner.add(sticker);
  }

  const inner = new THREE.Group();
  inner.add(spinner);
  const root = normalise(inner);

  // in the product page it turns on the platter like a record: 33 rpm while its music plays, slowly otherwise;
  // closed, it comes back upright
  let speed = 0;
  return {
    root,
    kind: 'postcard',
    update(dt, s) {
      const target = s.detail > 0.5 ? (s.playing ? 3.49 : 0.5) : 0;
      speed += (target - speed) * (1 - Math.exp(-dt * 2));
      spinner.rotation.z -= speed * dt;
      if (!target) {
        const upright = Math.round(spinner.rotation.z / (2 * Math.PI)) * 2 * Math.PI;
        spinner.rotation.z += (upright - spinner.rotation.z) * (1 - Math.exp(-dt * 3));
      }
    },
  };
}

export function buildModel(p) {
  if (p.kind === 'vinyl') return buildVinyl(p);
  if (p.kind === 'postcard') return buildPostcard(p);
  if (p.kind === 'bundle') return buildBundle(p);
  if (p.kind === 'sauce') return buildSauce(p);
  return buildCard(p);
}
