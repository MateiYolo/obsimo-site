// The procedural maps of the mockup generator (grooves, board fibres, label paper, spot varnish) take 1-2 s of main
// thread to generate, more on phones. The shop loads them from files baked once by bake.html instead
// (npm run dev, open /bake.html, commit public/assets/hifi/baked/).
//
// Every map is stored one channel per greyscale WebP (lossy WebP subsamples colour, which would smear channels packed
// in one image) and packed back into R/G/B on a canvas.
import * as THREE from 'three';
import { useBakedMaps } from './objects.js';
import { makeVarnishMaps, releaseCanvas } from './textures.js';

export const BAKED_DIR = `${import.meta.env.BASE_URL}assets/hifi/baked/`;
export const VARNISH_PX = 1024;

// every file bake.html writes: map -> one file per channel (R, G, B)
export const FILES = {
  groovesSurface: ['grooves-bump.webp', 'grooves-rough.webp'], // height, roughness
  groovesAniso: ['grooves-dir-x.webp', 'grooves-dir-y.webp', 'grooves-aniso.webp'], // groove direction, strength
  board: ['board-height.webp', 'board-rough.webp'],
  labelBump: ['label-bump.webp'],
};
// baked varnish maps are named after the mask file: varnish-front.png -> varnish-front.mask.webp, ...
export const varnishName = (url) => url.split(/[?#]/)[0].split('/').pop().replace(/\.[^.]+$/, '');
export const VARNISH_FILES = {
  mask: ['mask.webp'],
  tint: ['tint.webp'],
  normal: ['normal-x.webp', 'normal-y.webp', 'normal-z.webp'],
  surface: ['height.webp', 'rough.webp'],
};

const dataTex = () => {
  const t = new THREE.Texture();
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
};
const fill = (tex, source) =>
  Promise.resolve(source).then((img) => {
    if (!img) return;
    tex.image = img;
    tex.needsUpdate = true;
  });

// Greyscale images -> one canvas with R = first, G = second, B = third (on the canvas compositor, no pixel loop).
async function pack(sources) {
  const imgs = await Promise.all(sources);
  if (imgs.some((i) => !i)) return null;
  if (imgs.length === 1) return imgs[0];
  const w = imgs[0].naturalWidth, h = imgs[0].naturalHeight;
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const x = out.getContext('2d');
  imgs.forEach((img, i) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const cx = c.getContext('2d');
    cx.drawImage(img, 0, 0);
    cx.globalCompositeOperation = 'multiply';
    cx.fillStyle = ['#ff0000', '#00ff00', '#0000ff'][i];
    cx.fillRect(0, 0, w, h);
    x.globalCompositeOperation = i ? 'lighter' : 'source-over';
    x.drawImage(c, 0, 0);
    releaseCanvas(c);
  });
  return out;
}
const packFiles = (image, base, names) => pack(names.map((n) => image(base + n)));

// Empty textures right away (the materials are built synchronously), filled as the files arrive.
// image(url) -> Promise<HTMLImageElement | null>
export function loadBakedMaps(image) {
  const f = (k) => packFiles(image, BAKED_DIR, FILES[k]);
  const maps = { grooves: { surface: dataTex(), aniso: dataTex() }, board: dataTex(), labelBump: dataTex(), dust: dataTex() };
  fill(maps.grooves.surface, f('groovesSurface'));
  fill(maps.grooves.aniso, f('groovesAniso'));
  maps.boardCanvas = f('board');
  fill(maps.board, maps.boardCanvas);
  fill(maps.labelBump, f('labelBump'));
  useBakedMaps(maps);
  return maps;
}

// Spot varnish maps of a mask: baked files, or generated here when the mask has not been baked (slow path).
const varnishes = new Map();
export function loadVarnish(url, image, maps) {
  if (varnishes.has(url)) return varnishes.get(url);
  const base = `${BAKED_DIR}${varnishName(url)}.`;
  const load = (async () => {
    const [mask, normal, tint, surface] = await Promise.all(
      ['mask', 'normal', 'tint', 'surface'].map((k) => packFiles(image, base, VARNISH_FILES[k])),
    );
    if (mask && normal && tint && surface) {
      const t = (img) => { const x = dataTex(); fill(x, img); return x; };
      return { mask: t(mask), normal: t(normal), tint, surface: t(surface) };
    }
    console.warn(`Vernis non baké (${url}) : généré au chargement, lancer /bake.html`);
    const [img, board] = await Promise.all([image(url), maps.boardCanvas]);
    return img && board ? makeVarnishMaps(img, VARNISH_PX, board) : null;
  })();
  varnishes.set(url, load);
  return load;
}
