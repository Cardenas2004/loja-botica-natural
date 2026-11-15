// @ts-check
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const PORT = Number(process.env.PORT) || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  try {
    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    // Redireciona /produtos/<slug> para /produtos/<slug>/ se existir diretório estático ou fallback
    const rawProductMatch = pathname.match(/^\/produtos\/([a-z0-9-]+)\/?$/i);
    if (pathname.endsWith('/')) {
      pathname += 'index.html';
    } else if (rawProductMatch && fs.existsSync(path.join(ROOT, 'produtos', rawProductMatch[1], 'index.html'))) {
      res.writeHead(301, { Location: `/produtos/${rawProductMatch[1]}/${parsedUrl.search}` });
      res.end();
      return;
    }

    const safePath = path.normalize(path.join(ROOT, pathname));
    if (!safePath.startsWith(ROOT)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('403 Forbidden');
      return;
    }

    if (!fs.existsSync(safePath) || fs.statSync(safePath).isDirectory()) {
      if (rawProductMatch) {
        res.writeHead(302, { Location: `/produto.html?slug=${encodeURIComponent(rawProductMatch[1])}` });
        res.end();
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = fs.readFileSync(safePath);

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    });
    res.end(content);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(`500 Internal Error: ${err.message}`);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[serve] Servidor estático rodando em http://127.0.0.1:${PORT}`);
});
