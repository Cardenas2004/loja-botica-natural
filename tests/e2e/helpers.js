// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '../..');

const FAKE_SUPABASE_CODE = fs.readFileSync(
  path.join(ROOT, 'tests/e2e/fixtures/fake-supabase.js'),
  'utf8'
);

/**
 * Configura o roteamento da página para usar o fake-supabase e bloquear requisições externas.
 * @param {import('@playwright/test').Page} page
 */
export async function setupPageMocks(page) {
  // 1. Intercepta requisição do supabase-js (tanto CDN jsdelivr quanto local /js/vendor/)
  await page.route(/.*(@supabase\/supabase-js|supabase-js).*/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript; charset=utf-8',
      body: FAKE_SUPABASE_CODE,
    });
  });

  // 2. Intercepta requisições de Storage simulado
  await page.route(/.*fake-storage\.local.*/, async (route) => {
    // Retorna SVG transparente mínimo ou WebP mock de 1x1 pixel
    const transparentSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#E2D9F3"/></svg>';
    await route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: transparentSvg,
    });
  });

  // 3. Atende ou silencia fontes externas e ícones de CDN se houver
  await page.route(/.*(fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com).*/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/css',
      body: '/* mock external cdn */',
    });
  });
}
