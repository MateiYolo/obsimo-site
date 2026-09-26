// Dev page (bake.html): generates the mockup's procedural maps once and writes them to public/assets/hifi/baked/
// through the /__bake endpoint of vite.config.js. Re-run it after changing textures.js or adding a varnish mask.
import { makeGrooveMaps, makeBoardSurface, makeLabelBump, makeVarnishMaps } from './textures.js';
import { FILES, VARNISH_FILES, VARNISH_PX, varnishName } from './baked.js';
import { demoCatalog, visuals } from '../catalog.js';

const log = (s) => (document.getElementById('log').textContent += s + '\n');

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
// one channel of a map as a greyscale canvas
function channel(src, ch) {
  const c = canvas(src.width, src.height);
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(src, 0, 0);
  const img = x.getImageData(0, 0, c.width, c.height), d = img.data;
  for (let o = 0; o < d.length; o += 4) { d[o] = d[o + 1] = d[o + 2] = d[o + ch]; d[o + 3] = 255; }
  x.putImageData(img, 0, 0);
  return c;
}
function resize(src, size) {
  const c = canvas(size);
  const x = c.getContext('2d', { willReadFrequently: true });
  x.imageSmoothingQuality = 'high';
  x.drawImage(src, 0, 0, size, size);
  return c;
}
async function save(name, c, q) {
  const blob = await new Promise((r) => c.toBlob(r, 'image/webp', q));
  const res = await fetch(`/__bake/${name}`, { method: 'POST', body: blob });
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  log(`${name.padEnd(28)} ${c.width}px  ${(blob.size / 1024).toFixed(0)} Ko`);
}
const load = (url) => new Promise((ok, ko) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = ko; i.src = url; });

// Sizes and qualities: what the shop displays (a record is at most ~1000 device px wide), not the mockup's 4K stills.
const GROOVE_PX = 1024, LABEL_PX = 512;

// one file per channel of a map
async function saveMap(src, names, q, base = '') {
  for (let i = 0; i < names.length; i++) await save(base + names[i], channel(src, i), q);
}

async function bake() {
  const g = makeGrooveMaps(2048); // generated at the mockup's size, so the grooves average out when scaled down
  await saveMap(resize(g.surface.image, GROOVE_PX), FILES.groovesSurface, 0.85);
  await saveMap(g.aniso.image, FILES.groovesAniso, 0.85);

  // generated at the mockup's size so the fibres keep their scale, stored at the size the shop needs
  const board = resize(makeBoardSurface(2048).image, VARNISH_PX);
  await saveMap(board, FILES.board, 0.7);
  await saveMap(resize(makeLabelBump(1024).image, LABEL_PX), FILES.labelBump, 0.8);

  const masks = new Set();
  for (const p of [...demoCatalog, ...Object.values(visuals)])
    for (const k of ['varnishFront', 'varnishBack']) if (p.model?.[k]) masks.add(p.model[k]);
  for (const url of masks) {
    const v = makeVarnishMaps(await load(url), VARNISH_PX, board);
    const base = `${varnishName(url)}.`;
    await saveMap(v.mask.image, VARNISH_FILES.mask, 0.9, base);
    await saveMap(v.tint, VARNISH_FILES.tint, 0.9, base);
    await saveMap(v.normal.image, VARNISH_FILES.normal, 0.9, base);
    await saveMap(v.surface.image, VARNISH_FILES.surface, 0.75, base);
  }
  log('\nterminé');
  document.title += ' · terminé';
}
bake().catch((e) => { log('ERREUR ' + e.message); document.title += ' · erreur'; });
