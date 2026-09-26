import { defineConfig } from 'vite';
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

export default defineConfig({ plugins: [bake] });
