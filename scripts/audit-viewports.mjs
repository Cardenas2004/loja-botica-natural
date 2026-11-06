// @ts-check
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

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
};

function startStaticServer(port = 3000) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      try {
        const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        let pathname = decodeURIComponent(parsedUrl.pathname);
        if (pathname.endsWith('/')) {
          pathname += 'index.html';
        }
        const safePath = path.normalize(path.join(ROOT, pathname));
        if (!safePath.startsWith(ROOT) || !fs.existsSync(safePath) || fs.statSync(safePath).isDirectory()) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
          return;
        }
        const ext = path.extname(safePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
        res.end(fs.readFileSync(safePath));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`500 Internal Error: ${err.message}`);
      }
    });

    server.listen(port, '127.0.0.1', () => resolve(server));
    server.on('error', (err) => {
      // @ts-ignore
      if (err.code === 'EADDRINUSE') {
        console.log(`Porta ${port} já em uso, conectando ao servidor existente...`);
        resolve(null);
      }
    });
  });
}

const VIEWPORTS = [
  { width: 320, height: 568, name: '320x568 (iPhone SE)' },
  { width: 360, height: 640, name: '360x640 (Galaxy S8/Android)' },
  { width: 390, height: 844, name: '390x844 (iPhone 12/13/14)' },
  { width: 430, height: 932, name: '430x932 (iPhone 14/15 Pro Max)' },
  { width: 600, height: 960, name: '600x960 (Small Tablet)' },
  { width: 768, height: 1024, name: '768x1024 (iPad Mini)' },
  { width: 820, height: 1180, name: '820x1180 (iPad Air)' },
  { width: 1024, height: 768, name: '1024x768 (Desktop/iPad Landscape)' },
  { width: 1280, height: 720, name: '1280x720 (HD Laptop)' },
  { width: 1366, height: 768, name: '1366x768 (Standard Laptop)' },
  { width: 1440, height: 900, name: '1440x900 (MacBook Pro)' },
  { width: 1920, height: 1080, name: '1920x1080 (FHD Desktop)' },
  { width: 2560, height: 1440, name: '2560x1440 (QHD Desktop)' },
];

const PAGES = [
  { url: 'http://127.0.0.1:3000/index.html', name: 'Home (index.html)' },
  { url: 'http://127.0.0.1:3000/produtos.html', name: 'Catálogo (produtos.html)' },
  { url: 'http://127.0.0.1:3000/produto.html', name: 'Detalhe Produto (produto.html)' },
  { url: 'http://127.0.0.1:3000/privacidade.html', name: 'Privacidade (privacidade.html)' },
  { url: 'http://127.0.0.1:3000/admin.html', name: 'Admin (admin.html)' },
];

const FAKE_SUPABASE_CODE = fs.readFileSync(
  path.join(ROOT, 'tests/e2e/fixtures/fake-supabase.js'),
  'utf8'
);

const SCREENSHOT_DIR = path.join(ROOT, 'artifacts/screenshots/baseline');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function runAudit() {
  console.log('=== INICIANDO AUDITORIA RESPONSIVA DE VIEWPORTS (ETAPA 0) ===\n');

  const server = await startStaticServer(3000);
  const browser = await chromium.launch();
  const report = [];

  for (const pageDef of PAGES) {
    console.log(`\n--- Auditando Página: ${pageDef.name} ---`);
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();

      // Intercept mock supabase
      await page.route(/.*(@supabase\/supabase-js|supabase-js).*/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/javascript; charset=utf-8',
          body: FAKE_SUPABASE_CODE,
        });
      });
      await page.route(/.*fake-storage\.local.*/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#E2D9F3"/></svg>',
        });
      });

      try {
        await page.goto(pageDef.url, { waitUntil: 'networkidle', timeout: 8000 });
      } catch (err) {
        try {
          await page.goto(pageDef.url, { waitUntil: 'domcontentloaded', timeout: 5000 });
        } catch (e) {
          console.error(`Erro ao carregar ${pageDef.name} em ${vp.name}:`, e.message);
        }
      }

      await page.waitForTimeout(300);

      // 1. Horizontal overflow check
      const overflowMetrics = await page.evaluate(() => {
        const docEl = document.documentElement;
        const body = document.body;
        const scrollWidth = Math.max(docEl.scrollWidth, body.scrollWidth);
        const clientWidth = docEl.clientWidth;
        const diff = scrollWidth - clientWidth;

        // Find elements that bleed beyond clientWidth
        const bleedingElements = [];
        const allElements = document.querySelectorAll('*');
        for (const el of allElements) {
          const rect = el.getBoundingClientRect();
          if (rect.right > clientWidth + 1) {
            bleedingElements.push({
              tag: el.tagName.toLowerCase(),
              className: (el.className || '').toString().slice(0, 50),
              id: el.id || '',
              right: Math.round(rect.right),
              width: Math.round(rect.width),
            });
          }
        }

        return {
          scrollWidth,
          clientWidth,
          hasOverflow: diff > 1,
          diff,
          bleedingCount: bleedingElements.length,
          topBleeders: bleedingElements.slice(0, 3),
        };
      });

      // 2. Product grid columns check (if page has products-grid)
      const gridMetrics = await page.evaluate(() => {
        const grid = document.querySelector('.products-grid');
        if (!grid) return null;
        const cards = Array.from(grid.querySelectorAll('.product-card'));
        if (cards.length === 0) return null;

        const style = window.getComputedStyle(grid);
        const colTemplate = style.getPropertyValue('grid-template-columns');
        const computedCols = colTemplate.split(' ').filter(Boolean).length;

        // Group cards by vertical top offset
        const rowMap = new Map();
        cards.forEach((c) => {
          const rect = c.getBoundingClientRect();
          const topKey = Math.round(rect.top);
          // fuzzy row matching within 8px
          let foundKey = null;
          for (const k of rowMap.keys()) {
            if (Math.abs(k - topKey) <= 8) {
              foundKey = k;
              break;
            }
          }
          if (foundKey !== null) {
            rowMap.get(foundKey).push(rect);
          } else {
            rowMap.set(topKey, [rect]);
          }
        });

        const cardsPerRow = Array.from(rowMap.values()).map((r) => r.length);
        const avgCardsPerRow = cardsPerRow.length > 0
          ? Math.max(...cardsPerRow)
          : computedCols;

        // Card height uniformity check
        let heightDiscrepancy = 0;
        for (const row of rowMap.values()) {
          if (row.length > 1) {
            const heights = row.map((r) => Math.round(r.height));
            const minH = Math.min(...heights);
            const maxH = Math.max(...heights);
            if (maxH - minH > heightDiscrepancy) heightDiscrepancy = maxH - minH;
          }
        }

        return {
          computedCols,
          avgCardsPerRow,
          cardCount: cards.length,
          heightDiscrepancy,
          firstCardWidth: Math.round(cards[0].getBoundingClientRect().width),
        };
      });

      // 3. Touch target check (< 44x44px interactive elements)
      const touchMetrics = await page.evaluate(() => {
        const interactives = Array.from(
          document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]')
        );
        const smallTargets = [];
        for (const el of interactives) {
          // ignore hidden or zero size elements
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;

          // Touch target minimum: 44px
          if (rect.width < 43 || rect.height < 43) {
            smallTargets.push({
              tag: el.tagName.toLowerCase(),
              text: (el.textContent || '').trim().slice(0, 30),
              className: (el.className || '').toString().slice(0, 40),
              w: Math.round(rect.width),
              h: Math.round(rect.height),
            });
          }
        }
        return {
          totalInteractive: interactives.length,
          smallCount: smallTargets.length,
          samples: smallTargets.slice(0, 5),
        };
      });

      // 4. Header & Drawer layout
      const headerMetrics = await page.evaluate(() => {
        const header = document.querySelector('header, .header');
        const hamburger = document.querySelector('.hamburger-btn, .menu-toggle, [aria-label*="menu" i]');
        const nav = document.querySelector('.nav-menu, .nav, nav');
        return {
          hasHeader: Boolean(header),
          hasHamburger: Boolean(hamburger),
          isHamburgerVisible: hamburger ? window.getComputedStyle(hamburger).display !== 'none' : false,
          isNavVisible: nav ? window.getComputedStyle(nav).display !== 'none' : false,
        };
      });

      // Screenshot filename
      const cleanPageName = path.basename(pageDef.url).replace('.html', '');
      const ssPath = path.join(SCREENSHOT_DIR, `${cleanPageName}-${vp.width}x${vp.height}.png`);
      await page.screenshot({ path: ssPath, fullPage: false });

      const entry = {
        page: cleanPageName,
        viewport: `${vp.width}x${vp.height}`,
        vpName: vp.name,
        overflow: overflowMetrics,
        grid: gridMetrics,
        touch: touchMetrics,
        header: headerMetrics,
        screenshot: ssPath,
      };

      report.push(entry);

      const statusOverflow = overflowMetrics.hasOverflow ? `⚠️ OVERFLOW (+${overflowMetrics.diff}px)` : '✅ No overflow';
      const statusGrid = gridMetrics ? `Grid: ${gridMetrics.computedCols} cols (${gridMetrics.firstCardWidth}px card)` : 'No grid';
      const statusTouch = touchMetrics.smallCount > 0 ? `⚠️ ${touchMetrics.smallCount} small targets` : '✅ Touch targets OK';

      console.log(`[${vp.width}x${vp.height}] ${statusOverflow} | ${statusGrid} | ${statusTouch}`);

      await context.close();
    }
  }

  await browser.close();
  if (server) server.close();

  // Save report to artifacts
  const reportPath = path.join(ROOT, 'artifacts/audit-baseline-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nRelatório salvo com sucesso em: ${reportPath}`);
}

runAudit().catch((err) => {
  console.error('Falha na auditoria:', err);
  process.exit(1);
});
