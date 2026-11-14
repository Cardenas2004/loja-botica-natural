// @ts-check
/**
 * Captura screenshots em 10 larguras (320, 375, 390, 430, 768, 1024, 1280, 1440, 1920, 2560 px)
 * para index.html, produtos.html e produto.html?id=prod-1.
 * Uso: node scripts/capture-screenshots.mjs [baseline|after]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { setupPageMocks } from '../tests/e2e/helpers.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const targetSubdir = process.argv[2] || 'baseline';
const OUT_DIR = path.join(ROOT, 'test-results', targetSubdir);

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
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

function startStaticServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      try {
        const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        let pathname = decodeURIComponent(parsedUrl.pathname);
        if (pathname.endsWith('/')) pathname += 'index.html';
        const safePath = path.normalize(path.join(ROOT, pathname));
        if (!safePath.startsWith(ROOT) || !fs.existsSync(safePath) || fs.statSync(safePath).isDirectory()) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404');
          return;
        }
        const ext = path.extname(safePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(fs.readFileSync(safePath));
      } catch (e) {
        res.writeHead(500);
        res.end(String(e));
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 3000;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

const WIDTHS = [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920, 2560];
const PAGES = [
  { name: 'index', url: '/index.html' },
  { name: 'produtos', url: '/produtos.html' },
  { name: 'produto', url: '/produto.html?id=prod-1' },
];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const { server, baseUrl } = await startStaticServer();
  const browser = await chromium.launch();

  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await setupPageMocks(page);

    for (const p of PAGES) {
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: 900 });
        await page.goto(`${baseUrl}${p.url}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(150);
        const filePath = path.join(OUT_DIR, `${p.name}-${w}px.png`);
        await page.screenshot({ path: filePath, fullPage: false });
        console.log(`[screenshot] ${path.relative(ROOT, filePath)}`);
      }
    }
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
