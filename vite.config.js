import { defineConfig, loadEnv } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// Dev only: bake.html posts the generated textures here, written to public/assets/hifi/baked/.
const bake = {
  name: 'bake-textures',
  apply: 'serve',
  configureServer(server) {
    const dir = path.resolve('public/assets/hifi/baked');
    server.middlewares.use('/__bake/', (req, res) => {
      if (req.method !== 'POST') return res.writeHead(405).end();
      const name = path.basename(decodeURIComponent(req.url));
      if (!/^[\w.-]+\.webp$/.test(name)) return res.writeHead(400).end();
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, name), Buffer.concat(chunks));
        res.end('ok');
      });
    });
  },
};

// Dev only: serves the Vercel functions of api/ (export GET / POST, Web Request → Response) with the variables of
// .env.local, so the /ventes dashboard works with `npm run dev`.
const api = {
  name: 'vercel-functions',
  apply: 'serve',
  configureServer(server) {
    Object.assign(process.env, loadEnv('development', process.cwd(), ''));
    server.middlewares.use('/api/', async (req, res, next) => {
      const url = new URL(req.url, 'http://localhost');
      const file = path.resolve('api', `${url.pathname.replace(/^\/+/, '')}.js`);
      if (!file.startsWith(path.resolve('api')) || path.basename(file).startsWith('_') || !fs.existsSync(file)) return next();
      try {
        const mod = await server.ssrLoadModule(file);
        const handler = mod[req.method];
        if (!handler) return res.writeHead(405).end();
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const body = chunks.length ? Buffer.concat(chunks) : undefined;
        const request = new Request(new URL(req.originalUrl, `http://${req.headers.host}`), { method: req.method, headers: req.headers, body });
        const response = await handler(request);
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch (e) {
        console.error(e);
        res.writeHead(500).end(String(e));
      }
    });
  },
};

export default defineConfig({
  plugins: [bake, api],
  build: {
    // the shop and the sales dashboard (/ventes/, password-protected through its API)
    rolldownOptions: {
      input: { main: path.resolve('index.html'), ventes: path.resolve('ventes/index.html') },
      // three.js in its own file: it changes far less often than the site, so browsers keep it cached across deploys
      output: { codeSplitting: { groups: [{ name: 'three', test: /node_modules[\\/]three[\\/]/ }] } },
    },
    chunkSizeWarningLimit: 700, // three.js alone is ~580 kB minified (~150 kB gzip)
  },
});
