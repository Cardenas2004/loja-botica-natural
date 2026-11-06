// @ts-check
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const ARTIFACTS_DIR = path.join(ROOT, 'artifacts/reproduction');

fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

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

function createStaticServer(port = 3456) {
  const server = http.createServer((req, res) => {
    try {
      const parsedUrl = new URL(req.url || '/', `http://127.0.0.1:${port}`);
      let pathname = decodeURIComponent(parsedUrl.pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';

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
      res.end(`500: ${err.message}`);
    }
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

const FAKE_SUPABASE_CODE = fs.readFileSync(
  path.join(ROOT, 'tests/e2e/fixtures/fake-supabase.js'),
  'utf8'
);

const DEVICES = [
  { name: 'iPhone_SE', width: 375, height: 667, isMobile: true, hasTouch: true },
  { name: 'iPhone_13', width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: 'iPhone_15_Pro_Max', width: 430, height: 932, isMobile: true, hasTouch: true },
  { name: 'Pixel_7', width: 412, height: 915, isMobile: true, hasTouch: true },
  { name: 'Galaxy_S9_Plus', width: 320, height: 658, isMobile: true, hasTouch: true },
  { name: 'iPad_Mini', width: 768, height: 1024, isMobile: true, hasTouch: true },
];

const CATEGORY_SETS = [
  { label: '1_cat', count: 1 },
  { label: '3_cats', count: 3 },
  { label: '6_cats', count: 6 },
  { label: '10_cats_long', count: 10 },
];

const MOCK_CATEGORIES_10 = [
  { id: 'cat-1', name: 'Dermocosméticos Faciais Avançados', slug: 'dermocosmeticos', display_order: 1, is_active: true },
  { id: 'cat-2', name: 'Fitoterapia e Extratos Concentrados', slug: 'fitoterapia', display_order: 2, is_active: true },
  { id: 'cat-3', name: 'Cápsulas e Fitoterápicos Especiais', slug: 'capsulas', display_order: 3, is_active: true },
  { id: 'cat-4', name: 'Saúde Digestiva, Hepática & Gastro', slug: 'digestiva', display_order: 4, is_active: true },
  { id: 'cat-5', name: 'Longevidade e Gerenciamento de Peso', slug: 'longevidade', display_order: 5, is_active: true },
  { id: 'cat-6', name: 'Nutracêuticos Esportivos e Performance', slug: 'esporte', display_order: 6, is_active: true },
  { id: 'cat-7', name: 'Sono, Relaxamento e Modulação do Estresse', slug: 'sono', display_order: 7, is_active: true },
  { id: 'cat-8', name: 'Imunidade e Defesas Naturais', slug: 'imunidade', display_order: 8, is_active: true },
  { id: 'cat-9', name: 'Homeopatia e Florais Tradicionais', slug: 'homeopatia', display_order: 9, is_active: true },
  { id: 'cat-10', name: 'Cuidados Capilares e Dermatologia', slug: 'capilar', display_order: 10, is_active: true },
];

async function setupMocks(page, customCategories = null) {
  let customSupabaseCode = FAKE_SUPABASE_CODE;
  if (customCategories) {
    customSupabaseCode = customSupabaseCode.replace(
      /categories:\s*\[[\s\S]*?\],/,
      `categories: ${JSON.stringify(customCategories)},`
    );
  }

  await page.route(/.*(@supabase\/supabase-js|supabase-js).*/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript; charset=utf-8',
      body: customSupabaseCode,
    });
  });

  await page.route(/.*(fake-storage\.local|product-images).*/, async (route) => {
    // Retorna SVG de 1920x600 simulando o banner oficial panorâmico (16:5)
    const svg16_5 = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="600" viewBox="0 0 1920 600">
      <rect width="1920" height="600" fill="#3D1E6D"/>
      <circle cx="960" cy="300" r="180" fill="#6B3FA0"/>
      <text x="120" y="320" font-family="Arial" font-size="72" font-weight="bold" fill="#FFFFFF">TEXTO ESQUERDA BARRADO</text>
      <text x="960" y="320" font-family="Arial" font-size="72" font-weight="bold" fill="#F3EEFA" text-anchor="middle">CENTRO DA ARTE</text>
      <text x="1800" y="320" font-family="Arial" font-size="72" font-weight="bold" fill="#E8B44F" text-anchor="end">FINAL DIREITA PATA</text>
    </svg>`;
    await route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: svg16_5,
    });
  });

  await page.route(/.*(fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com).*/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/css', body: '' });
  });
}

async function runAudit() {
  console.log('[Audit] Iniciando auditoria e reprodução visual...');
  const server = /** @type {import('node:http').Server} */ (await createStaticServer(3456));
  const browsers = [
    { type: chromium, name: 'chromium' },
    { type: webkit, name: 'webkit' },
  ];

  const results = {
    carousel: [],
    tabs: [],
  };

  try {
    for (const { type, name: browserName } of browsers) {
      const browser = await type.launch({ headless: true });

      for (const dev of DEVICES) {
        const context = await browser.newContext({
          viewport: { width: dev.width, height: dev.height },
          isMobile: dev.isMobile,
          hasTouch: dev.hasTouch,
          deviceScaleFactor: 2,
        });

        const page = await context.newPage();
        page.on('console', (msg) => console.log(`[PAGE LOG ${dev.name}]`, msg.text()));
        page.on('pageerror', (err) => console.log(`[PAGE ERR ${dev.name}]`, err.message));

        // 1. CARROSSEL (index.html)
        await setupMocks(page);
        await page.goto('http://127.0.0.1:3456/index.html', { waitUntil: 'networkidle' });
        await page.waitForSelector('.promo__slide', { state: 'visible', timeout: 5000 });

      // Captura métricas do carrossel
      const carouselMetrics = await page.evaluate(() => {
        const carousel = document.querySelector('.promo__carousel');
        const slide = document.querySelector('.promo__slide');
        const img = document.querySelector('.promo__img') || document.querySelector('.promo__slide img');
        const pagination = document.querySelector('.promo__pagination');

        const cRect = carousel ? carousel.getBoundingClientRect() : null;
        const sRect = slide ? slide.getBoundingClientRect() : null;
        const iRect = img ? img.getBoundingClientRect() : null;
        const pRect = pagination ? pagination.getBoundingClientRect() : null;

        const cStyle = carousel ? window.getComputedStyle(carousel) : null;
        const sStyle = slide ? window.getComputedStyle(slide) : null;
        const iStyle = img ? window.getComputedStyle(img) : null;

        // Verifica se a paginação sobrepõe a imagem
        let paginationOverlapsImg = false;
        if (pRect && iRect) {
          paginationOverlapsImg = !(
            pRect.bottom <= iRect.top ||
            pRect.top >= iRect.bottom ||
            pRect.right <= iRect.left ||
            pRect.left >= iRect.right
          );
        }

        return {
          containerAspect: cStyle ? cStyle.aspectRatio : '',
          slideAspect: sStyle ? sStyle.aspectRatio : '',
          imgObjectFit: iStyle ? iStyle.objectFit : '',
          containerWidth: cRect ? cRect.width : 0,
          containerHeight: cRect ? cRect.height : 0,
          imgWidth: iRect ? iRect.width : 0,
          imgHeight: iRect ? iRect.height : 0,
          paginationOverlapsImg,
          paginationBottom: pRect ? pRect.bottom : 0,
          imgBottom: iRect ? iRect.bottom : 0,
        };
      });

      results.carousel.push({
        browser: browserName,
        device: dev.name,
        width: dev.width,
        ...carouselMetrics,
      });

      const carouselShot = path.join(ARTIFACTS_DIR, `carousel_${browserName}_${dev.name}.png`);
      await page.locator('.promo').screenshot({ path: carouselShot });

      // 2. CATEGORIAS (produtos.html) - Variando categorias e nomes longos
      for (const catSet of CATEGORY_SETS) {
        const cats = MOCK_CATEGORIES_10.slice(0, catSet.count);
        const catPage = await context.newPage();
        await setupMocks(catPage, cats);

        await catPage.goto('http://127.0.0.1:3456/produtos.html', { waitUntil: 'networkidle' });
        await catPage.waitForSelector('.catalog-tab', { state: 'visible', timeout: 5000 });

        const tabMetrics = await catPage.evaluate(() => {
          const tabs = Array.from(document.querySelectorAll('.catalog-tab'));
          return tabs.map((tab) => {
            const rect = tab.getBoundingClientRect();
            const style = window.getComputedStyle(tab);
            const countEl = tab.querySelector('.catalog-tab__count');
            const countRect = countEl ? countEl.getBoundingClientRect() : null;
            const labelEl = tab.querySelector('span:not(.catalog-tab__count)') || tab;
            const labelRect = labelEl ? labelEl.getBoundingClientRect() : null;

            let countOverlapsLabel = false;
            if (countRect && labelRect && countEl !== labelEl) {
              countOverlapsLabel = !(
                countRect.right <= labelRect.left ||
                countRect.left >= labelRect.right ||
                countRect.bottom <= labelRect.top ||
                countRect.top >= labelRect.bottom
              );
            }

            return {
              text: tab.textContent?.trim(),
              width: rect.width,
              height: rect.height,
              scrollWidth: tab.scrollWidth,
              clientWidth: tab.clientWidth,
              textClipped: tab.scrollWidth > tab.clientWidth + 1,
              isCircular: rect.width > 0 && Math.abs(rect.width - rect.height) < 4,
              flexShrink: style.flexShrink,
              countOverlapsLabel,
            };
          });
        });

        results.tabs.push({
          browser: browserName,
          device: dev.name,
          categorySet: catSet.label,
          tabCount: tabMetrics.length,
          tabs: tabMetrics,
        });

        const tabShot = path.join(
          ARTIFACTS_DIR,
          `tabs_${browserName}_${dev.name}_${catSet.label}.png`
        );
        const tabsNav = catPage.locator('.catalog-tabs-nav');
        if (await tabsNav.isVisible()) {
          await tabsNav.screenshot({ path: tabShot });
        }

        // Teste com fonte grande (20px)
        await catPage.evaluate(() => {
          document.documentElement.style.fontSize = '20px';
        });
        const tabShot20px = path.join(
          ARTIFACTS_DIR,
          `tabs_${browserName}_${dev.name}_${catSet.label}_font20px.png`
        );
        if (await tabsNav.isVisible()) {
          await tabsNav.screenshot({ path: tabShot20px });
        }

        await catPage.close();
      }

      await page.close();
      await context.close();
    }

    await browser.close();
  }

  const reportPath = path.join(ROOT, 'artifacts/reproduction_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`[Audit] Concluído! Relatório salvo em ${reportPath}`);
} finally {
  server.close();
}
}

runAudit().catch((err) => {
  console.error('[Audit] Falha:', err);
  process.exit(1);
});
