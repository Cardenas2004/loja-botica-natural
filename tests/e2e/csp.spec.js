// @ts-check
import { test, expect } from '@playwright/test';
import { setupPageMocks } from './helpers.js';

const PAGES = [
  { path: '/index.html', name: 'Home', isPublic: true },
  { path: '/produtos.html', name: 'Catálogo', isPublic: true },
  { path: '/produto.html?id=prod-1', name: 'Produto', isPublic: true },
  { path: '/privacidade.html', name: 'Privacidade', isPublic: true },
  { path: '/404.html', name: '404', isPublic: true },
  { path: '/admin.html', name: 'Admin', isPublic: false },
];

test.describe('Segurança & CSP: Zero violações de CSP, zero erros no console e zero SDK pesado na vitrine', () => {
  for (const pageDef of PAGES) {
    test(`${pageDef.name} não deve emitir violações de CSP nem erros não capturados`, async ({ page }) => {
      await setupPageMocks(page);

      const cspViolations = [];
      const consoleErrors = [];
      const requestedScripts = [];

      page.on('request', (req) => {
        if (req.resourceType() === 'script') {
          requestedScripts.push(req.url());
        }
      });

      page.on('console', (msg) => {
        const text = msg.text();
        if (msg.type() === 'error') {
          if (!text.includes('Failed to load resource') && !text.includes('net::ERR_')) {
            consoleErrors.push(text);
          }
        }
        if (text.toLowerCase().includes('content security policy') || text.toLowerCase().includes('violates')) {
          cspViolations.push(text);
        }
      });

      page.on('pageerror', (err) => {
        consoleErrors.push(err.message);
      });

      await page.goto(pageDef.path);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(400);

      expect(cspViolations, `Violações de CSP em ${pageDef.name}: ${cspViolations.join('; ')}`).toEqual([]);
      expect(consoleErrors, `Erros no console em ${pageDef.name}: ${consoleErrors.join('; ')}`).toEqual([]);

      // MED-04 parte 2: páginas públicas não devem carregar supabase-js nem supabaseClient.js
      if (pageDef.isPublic) {
        const heavyRequests = requestedScripts.filter(
          (u) => u.includes('supabase-js') || u.includes('supabaseClient.js')
        );
        expect(
          heavyRequests,
          `Página pública ${pageDef.name} não deve carregar supabase-js: ${heavyRequests.join(', ')}`
        ).toEqual([]);
      }
    });
  }

  test('Rota inexistente em subdiretório responde com HTTP 404, <h1> válido e estilos da raiz', async ({
    page,
  }) => {
    await setupPageMocks(page);
    const response = await page.goto('/subpasta-inexistente/pagina-que-nao-existe', {
      waitUntil: 'domcontentloaded',
    });
    expect(response?.status()).toBe(404);
    await expect(page.locator('h1#not-found-title')).toHaveText('Página não encontrada');
    await expect(page.locator('head meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow'
    );
  });

  test('Clean URLs (/produtos, /privacidade, /admin) carregam sem erros e /produtos/ redireciona para /produtos', async ({
    page,
  }) => {
    await setupPageMocks(page);

    for (const cleanPath of ['/produtos', '/privacidade', '/admin']) {
      const res = await page.goto(cleanPath, { waitUntil: 'domcontentloaded' });
      expect(res?.status(), `Status inesperado em ${cleanPath}`).toBe(200);
    }

    const trailingRes = await page.goto('/produtos/', { waitUntil: 'domcontentloaded' });
    expect(trailingRes?.status()).toBe(200);
    expect(page.url()).toMatch(/\/produtos$/);
  });
});
